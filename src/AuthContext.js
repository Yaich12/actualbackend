import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { resolveWorkspaceContext } from "./utils/workspaceContext";

const AuthContext = createContext({
  user: null,
  loading: true,
  authLoading: true,
  userDoc: null,
  sessionUid: null,
  workspaceUid: null,
  activeClinicId: null,
  workspaceRole: null,
  hasWorkspace: false,
  isDelegatedWorkspace: false,
  profileLoading: true,
  workspaceLoading: false,
  signOutUser: () => Promise.resolve(),
  updateUserProfile: () => Promise.resolve(),
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const resolvedWorkspaceForUidRef = useRef(new Set());

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
      setAuthLoading(false);
    });

    void resolveRedirectLogin();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }
    if (!user) {
      resolvedWorkspaceForUidRef.current.clear();
      setUserDoc(null);
      setProfileLoading(false);
      setWorkspaceLoading(false);
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
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading || profileLoading || !user?.uid) {
      if (!user?.uid) {
        setWorkspaceLoading(false);
      }
      return undefined;
    }

    const uid = String(user.uid || "").trim();
    if (!uid) {
      setWorkspaceLoading(false);
      return undefined;
    }

    if (resolvedWorkspaceForUidRef.current.has(uid)) {
      setWorkspaceLoading(false);
      return undefined;
    }
    resolvedWorkspaceForUidRef.current.add(uid);

    let cancelled = false;
    setWorkspaceLoading(true);
    const runWorkspaceResolution = async () => {
      try {
        const workspace = await resolveWorkspaceContext(user);
        if (cancelled) return;
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.info("[WORKSPACE RESOLVE] AuthContext bootstrap result", {
            uid,
            workspace,
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[AuthContext] Failed to resolve workspace on bootstrap", error);
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    };

    void runWorkspaceResolution();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profileLoading, user]);

  const signOutUser = () => signOut(auth);
  const loading = authLoading || profileLoading || workspaceLoading;

  const sessionUid = user?.uid || null;
  const activeClinicId = useMemo(() => {
    const raw = `${userDoc?.activeClinicId || userDoc?.clinicId || ""}`.trim();
    return raw || null;
  }, [userDoc?.activeClinicId, userDoc?.clinicId]);
  const workspaceRole = useMemo(() => {
    const rawRole = `${userDoc?.role || ""}`.trim().toLowerCase();
    if (rawRole === "owner" || rawRole === "member") return rawRole;
    return null;
  }, [userDoc?.role]);
  const hasWorkspace = Boolean(activeClinicId);
  const workspaceUid = useMemo(() => {
    const mappedUid = `${userDoc?.dataOwnerUid || userDoc?.clinicOwnerUid || ''}`.trim();
    if (mappedUid) return mappedUid;
    return sessionUid;
  }, [sessionUid, userDoc?.clinicOwnerUid, userDoc?.dataOwnerUid]);
  const isDelegatedWorkspace = Boolean(sessionUid && workspaceUid && sessionUid !== workspaceUid);

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
      authLoading,
      userDoc,
      sessionUid,
      workspaceUid,
      activeClinicId,
      workspaceRole,
      hasWorkspace,
      isDelegatedWorkspace,
      profileLoading,
      workspaceLoading,
      signOutUser,
      updateUserProfile,
    }),
    [
      user,
      loading,
      authLoading,
      userDoc,
      sessionUid,
      workspaceUid,
      activeClinicId,
      workspaceRole,
      hasWorkspace,
      isDelegatedWorkspace,
      profileLoading,
      workspaceLoading,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
