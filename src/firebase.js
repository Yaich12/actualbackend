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

// Debug: log environment variable status
if (process.env.NODE_ENV === "development") {
  // eslint-disable-next-line no-console
  console.log(
    "[Firebase Debug] REACT_APP_USE_FIREBASE_EMULATORS =",
    process.env.REACT_APP_USE_FIREBASE_EMULATORS,
    "→ shouldUseEmulators =",
    shouldUseEmulators
  );
}

const requiredEnv = {
  REACT_APP_API_KEY: process.env.REACT_APP_API_KEY,
  REACT_APP_AUTH_DOMAIN: process.env.REACT_APP_AUTH_DOMAIN,
  REACT_APP_PROJECT_ID: process.env.REACT_APP_PROJECT_ID,
  REACT_APP_STORAGE_BUCKET: process.env.REACT_APP_STORAGE_BUCKET,
  REACT_APP_MESSAGING_SENDER_ID: process.env.REACT_APP_MESSAGING_SENDER_ID,
  REACT_APP_APP_ID: process.env.REACT_APP_APP_ID,
};

export const firebaseEnvMissingKeys = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigured =
  firebaseEnvMissingKeys.length === 0;

// Export shouldUseEmulators so components can check if emulators are enabled
export { shouldUseEmulators };

// If the app is missing required cloud env vars, we must NOT crash at import-time.
// Instead, we fall back to a safe "emulator-style" config so the UI can load and
// display a helpful setup message.
const effectiveUseFallbackConfig =
  shouldUseEmulators || !firebaseConfigured;

if (!firebaseConfigured && !shouldUseEmulators) {
  // eslint-disable-next-line no-console
  console.error(
    `[Firebase] Missing env vars (${firebaseEnvMissingKeys.join(
      ", "
    )}). Falling back to local config so the app can render. ` +
      `Create a .env with the missing REACT_APP_* values (or set REACT_APP_USE_FIREBASE_EMULATORS=true).`
  );
}

const firebaseConfig = effectiveUseFallbackConfig
  ? {
      // Fallback/emulator-style mode: Firebase accepts any API key; keep projectId stable for local data.
      apiKey: process.env.REACT_APP_API_KEY || "fake-api-key",
      authDomain: process.env.REACT_APP_AUTH_DOMAIN || "localhost",
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

const FIRESTORE_DATABASE_ID =
  process.env.REACT_APP_FIRESTORE_DB_ID || "actuelbackend12";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, FIRESTORE_DATABASE_ID);
// eslint-disable-next-line no-console
console.log(
  `[Firebase] Firestore initialized (${effectiveUseFallbackConfig ? "fallback-config" : "cloud-config"}).`,
  "Project ID:",
  firebaseConfig.projectId,
  "Database ID:",
  FIRESTORE_DATABASE_ID || "(default)"
);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

if (shouldUseEmulators) {
  try {
    if (useAuthEmulator) {
      connectAuthEmulator(auth, "http://localhost:9099", {
        disableWarnings: true,
      });
      // eslint-disable-next-line no-console
      console.log("[Firebase] Connected to Auth Emulator on port 9099");
    }
    connectStorageEmulator(storage, "localhost", 9199);
    // eslint-disable-next-line no-console
    console.log("[Firebase] Connected to Storage Emulator on port 9199");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[Firebase] Failed to connect to emulators. Make sure Firebase emulators are running:",
      "npm run emulators"
    );
    // eslint-disable-next-line no-console
    console.error("[Firebase] Emulator connection error:", error);
  }
}

export {
  auth,
  db,
  effectiveUseFallbackConfig,
  googleProvider,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  getRedirectResult,
  storage,
};
