import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { auth } from "./firebase";
import { signInWithGoogleRedirect } from "./googleauth";
import { useAuth } from "./AuthContext";
import Navbar from "./unAuth/components/navbar";
import "./SignUp.css";

const EMAIL_STORAGE_KEY = "selmaEmailForSignIn";

const getActionCodeSettings = () => {
  const defaultUrl =
    typeof window !== "undefined" && window.location.origin
      ? `${window.location.origin}/signup`
      : "http://localhost:3000/signup";

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
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const actionCodeSettings = useMemo(getActionCodeSettings, []);

  useEffect(() => {
    if (!loading && user) {
      navigate("/booking", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const finishSignInFromLink = async () => {
      if (typeof window === "undefined") return;
      const link = window.location.href;

      if (!isSignInWithEmailLink(auth, link)) {
        return;
      }

      setProcessingLink(true);

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
        await signInWithEmailLink(auth, storedEmail, link);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        setStatus({
          type: "success",
          message: "You are now signed in. Redirecting…",
        });
        navigate("/booking", { replace: true });
      } catch (error) {
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

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    if (!email) {
      setStatus({ type: "error", message: "Enter an email address first." });
      return;
    }

    try {
      setSending(true);
      setStatus(null);
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      }
      setStatus({
        type: "success",
        message: "Check your inbox for a secure sign-in link.",
      });
      setEmail("");
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message ?? "Unable to send sign-in link.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleGoogleSignIn = () => {
    setStatus(null);
    signInWithGoogleRedirect().catch((error) => {
      setStatus({
        type: "error",
        message: error.message ?? "Google sign-in failed.",
      });
    });
  };

  return (
    <div className="signup-page">
      <Navbar />
      <main className="signup-content" aria-busy={processingLink}>
        <section className="signup-card">
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
    </div>
  );
}

export default SignUp;
