import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function ensureUserDocument(user) {
  if (!user?.uid) {
    return;
  }

  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);

  const baseData = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    providerId: user.providerData?.[0]?.providerId ?? null,
    updatedAt: serverTimestamp(),
  };

  if (!snapshot.exists()) {
    await setDoc(ref, {
      ...baseData,
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, baseData, { merge: true });
  }
}

