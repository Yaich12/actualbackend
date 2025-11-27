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
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext({
  user: null,
  loading: true,
  signOutUser: () => Promise.resolve(),
  updateUserProfile: () => Promise.resolve(),
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
      console.log("[AuthContext] onAuthStateChanged:", firebaseUser);
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
    if (!user) {
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const providerId = user.providerData?.[0]?.providerId ?? "password";
    const creationTime = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime)
      : null;

    setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        providerId,
        lastLoginAt: serverTimestamp(),
        createdAt: creationTime ?? serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => {
      console.error("Failed to sync user profile", error);
    });
  }, [user]);

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
      signOutUser,
      updateUserProfile,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
