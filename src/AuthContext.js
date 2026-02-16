import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { ensureUserProfile } from "./services/userService";

const AuthContext = createContext({
  user: null,
  loading: true,
  userDoc: null,
  profileLoading: true,
  signOutUser: () => Promise.resolve(),
  updateUserProfile: () => Promise.resolve(),
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resolveRedirectLogin = async () => {
      try {
        const redirectResult = await getRedirectResult(auth);
        if (!isMounted || !redirectResult?.user) {
          return;
        }
        console.log("[AuthContext] redirect result user:", redirectResult.user);
        setUser(redirectResult.user);
      } catch (error) {
        if (!isMounted) return;
        console.error("[AuthContext] getRedirectResult failed:", error);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!isMounted) return;
      console.log("[AuthContext] onAuthStateChanged:", {
        origin: typeof window !== "undefined" ? window.location.origin : "server",
        user: firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null,
      });
      setUser(firebaseUser);
      setLoading(false);
    });

    void resolveRedirectLogin();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return undefined;
    }
    if (!user) {
      setUserDoc(null);
      setProfileLoading(false);
      return undefined;
    }

    let isMounted = true;
    setProfileLoading(true);
    ensureUserProfile(user).catch((error) => {
      console.error("[AuthContext] Failed to ensure user profile", error);
    });

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (!isMounted) return;
        setUserDoc(snap.exists() ? snap.data() : null);
        setProfileLoading(false);
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[AuthContext] profile loaded", {
            origin: typeof window !== "undefined" ? window.location.origin : "server",
            uid: user.uid,
            hasProfile: snap.exists(),
          });
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error("[AuthContext] Failed to load user profile", error);
        setProfileLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user, loading]);

  const signOutUser = () => signOut(auth);

  const updateUserProfile = async ({ fullName, jobTitle }) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    try {
      if (fullName) {
        await updateProfile(currentUser, { displayName: fullName });
      }

      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(
        userRef,
        {
          displayName: fullName || currentUser.displayName || null,
          email: currentUser.email ?? null,
          jobTitle: jobTitle ?? "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setUser({ ...currentUser, displayName: fullName || currentUser.displayName });
    } catch (error) {
      console.error("[AuthContext] Failed to update user profile", error);
      throw error;
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      userDoc,
      profileLoading,
      signOutUser,
      updateUserProfile,
    }),
    [user, loading, userDoc, profileLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
