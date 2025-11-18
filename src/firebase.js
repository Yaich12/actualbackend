// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
// TODO: Add other SDKs you need:
// e.g. import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration (measurementId is optional for v7.20.0+)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Functions
const functions = getFunctions(app);

// Optional: connect to emulator when running locally
if (
  (typeof window !== "undefined" && window.location.hostname === "localhost") ||
  process.env.REACT_APP_ENV === "local"
) {
  connectFunctionsEmulator(functions, "localhost", 5001);
}

export {
  app,
  analytics,
  functions,
  // ...export any other services you initialize here
};