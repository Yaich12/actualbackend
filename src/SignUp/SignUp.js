import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getRedirectResult,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { signInWithGoogle } from "../googleauth";
import { useAuth } from "../AuthContext";
import { Gem } from "lucide-react";
import { SignInPage } from "../components/ui/sign-in";
import { ensureUserDocument } from "../services/userService";
import {
  consumePostAuthRedirectTarget,
  peekPostAuthRedirectTarget,
  setPostAuthRedirectTarget,
} from "../utils/postAuthRedirect";
import "./SignUp.css";

const EMAIL_STORAGE_KEY = "selmaEmailForSignIn";

function SignUp() {
  const [status, setStatus] = useState(null);
  const [sending] = useState(false);
  const [processingLink, setProcessingLink] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [lastEmail, setLastEmail] = useState("");

  const persistUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      return;
    }
    try {
      await ensureUserDocument(authUser);
    } catch (error) {
      console.error("Failed to ensure user document:", error);
    }
  }, []);

  const resolvePostLoginRoute = useCallback(
    async (authUser) => {
      const storedTarget = consumePostAuthRedirectTarget();
      let resolvedTarget = storedTarget || "/welcome";

      if (resolvedTarget.startsWith("/welcome") && authUser?.uid) {
        try {
          const snap = await getDoc(doc(db, "users", authUser.uid));
          const data = snap.exists() ? snap.data() : null;
          if (data?.onboardingComplete === true) {
            resolvedTarget = "/booking";
          }
        } catch (error) {
          console.error("[SignUp] Failed to resolve onboarding state:", error);
        }
      }

      return resolvedTarget;
    },
    []
  );

  const redirectAfterAuth = useCallback(
    async (authUser) => {
      const target = await resolvePostLoginRoute(authUser);
      if (!target) {
        return;
      }
      navigate(target, { replace: true });
    },
    [navigate, resolvePostLoginRoute]
  );

  useEffect(() => {
    console.log("[SignUp] auth state:", { loading, user });
    if (!loading && user) {
      const persistAndRedirect = async () => {
        await persistUserProfile(user);
        await redirectAfterAuth(user);
      };

      void persistAndRedirect();
    }
  }, [loading, persistUserProfile, redirectAfterAuth, user]);

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
          message: "Du er nu logget ind. Klargør din konto…",
        });
        await redirectAfterAuth(redirectResult.user);
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
  }, [persistUserProfile, redirectAfterAuth]);

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
          message: "Du er nu logget ind. Klargør din konto…",
        });
        await redirectAfterAuth(credential?.user);
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
  }, [persistUserProfile, redirectAfterAuth]);

  const handleGoogleSignIn = async () => {
    setStatus(null);
    setStatusMessage(null);
    console.log("[SignUp] handleGoogleSignIn triggered");
    if (!peekPostAuthRedirectTarget()) {
      setPostAuthRedirectTarget("/welcome");
    }
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        console.log("[SignUp] Google popup sign-in success:", result.user);
        await persistUserProfile(result.user);
        await redirectAfterAuth(result.user);
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
    setPostAuthRedirectTarget("/welcome");
    setStatus({
      type: "success",
      message: "Logger ind…",
    });
    setProcessingLink(true);
    const formData = new FormData(event.currentTarget);
    const emailInput = (formData.get("email") || "").toString().trim();
    const passwordInput = (formData.get("password") || "").toString();
    setLastEmail(emailInput);
    try {
      if (!emailInput || !passwordInput) {
        setStatusMessage("Indtast både email og kodeord.");
        return;
      }

      const methods = await fetchSignInMethodsForEmail(auth, emailInput);
      const credential =
        methods.length === 0
          ? await createUserWithEmailAndPassword(auth, emailInput, passwordInput)
          : await signInWithEmailAndPassword(auth, emailInput, passwordInput);

      await persistUserProfile(credential.user);
      await redirectAfterAuth(credential.user);
    } catch (error) {
      console.error("[SignUp] email/password sign-in failed:", error);
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setStatusMessage("Forkert kodeord. Prøv igen.");
        return;
      }
      if (error?.code === "auth/weak-password") {
        setStatusMessage("Kodeordet er for svagt. Brug mindst 6 tegn.");
        return;
      }
      if (error?.code === "auth/invalid-email") {
        setStatusMessage("Ugyldig email. Tjek stavning og prøv igen.");
        return;
      }
      if (error?.code === "auth/email-already-in-use") {
        setStatusMessage("Emailen findes allerede. Prøv at logge ind med dit kodeord.");
        return;
      }
      setStatusMessage(error.message || "Kunne ikke logge ind eller oprette bruger.");
    } finally {
      setProcessingLink(false);
      setStatus(null);
    }
  };

  const handleEmailPasswordLoginOnly = async () => {
    if (!auth) return;
    setStatusMessage(null);
    setPostAuthRedirectTarget("/welcome");
    setStatus({
      type: "success",
      message: "Logger ind…",
    });
    setProcessingLink(true);

    const emailInput = (document.querySelector('input[name="email"]')?.value || "")
      .toString()
      .trim();
    const passwordInput = (document.querySelector('input[name="password"]')?.value || "").toString();

    try {
      if (!emailInput || !passwordInput) {
        setStatusMessage("Indtast email og kodeord først.");
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      await persistUserProfile(credential.user);
      await redirectAfterAuth(credential.user);
    } catch (error) {
      console.error("[SignUp] login-only failed:", error);
      if (error?.code === "auth/user-not-found") {
        setStatusMessage("Email findes ikke. Tryk på 'Opret konto' for at oprette en bruger.");
        return;
      }
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setStatusMessage("Forkert kodeord. Prøv igen.");
        return;
      }
      if (error?.code === "auth/invalid-email") {
        setStatusMessage("Ugyldig email. Tjek stavning og prøv igen.");
        return;
      }
      setStatusMessage(error.message || "Kunne ikke logge ind.");
    } finally {
      setProcessingLink(false);
      setStatus(null);
    }
  };

  const handleCreateAccount = async () => {
    if (!auth) return;
    setStatusMessage(null);
    setPostAuthRedirectTarget("/welcome");
    // Use current form values (works even if user didn't press "Sign In" first)
    const emailInput =
      (document.querySelector('input[name="email"]')?.value || "").toString().trim() || lastEmail;
    const formPassword = (document.querySelector('input[name="password"]')?.value || "").toString();

    if (!emailInput || !formPassword) {
      setStatusMessage("Indtast email og kodeord først.");
      return;
    }
    try {
      const methods = await fetchSignInMethodsForEmail(auth, emailInput);
      const credential =
        methods.length === 0
          ? await createUserWithEmailAndPassword(auth, emailInput, formPassword)
          : await signInWithEmailAndPassword(auth, emailInput, formPassword);

      await persistUserProfile(credential.user);
      await redirectAfterAuth(credential.user);
    } catch (error) {
      console.error("[SignUp] create account failed:", error);
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setStatusMessage("Forkert kodeord. Prøv igen.");
        return;
      }
      if (error?.code === "auth/weak-password") {
        setStatusMessage("Kodeordet er for svagt. Brug mindst 6 tegn.");
        return;
      }
      if (error?.code === "auth/invalid-email") {
        setStatusMessage("Ugyldig email. Tjek stavning og prøv igen.");
        return;
      }
      setStatusMessage(error.message || "Kunne ikke oprette eller logge ind.");
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
          onLoginLink={handleEmailPasswordLoginOnly}
          onSignUp={handleCreateAccount}
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
