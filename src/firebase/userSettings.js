import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const getLanguageFromData = (data) => {
  if (!data) return null;
  const preferred = data.preferredLanguage;
  if (typeof preferred === 'string' && preferred.trim()) {
    return preferred.trim();
  }
  const settingsLanguage = data.settings?.language;
  if (typeof settingsLanguage === 'string' && settingsLanguage.trim()) {
    return settingsLanguage.trim();
  }
  const legacyLanguage = data.language;
  if (typeof legacyLanguage === 'string' && legacyLanguage.trim()) {
    return legacyLanguage.trim();
  }
  return null;
};

export const getUserLanguage = async (uid) => {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return getLanguageFromData(snap.exists() ? snap.data() : null);
};

export const setUserLanguage = async (uid, language) => {
  const resolved = typeof language === 'string' ? language.trim() : '';
  if (!uid || !resolved) return;
  await setDoc(
    doc(db, 'users', uid),
    {
      preferredLanguage: resolved,
    },
    { merge: true }
  );
};

export const subscribeUserLanguage = (uid, callback) => {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      callback(getLanguageFromData(data));
    },
    (error) => {
      console.error('[userSettings] Failed to listen for language changes', error);
      callback(null);
    }
  );
};
