import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  getRedirectResult,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";
import { signInWithGoogle } from "../googleauth";
import { useAuth } from "../AuthContext";
import { Gem } from "lucide-react";
import { SignInPage } from "../components/ui/sign-in";
import { ensureUserDocument } from "../services/userService";
import {
  clearPostAuthRedirectTarget,
  setPostAuthRedirectTarget,
} from "../utils/postAuthRedirect";
import "./SignUp.css";

const EMAIL_STORAGE_KEY = "selmaEmailForSignIn";

const SelmaAuthLogo = () => (
  <Link to="/" className="signup-logo-chip" aria-label="Tilbage til forsiden">
    <Gem className="h-4 w-4" />
  </Link>
);

function SignUp() {
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [processingLink, setProcessingLink] = useState(false);
  const [shouldRedirectToWelcome, setShouldRedirectToWelcome] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [lastEmail, setLastEmail] = useState("");

  const persistUserProfile = async (authUser) => {
    if (!authUser) {
      return;
    }
    try {
      await ensureUserDocument(authUser);
    } catch (error) {
      console.error("Failed to ensure user document:", error);
    }
  };

  const redirectToWelcome = () => {
    setShouldRedirectToWelcome(true);
    navigate("/welcome", { replace: true });
    clearPostAuthRedirectTarget();
  };

  useEffect(() => {
    console.log("[SignUp] auth state:", { loading, user });
    if (!loading && user) {
      const persistAndRedirect = async () => {
        await persistUserProfile(user);
        console.log("[SignUp] navigating to /welcome");
        redirectToWelcome();
      };

      void persistAndRedirect();
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    let isMounted = true;

    const completeGoogleRedirectSignIn = async () => {
      try {
        const redirectResult = await getRedirectResult(auth);
        console.log("[SignUp] raw Google redirect result:", redirectResult);
        if (!redirectResult || !isMounted) {
          console.log("[SignUp] No Google redirect result available");
          return;
        }

        setProcessingLink(true);
        console.log("[SignUp] Google redirect result:", redirectResult.user);
        await persistUserProfile(redirectResult.user);
        setStatus({
          type: "success",
          message: "Du er nu logget ind. Sender dig til velkomstskærmen…",
        });
        console.log("[SignUp] navigating to /welcome after Google sign-in");
        redirectToWelcome();
      } catch (error) {
        console.error("[SignUp] Google redirect completion failed:", error);
        if (!isMounted) {
          return;
        }

        if (error?.code === "auth/no-auth-event") {
          return;
        }

        console.error("[SignUp] Google redirect sign-in failed:", error);
        setStatus({
          type: "error",
          message: error.message ?? "Google sign-in failed.",
        });
      } finally {
        if (isMounted) {
          setProcessingLink(false);
        }
      }
    };

    void completeGoogleRedirectSignIn();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const finishSignInFromLink = async () => {
      if (typeof window === "undefined") return;
      const link = window.location.href;

      if (!isSignInWithEmailLink(auth, link)) {
        console.log("[SignUp] current URL is not an email sign-in link");
        return;
      }

      setProcessingLink(true);
      console.log("[SignUp] detected email sign-in link, finishing sign-in");

      let storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      if (!storedEmail) {
        storedEmail = window.prompt("Please confirm your email for sign in");
      }

      if (!storedEmail) {
        setStatus({
          type: "error",
          message: "Email confirmation is required to finish signing in.",
        });
        setProcessingLink(false);
        return;
      }

      try {
        const credential = await signInWithEmailLink(auth, storedEmail, link);
        await persistUserProfile(credential?.user);
        console.log("[SignUp] email link sign-in success:", credential?.user);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        setStatus({
          type: "success",
          message: "Du er nu logget ind. Sender dig til velkomstskærmen…",
        });
        console.log("[SignUp] navigating to /welcome after email link sign-in");
        redirectToWelcome();
      } catch (error) {
        console.error("[SignUp] email link sign-in failed:", error);
        setStatus({
          type: "error",
          message: error.message ?? "Unable to finish sign in.",
        });
      } finally {
        setProcessingLink(false);
      }
    };

    finishSignInFromLink();
  }, [navigate]);

  if (shouldRedirectToWelcome && !loading) {
    return <Navigate to="/welcome" replace />;
  }

  const handleGoogleSignIn = async () => {
    setStatus(null);
    setStatusMessage(null);
    console.log("[SignUp] handleGoogleSignIn triggered");
    setPostAuthRedirectTarget("/welcome");
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        console.log("[SignUp] Google popup sign-in success:", result.user);
        await persistUserProfile(result.user);
        redirectToWelcome();
      } else {
        console.log(
          "[SignUp] Switched to redirect flow for Google sign-in (popup unavailable)"
        );
      }
    } catch (error) {
      console.error("[SignUp] Google sign-in failed:", error);
      setStatus({
        type: "error",
        message: error.message ?? "Google sign-in failed.",
      });
    }
  };

  const handleEmailPasswordSignIn = async (event) => {
    event.preventDefault();
    if (!auth) return;
    setStatusMessage(null);
    const formData = new FormData(event.currentTarget);
    const emailInput = (formData.get("email") || "").toString().trim();
    const passwordInput = (formData.get("password") || "").toString();
    setLastEmail(emailInput);
    try {
      const credential = await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      await persistUserProfile(credential.user);
      redirectToWelcome();
    } catch (error) {
      console.error("[SignUp] email/password sign-in failed:", error);
      setStatusMessage(error.message || "Could not sign in with email/password.");
    }
  };

  const handleCreateAccount = async () => {
    if (!auth) return;
    setStatusMessage(null);
    // Use last entered email/password if available
    const emailInput = lastEmail;
    if (!emailInput) {
      setStatusMessage("Enter email and password, then tap Create Account.");
      return;
    }
    const formPassword = document.querySelector('input[name="password"]')?.value || "";
    if (!formPassword) {
      setStatusMessage("Enter a password to create your account.");
      return;
    }
    try {
      const credential = await createUserWithEmailAndPassword(auth, emailInput, formPassword);
      await persistUserProfile(credential.user);
      redirectToWelcome();
    } catch (error) {
      console.error("[SignUp] create account failed:", error);
      setStatusMessage(error.message || "Could not create account.");
    }
  };

  const handleResetPassword = async () => {
    if (!auth) return;
    const emailInput = lastEmail || document.querySelector('input[name="email"]')?.value || "";
    if (!emailInput) {
      setStatusMessage("Enter your email first, then choose Reset password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailInput);
      setStatusMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      console.error("[SignUp] reset password failed:", error);
      setStatusMessage(error.message || "Could not send reset email.");
    }
  };

  return (
    <div className="signup-page">
      <section className="signup-auth-wrapper" aria-busy={sending || processingLink}>
        <div className="signup-logo-chip">
          <Link to="/" aria-label="Tilbage til forsiden">
            <Gem className="h-4 w-4 text-white" />
          </Link>
        </div>
        <SignInPage
          heroImageSrc="/hero/pexels-yankrukov-5794028.jpg"
          testimonials={[]}
          onSignIn={handleEmailPasswordSignIn}
          onGoogleSignIn={handleGoogleSignIn}
          onResetPassword={handleResetPassword}
          onCreateAccount={handleCreateAccount}
          title={<span className="font-light">Velkommen tilbage</span>}
          description="Log ind med email og kode eller fortsæt med Google. Du kan stadig bruge din magiske link-login hvis du har en aktiv email link."
        />
        {status && (
          <p className={`signup-status ${status.type}`} style={{ maxWidth: '480px', margin: '1rem auto' }}>
            {status.message}
          </p>
        )}
        {statusMessage && (
          <p className="signup-status" style={{ maxWidth: '480px', margin: '1rem auto', background: '#e0e7ff', color: '#1e3a8a' }}>
            {statusMessage}
          </p>
        )}
      </section>
    </div>
  );
}

export default SignUp;
