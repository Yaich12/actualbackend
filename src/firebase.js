import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  connectAuthEmulator,
  getRedirectResult,
} from "firebase/auth";
import {
  getFirestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
} from "firebase/storage";

const shouldUseEmulators =
  process.env.REACT_APP_USE_FIREBASE_EMULATORS === "true";
const useAuthEmulator =
  process.env.REACT_APP_USE_AUTH_EMULATOR === "true";

const firebaseConfig = shouldUseEmulators
  ? {
      // Emulator mode: Firebase accepts any API key; keep projectId stable for local data.
      apiKey: "fake-api-key",
      authDomain: "localhost",
      projectId: process.env.REACT_APP_PROJECT_ID || "demo-project",
      storageBucket:
        process.env.REACT_APP_STORAGE_BUCKET ||
        "demo-project.appspot.com",
      messagingSenderId:
        process.env.REACT_APP_MESSAGING_SENDER_ID || "demo-sender",
      appId: process.env.REACT_APP_APP_ID || "demo-app",
      measurementId: process.env.REACT_APP_MEASUREMENT_ID || "demo-measure",
    }
  : {
      apiKey: process.env.REACT_APP_API_KEY,
      authDomain: process.env.REACT_APP_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_PROJECT_ID,
      storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
      messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
      appId: process.env.REACT_APP_APP_ID,
      measurementId: process.env.REACT_APP_MEASUREMENT_ID,
    };

if (!shouldUseEmulators) {
  const missingKeys = Object.entries({
    REACT_APP_API_KEY: firebaseConfig.apiKey,
    REACT_APP_AUTH_DOMAIN: firebaseConfig.authDomain,
    REACT_APP_PROJECT_ID: firebaseConfig.projectId,
    REACT_APP_STORAGE_BUCKET: firebaseConfig.storageBucket,
    REACT_APP_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
    REACT_APP_APP_ID: firebaseConfig.appId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    throw new Error(
      `Missing Firebase env vars: ${missingKeys.join(
        ", "
      )}. Set them in your .env file.`
    );
  }
}

const FIRESTORE_DATABASE_ID =
  process.env.REACT_APP_FIRESTORE_DB_ID || "actuelbackend12";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, FIRESTORE_DATABASE_ID);
console.log(
  "[Firebase] Firestore initialized for cloud use (no emulator).",
  "Project ID:",
  firebaseConfig.projectId,
  "Database ID:",
  FIRESTORE_DATABASE_ID || "(default)"
);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

if (shouldUseEmulators) {
  if (useAuthEmulator) {
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
  }
  connectStorageEmulator(storage, "localhost", 9199);
}

export {
  auth,
  db,
  googleProvider,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  getRedirectResult,
  storage,
};
