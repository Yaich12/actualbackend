import { GoogleAuthProvider, signInWithRedirect } from "firebase/auth";
import { auth } from "./firebase";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.REACT_APP_GOOGLE_CLIENT_SECRET;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

const signInWithGoogleRedirect = () => signInWithRedirect(auth, googleProvider);

export {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  googleProvider,
  signInWithGoogleRedirect,
};
