import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  getRedirectResult,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { auth } from "../firebase";
import { signInWithGoogle } from "../googleauth";
import { useAuth } from "../AuthContext";
import { Gem } from "lucide-react";
import { AuthComponent } from "../components/ui/sign-up";
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

const getActionCodeSettings = () => {
  const defaultUrl =
    typeof window !== "undefined" && window.location.origin
      ? `${window.location.origin}/signup`
      : "http://localhost:3004/signup";

  return {
    url: process.env.REACT_APP_PASSWORDLESS_REDIRECT_URL ?? defaultUrl,
    handleCodeInApp: true,
    ...(process.env.REACT_APP_DYNAMIC_LINK_DOMAIN
      ? { dynamicLinkDomain: process.env.REACT_APP_DYNAMIC_LINK_DOMAIN }
      : {}),
  };
};

function SignUp() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [processingLink, setProcessingLink] = useState(false);
  const [showLegacyForm, setShowLegacyForm] = useState(false);
  const [shouldRedirectToBooking, setShouldRedirectToBooking] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const actionCodeSettings = useMemo(getActionCodeSettings, []);
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

  const redirectToBooking = () => {
    setShouldRedirectToBooking(true);
    navigate("/booking", { replace: true });
    clearPostAuthRedirectTarget();
  };

  useEffect(() => {
    console.log("[SignUp] auth state:", { loading, user });
    if (!loading && user) {
      const persistAndRedirect = async () => {
        await persistUserProfile(user);
        console.log("[SignUp] navigating to /booking");
        redirectToBooking();
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
          message: "Du er nu logget ind. Sender dig til booking…",
        });
        console.log("[SignUp] navigating to /booking after Google sign-in");
        redirectToBooking();
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
          message: "Du er nu logget ind. Sender dig til booking…",
        });
        console.log("[SignUp] navigating to /booking after email link sign-in");
        redirectToBooking();
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

  const sendMagicLink = async (targetEmail) => {
    if (!targetEmail) {
      const errorMessage = "Enter an email address first.";
      setStatus({ type: "error", message: errorMessage });
      throw new Error(errorMessage);
    }

    try {
      setSending(true);
      setStatus(null);
      setPostAuthRedirectTarget("/booking");
      await sendSignInLinkToEmail(auth, targetEmail, actionCodeSettings);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EMAIL_STORAGE_KEY, targetEmail);
      }
      setStatus({
        type: "success",
        message: "Check your inbox for a secure sign-in link.",
      });
      if (!showLegacyForm) {
        setEmail(targetEmail);
      }
    } catch (error) {
      const message = error.message ?? "Unable to send sign-in link.";
      setStatus({ type: "error", message });
      throw new Error(message);
    } finally {
      setSending(false);
    }
  };

  if (shouldRedirectToBooking && !loading) {
    return <Navigate to="/booking" replace />;
  }

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    await sendMagicLink(email);
  };

  const handleGoogleSignIn = async () => {
    setStatus(null);
    console.log("[SignUp] handleGoogleSignIn triggered");
    setPostAuthRedirectTarget("/booking");
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        console.log("[SignUp] Google popup sign-in success:", result.user);
        await persistUserProfile(result.user);
        redirectToBooking();
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

  return (
    <div className="signup-page">
      <section className="signup-auth-wrapper">
        <AuthComponent
          logo={<SelmaAuthLogo />}
          brandName="Selma+"
          onGoogleSignIn={handleGoogleSignIn}
          onEmailSubmit={({ email: inputEmail }) => sendMagicLink(inputEmail)}
          isProcessing={sending || processingLink}
        />
      </section>

      <section className="signup-legacy">
        <button
          type="button"
          className="signup-legacy-toggle"
          onClick={() => setShowLegacyForm((prev) => !prev)}
        >
          {showLegacyForm ? "Skjul legacy-login" : "Brug den oprindelige login-flow"}
        </button>

        {showLegacyForm && (
          <main className="signup-content" aria-busy={processingLink}>
            <section className="signup-card signup-legacy-card">
              <header className="signup-header">
                <h1>Sign up to Selma</h1>
                <p>Choose email or Google to finish creating your account.</p>
              </header>

              <form className="signup-form" onSubmit={handleEmailSubmit}>
                <label htmlFor="signup-email">Email address</label>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <button
                  type="submit"
                  className="signup-button primary"
                  disabled={sending || processingLink}
                >
                  {sending ? "Sending link…" : "Next"}
                </button>
              </form>

              <div className="signup-divider">
                <span />
                <p>or</p>
                <span />
              </div>

              <button
                type="button"
                className="signup-button google"
                onClick={handleGoogleSignIn}
                disabled={processingLink}
              >
                Continue with Google
              </button>

              {status && (
                <p className={`signup-status ${status.type}`}>{status.message}</p>
              )}

              <p className="signup-switch">
                Already have access? <Link to="/booking">Go to the app</Link>
              </p>
            </section>
          </main>
        )}
      </section>
    </div>
  );
}

export default SignUp;
