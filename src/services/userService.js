import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function ensureUserProfile(user) {
  if (!user?.uid) {
    return;
  }

  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  const providers = Array.isArray(user.providerData)
    ? user.providerData.map((provider) => provider?.providerId).filter(Boolean)
    : [];

  const baseData = {
    uid: user.uid,
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    lastLoginAt: serverTimestamp(),
  };

  if (!snapshot.exists()) {
    await setDoc(
      ref,
      {
        ...baseData,
        createdAt: serverTimestamp(),
        authProviders: providers,
      },
      { merge: true }
    );
  } else {
    const updateData = {
      ...baseData,
      ...(providers.length > 0 ? { authProviders: arrayUnion(...providers) } : {}),
    };
    await setDoc(ref, updateData, { merge: true });
  }
}

export async function ensureUserDocument(user) {
  return ensureUserProfile(user);
}
