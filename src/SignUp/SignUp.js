import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAuth,
  getRedirectResult,
  isSignInWithEmailLink,
  RecaptchaVerifier,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { auth } from "../firebase";
import { signInWithGoogle } from "../googleauth";
import { useAuth } from "../AuthContext";
import { ArrowLeft } from "lucide-react";
import { SignInPage } from "../components/ui/sign-in";
import { ensureUserProfile } from "../services/userService";
import {
  consumePostAuthRedirectTarget,
  peekPostAuthRedirectTarget,
  setPostAuthRedirectTarget,
} from "../utils/postAuthRedirect";
import { getPublicAssetUrl } from "../utils/publicAssets";
import {
  buildTeamLoginEmail,
  normalizeTeamLoginUsername,
} from "../utils/teamLogin";
import { ensureMemberWorkspaceGuard } from "../utils/employeeWorkspace";
import { resolveWorkspaceContext } from "../utils/workspaceContext";
import { useLanguage } from "../unAuth/language/LanguageProvider";
import "./SignUp.css";

const EMAIL_STORAGE_KEY = "selmaEmailForSignIn";

function SignUp() {
  const { t } = useLanguage();
  const [status, setStatus] = useState(null);
  const [sending] = useState(false);
  const [processingLink, setProcessingLink] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [lastEmail, setLastEmail] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [loginMethod, setLoginMethod] = useState("email");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [phoneStep, setPhoneStep] = useState("enterPhone");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const recaptchaVerifierRef = useRef(null);
  const recaptchaWidgetIdRef = useRef(null);

  const persistUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      return;
    }
    try {
      await ensureUserProfile(authUser);
    } catch (error) {
      console.error("Failed to ensure user document:", error);
    }
  }, []);

  const normalizePhoneNumber = useCallback((value) => {
    const trimmed = value.replace(/\s+/g, "");
    if (!trimmed) {
      return "";
    }
    const digits = trimmed.replace(/[^\d]/g, "");
    if (!digits) {
      return trimmed.startsWith("+") ? "+" : "";
    }
    return `+${digits}`;
  }, []);

  const normalizeSmsCode = useCallback((value) => value.replace(/\D/g, "").slice(0, 6), []);

  const resetRecaptcha = useCallback(() => {
    const widgetId = recaptchaWidgetIdRef.current;
    if (
      typeof window !== "undefined" &&
      window.grecaptcha &&
      typeof window.grecaptcha.reset === "function" &&
      widgetId !== null
    ) {
      window.grecaptcha.reset(widgetId);
      return;
    }
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
      recaptchaWidgetIdRef.current = null;
    }
  }, []);

  // TODO: Firebase Console -> Authentication -> Sign-in method -> enable Phone
  // TODO: Add domain to OAuth redirect domains (e.g. selma+.dk)
  // TODO: Set SMS region policy if desired.
  const initRecaptcha = useCallback(async () => {
    const authInstance = auth || getAuth();
    if (!authInstance || typeof window === "undefined") {
      return null;
    }
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }
    const container = document.getElementById("recaptcha-container");
    if (!container) {
      return null;
    }
    authInstance.languageCode = "da";
    const verifier = new RecaptchaVerifier(authInstance, "recaptcha-container", {
      size: "normal",
    });
    recaptchaVerifierRef.current = verifier;
    try {
      const widgetId = await verifier.render();
      recaptchaWidgetIdRef.current = widgetId;
    } catch (error) {
      recaptchaVerifierRef.current = null;
      recaptchaWidgetIdRef.current = null;
      throw error;
    }
    return verifier;
  }, []);

  useEffect(() => {
    setStatusMessage(null);
    setStatus(null);
    if (loginMethod !== "phone") {
      setPhoneStep("enterPhone");
      setSmsCode("");
      setConfirmationResult(null);
      resetRecaptcha();
      if (loginMethod !== "employee") {
        setEmployeeUsername("");
      }
      return;
    }
    setPhoneStep("enterPhone");
  }, [loginMethod, resetRecaptcha]);

  useEffect(() => {
    if (loginMethod === "employee" && authMode !== "login") {
      setAuthMode("login");
    }
  }, [authMode, loginMethod]);

  useEffect(() => {
    setStatusMessage(null);
    setStatus(null);
  }, [authMode]);

  useEffect(() => {
    if (loginMethod !== "phone") {
      return;
    }
    let isMounted = true;
    const setup = async () => {
      try {
        await initRecaptcha();
      } catch (error) {
        console.error("[SignUp] reCAPTCHA init failed:", error);
        if (isMounted) {
          setStatusMessage(t("login.errors.recaptchaInit"));
        }
      }
    };
    void setup();
    return () => {
      isMounted = false;
    };
  }, [initRecaptcha, loginMethod, t]);

  const resolvePostLoginRoute = useCallback(
    async (authUser) => {
      const storedTarget = consumePostAuthRedirectTarget();
      let resolvedTarget = storedTarget || "/welcome";
      let redirectReason = storedTarget ? "stored-target" : "default-welcome";
      console.info("[REDIRECT DEBUG] evaluating post-login route", {
        uid: authUser?.uid || null,
        email: authUser?.email || null,
        storedTarget: storedTarget || null,
        initialTarget: resolvedTarget,
      });

      if (resolvedTarget.startsWith("/welcome") && authUser?.uid) {
        try {
          const workspaceContext = await resolveWorkspaceContext(authUser);
          console.info("[WORKSPACE RESOLVE] SignUp resolvePostLoginRoute result", {
            uid: authUser.uid,
            workspaceContext,
          });
          if (workspaceContext?.hasWorkspace) {
            resolvedTarget = "/booking";
            redirectReason = "workspace-found";
          } else {
            redirectReason = `workspace-missing:${workspaceContext?.source || "unknown"}`;
          }
        } catch (error) {
          console.error("[SignUp] Failed to resolve user workspace:", error);
          redirectReason = "workspace-resolve-error";
        }
      }

      console.info("[REDIRECT DEBUG] chosen post-login route", {
        uid: authUser?.uid || null,
        target: resolvedTarget,
        reason: redirectReason,
      });

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
      console.info("[REDIRECT DEBUG] navigating after auth", {
        uid: authUser?.uid || null,
        target,
      });
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
          message: t("login.status.loggedIn"),
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
          message: t("login.errors.google"),
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
  }, [persistUserProfile, redirectAfterAuth, t]);

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
        storedEmail = window.prompt(t("login.prompt.confirmEmail"));
      }

      if (!storedEmail) {
        setStatus({
          type: "error",
          message: t("login.errors.emailConfirmationRequired"),
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
          message: t("login.status.loggedIn"),
        });
        await redirectAfterAuth(credential?.user);
      } catch (error) {
        console.error("[SignUp] email link sign-in failed:", error);
        setStatus({
          type: "error",
          message: t("login.errors.emailLinkFailed"),
        });
      } finally {
        setProcessingLink(false);
      }
    };

    finishSignInFromLink();
  }, [persistUserProfile, redirectAfterAuth, t]);

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
        message: t("login.errors.google"),
      });
    }
  };

  const handlePhoneNumberChange = (value) => {
    setPhoneNumber(normalizePhoneNumber(value));
  };

  const handleSmsCodeChange = (value) => {
    setSmsCode(normalizeSmsCode(value));
  };

  const handleEmployeeUsernameChange = (value) => {
    setEmployeeUsername(normalizeTeamLoginUsername(value));
  };

  const handleSendCode = async () => {
    const authInstance = auth || getAuth();
    if (!authInstance) return;
    setStatus(null);
    setStatusMessage(null);
    setPostAuthRedirectTarget("/welcome");
    setConfirmationResult(null);
    setPhoneStep("enterPhone");
    setSmsCode("");
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    setPhoneNumber(normalizedPhone);
    if (!normalizedPhone) {
      setStatusMessage(t("login.errors.phoneMissing"));
      return;
    }
    if (!/^\+\d{8,15}$/.test(normalizedPhone)) {
      setStatusMessage(t("login.errors.phoneInvalid"));
      return;
    }
    setProcessingLink(true);
    try {
      const verifier = await initRecaptcha();
      if (!verifier) {
        setStatusMessage(t("login.errors.recaptchaInit"));
        return;
      }
      const confirmation = await signInWithPhoneNumber(authInstance, normalizedPhone, verifier);
      setConfirmationResult(confirmation);
      setPhoneStep("enterCode");
      setStatus({
        type: "success",
        message: t("login.status.codeSent"),
      });
    } catch (error) {
      console.error("[SignUp] phone sign-in send code failed:", error);
      if (error?.code === "auth/invalid-phone-number") {
        setStatusMessage(t("login.errors.phoneInvalid"));
      } else if (error?.code === "auth/missing-phone-number") {
        setStatusMessage(t("login.errors.phoneMissing"));
      } else if (
        error?.code === "auth/too-many-requests" ||
        error?.code === "auth/quota-exceeded"
      ) {
        setStatusMessage(t("login.errors.tooManyRequests"));
      } else if (error?.code === "auth/captcha-check-failed") {
        setStatusMessage(t("login.errors.recaptchaFailed"));
      } else {
        setStatusMessage(t("login.errors.phoneSendFailed"));
      }
      setStatus(null);
      resetRecaptcha();
    } finally {
      setProcessingLink(false);
    }
  };

  const handleConfirmCode = async () => {
    const authInstance = auth || getAuth();
    if (!authInstance) return;
    setStatusMessage(null);
    const normalizedCode = normalizeSmsCode(smsCode);
    setSmsCode(normalizedCode);
    if (!normalizedCode) {
      setStatusMessage(t("login.errors.codeMissing"));
      return;
    }
    if (normalizedCode.length !== 6) {
      setStatusMessage(t("login.errors.codeInvalid"));
      return;
    }
    if (!confirmationResult) {
      setStatusMessage(t("login.errors.phoneSendFailed"));
      return;
    }
    setStatus({
      type: "success",
      message: t("login.status.signingIn"),
    });
    setProcessingLink(true);
    try {
      const credential = await confirmationResult.confirm(normalizedCode);
      await persistUserProfile(credential.user);
      await redirectAfterAuth(credential.user);
    } catch (error) {
      console.error("[SignUp] phone sign-in confirm failed:", error);
      if (
        error?.code === "auth/invalid-verification-code" ||
        error?.code === "auth/invalid-verification-id"
      ) {
        setStatusMessage(t("login.errors.codeInvalid"));
        return;
      }
      if (error?.code === "auth/code-expired") {
        setStatusMessage(t("login.errors.codeExpired"));
        return;
      }
      if (error?.code === "auth/account-exists-with-different-credential") {
        console.error(
          "[SignUp] Phone sign-in provider mismatch. TODO: Link providers in settings.",
          error
        );
        // TODO: After login, allow users to link multiple providers or resolve provider mismatches here.
        setStatusMessage(t("login.errors.providerMismatch"));
        return;
      }
      setStatusMessage(t("login.errors.phoneLoginFailed"));
    } finally {
      setProcessingLink(false);
      setStatus(null);
    }
  };

  const handleEmailPasswordSignIn = async (event) => {
    event.preventDefault();
    if (!auth) return;
    setStatusMessage(null);
    setPostAuthRedirectTarget("/welcome");
    setStatus({
      type: "success",
      message: t("login.status.signingIn"),
    });
    setProcessingLink(true);
    const formData = new FormData(event.currentTarget);
    const emailInput = (formData.get("email") || "").toString().trim();
    const passwordInput = (formData.get("password") || "").toString();
    setLastEmail(emailInput);
    try {
      if (!emailInput || !passwordInput) {
        setStatusMessage(t("login.errors.emailPasswordRequired"));
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, emailInput, passwordInput);

      await persistUserProfile(credential.user);
      await redirectAfterAuth(credential.user);
    } catch (error) {
      console.error("[SignUp] email/password sign-in failed:", error);
      if (error?.code === "auth/user-not-found") {
        setStatusMessage(t("login.errors.userNotFound"));
        return;
      }
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setStatusMessage(t("login.errors.wrongPassword"));
        return;
      }
      if (error?.code === "auth/invalid-email") {
        setStatusMessage(t("login.errors.invalidEmail"));
        return;
      }
      if (error?.code === "auth/too-many-requests") {
        setStatusMessage(t("login.errors.tooManyRequests"));
        return;
      }
      setStatusMessage(t("login.errors.loginFailed"));
    } finally {
      setProcessingLink(false);
      setStatus(null);
    }
  };

  const handleEmployeeSignIn = async (event) => {
    event.preventDefault();
    if (!auth) return;
    setStatusMessage(null);
    // Employee login should prefer workspace entry-point while member guard resolves.
    setPostAuthRedirectTarget("/booking");
    setStatus({
      type: "success",
      message: t("login.status.signingIn"),
    });
    setProcessingLink(true);

    const formData = new FormData(event.currentTarget);
    const usernameInput = normalizeTeamLoginUsername(
      (formData.get("employeeUsername") || employeeUsername || "").toString()
    );
    const passwordInput = (formData.get("employeePassword") || "").toString();
    setEmployeeUsername(usernameInput);

    try {
      if (!usernameInput) {
        setStatusMessage(t("login.errors.employeeUsernameRequired"));
        return;
      }
      if (!passwordInput) {
        setStatusMessage(t("login.errors.emailPasswordRequired"));
        return;
      }

      const authEmail = buildTeamLoginEmail(usernameInput);
      if (!authEmail) {
        setStatusMessage(t("login.errors.employeeUsernameRequired"));
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, authEmail, passwordInput);
      console.info("[EMPLOYEE LOGIN] employee sign-in success", {
        uid: credential?.user?.uid || null,
        email: credential?.user?.email || null,
        loginMethod: "employee",
        username: usernameInput,
      });
      const memberGuard = await ensureMemberWorkspaceGuard(credential.user, {
        context: "employee-login",
      });
      console.info("[MEMBER GUARD] employee-login guard result", {
        uid: credential?.user?.uid || null,
        username: usernameInput,
        result: memberGuard,
      });
      if (memberGuard?.isMember && memberGuard?.workspace?.clinicId) {
        setPostAuthRedirectTarget("/booking");
      } else {
        setPostAuthRedirectTarget("/welcome");
      }
      await persistUserProfile(credential.user);
      try {
        const workspace = await resolveWorkspaceContext(credential.user);
        console.info("[WORKSPACE RESOLVE] employee login explicit resolve result", {
          uid: credential?.user?.uid || null,
          workspace,
        });
      } catch (syncError) {
        console.error("[SignUp] Failed to resolve employee workspace:", syncError);
      }
      await redirectAfterAuth(credential.user);
    } catch (error) {
      console.error("[SignUp] employee login failed:", error);
      if (error?.code === "auth/user-not-found") {
        setStatusMessage(t("login.errors.userNotFound"));
        return;
      }
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setStatusMessage(t("login.errors.wrongPassword"));
        return;
      }
      if (error?.code === "auth/too-many-requests") {
        setStatusMessage(t("login.errors.tooManyRequests"));
        return;
      }
      setStatusMessage(t("login.errors.employeeLoginFailed"));
    } finally {
      setProcessingLink(false);
      setStatus(null);
    }
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    if (!auth) return;
    setStatusMessage(null);
    setPostAuthRedirectTarget("/welcome");
    setStatus({
      type: "success",
      message: t("login.status.signingIn"),
    });
    setProcessingLink(true);
    const formData = new FormData(event.currentTarget);
    const emailInput = ((formData.get("email") || "").toString().trim() || lastEmail).trim();
    const formPassword = (formData.get("password") || "").toString();
    const confirmPassword = (formData.get("confirmPassword") || "").toString();
    setLastEmail(emailInput);

    try {
      if (!emailInput || !formPassword || !confirmPassword) {
        setStatusMessage(t("login.errors.signupFieldsRequired"));
        return;
      }
      if (formPassword !== confirmPassword) {
        setStatusMessage(t("login.errors.passwordMismatch"));
        return;
      }

      const methods = await fetchSignInMethodsForEmail(auth, emailInput);
      if (methods.length > 0) {
        setStatusMessage(t("login.errors.emailInUse"));
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, emailInput, formPassword);

      await persistUserProfile(credential.user);
      await redirectAfterAuth(credential.user);
    } catch (error) {
      console.error("[SignUp] create account failed:", error);
      if (error?.code === "auth/weak-password") {
        setStatusMessage(t("login.errors.weakPassword"));
        return;
      }
      if (error?.code === "auth/invalid-email") {
        setStatusMessage(t("login.errors.invalidEmail"));
        return;
      }
      if (error?.code === "auth/email-already-in-use") {
        setStatusMessage(t("login.errors.emailInUse"));
        return;
      }
      setStatusMessage(t("login.errors.signupFailed"));
    } finally {
      setProcessingLink(false);
      setStatus(null);
    }
  };

  const handleResetPassword = async () => {
    if (!auth) return;
    if (authMode !== "login") return;
    const emailFromField = (document.querySelector('input[name="email"]')?.value || "").toString().trim();
    const emailInput = (emailFromField || lastEmail || "").trim();
    if (!emailInput) {
      setStatusMessage(t("login.errors.resetMissingEmail"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setStatusMessage(t("login.errors.invalidEmail"));
      return;
    }
    setLastEmail(emailInput);
    try {
      await sendPasswordResetEmail(auth, emailInput);
      setStatusMessage(t("login.status.resetSent"));
    } catch (error) {
      console.error("[SignUp] reset password failed:", error);
      if (error?.code === "auth/user-not-found") {
        setStatusMessage(t("login.errors.userNotFound"));
        return;
      }
      if (error?.code === "auth/invalid-email") {
        setStatusMessage(t("login.errors.invalidEmail"));
        return;
      }
      setStatusMessage(t("login.errors.resetFailed"));
    }
  };

  return (
    <div className="signup-page">
      <section className="signup-auth-wrapper" aria-busy={sending || processingLink}>
        <div className="signup-logo-chip">
          <Link to="/" aria-label={t("login.aria.backHome")}>
            <span className="signup-back-link">
              <ArrowLeft className="signup-back-link__icon" aria-hidden="true" />
              <span>{t("common.back")}</span>
            </span>
          </Link>
        </div>
        <SignInPage
          heroImageSrc={getPublicAssetUrl("hero/pexels-yankrukov-5794028.jpg")}
          testimonials={[]}
          statusMessage={statusMessage}
          authMode={authMode}
          onAuthModeChange={setAuthMode}
          loginMethod={loginMethod}
          onLoginMethodChange={setLoginMethod}
          phoneNumber={phoneNumber}
          smsCode={smsCode}
          employeeUsername={employeeUsername}
          phoneStep={phoneStep}
          onPhoneNumberChange={handlePhoneNumberChange}
          onSmsCodeChange={handleSmsCodeChange}
          onEmployeeUsernameChange={handleEmployeeUsernameChange}
          onSendCode={handleSendCode}
          onConfirmCode={handleConfirmCode}
          onEmployeeSignIn={handleEmployeeSignIn}
          onSignIn={handleEmailPasswordSignIn}
          onSignUpSubmit={handleCreateAccount}
          onGoogleSignIn={handleGoogleSignIn}
          onResetPassword={handleResetPassword}
        />
        {status && (
          <p className={`signup-status ${status.type}`} style={{ maxWidth: '480px', margin: '1rem auto' }}>
            {status.message}
          </p>
        )}
      </section>
    </div>
  );
}

export default SignUp;
