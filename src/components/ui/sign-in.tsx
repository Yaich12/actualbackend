import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../../unAuth/language/LanguageProvider';

// Reusable shadcn-style UI sits in this folder for consistency across pages.

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
    </svg>
);

export interface Testimonial {
  avatarSrc: string;
  avatarAlt?: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  statusMessage?: React.ReactNode;
  authMode?: "login" | "signup";
  onAuthModeChange?: (mode: "login" | "signup") => void;
  loginMethod?: "email" | "phone" | "employee";
  onLoginMethodChange?: (method: "email" | "phone" | "employee") => void;
  phoneNumber?: string;
  smsCode?: string;
  employeeUsername?: string;
  phoneStep?: "enterPhone" | "enterCode";
  onPhoneNumberChange?: (value: string) => void;
  onSmsCodeChange?: (value: string) => void;
  onEmployeeUsernameChange?: (value: string) => void;
  onSendCode?: () => void;
  onConfirmCode?: () => void;
  onEmployeeSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onSignUpSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onLoginLink?: () => void;
  onSignUp?: () => void;
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border/80 bg-white/60 backdrop-blur-sm transition-all focus-within:border-primary/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial, delay: string }) => {
  const { t } = useLanguage();

  return (
    <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-card/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/10 p-5 w-64`}>
      <img
        src={testimonial.avatarSrc}
        className="h-10 w-10 object-cover rounded-2xl"
        alt={testimonial.avatarAlt || t("login.testimonials.avatarAlt")}
      />
      <div className="text-sm leading-snug">
        <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
        <p className="text-muted-foreground">{testimonial.handle}</p>
        <p className="mt-1 text-foreground/80">{testimonial.text}</p>
      </div>
    </div>
  );
};

export const SignInPage: React.FC<SignInPageProps> = ({
  title,
  description,
  heroImageSrc,
  testimonials = [],
  statusMessage,
  authMode,
  onAuthModeChange,
  loginMethod,
  onLoginMethodChange,
  phoneNumber = "",
  smsCode = "",
  employeeUsername = "",
  phoneStep = "enterPhone",
  onPhoneNumberChange,
  onSmsCodeChange,
  onEmployeeUsernameChange,
  onSendCode,
  onConfirmCode,
  onEmployeeSignIn,
  onSignIn,
  onSignUpSubmit,
  onGoogleSignIn,
  onResetPassword,
  onLoginLink,
  onSignUp,
}) => {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const activeMethod = loginMethod || "email";
  const activeAuthMode = authMode || "login";
  const isSignUpMode = activeAuthMode === "signup";
  const showMethodToggle = typeof onLoginMethodChange === "function";
  const resolvedTitle = title || t("login.title");
  const resolvedDescription = description || t("login.description");

  const handleAuthModeChange = (nextMode: "login" | "signup") => {
    if (typeof onAuthModeChange === "function") {
      onAuthModeChange(nextMode);
      return;
    }
    if (nextMode === "login") {
      onLoginLink?.();
      return;
    }
    onSignUp?.();
  };

  const handleEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (isSignUpMode) {
      onSignUpSubmit?.(event);
      return;
    }
    onSignIn?.(event);
  };

  const showAuthModeButtons =
    typeof onAuthModeChange === "function" ||
    typeof onLoginLink === "function" ||
    typeof onSignUp === "function";

  return (
    <div className="min-h-[100dvh] flex w-full flex-col bg-background text-foreground md:flex-row font-geist">
      {/* Left column: sign-in form */}
      <section className="flex flex-1 items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-5 rounded-[26px] border border-border/70 bg-background/70 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.45)] backdrop-blur-md sm:p-7">
            {showAuthModeButtons ? (
              <div className="animate-element animate-delay-100 flex items-center gap-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                <button
                  type="button"
                  onClick={() => handleAuthModeChange("login")}
                  className={`transition-colors ${
                    activeAuthMode === "login"
                      ? "text-foreground"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  {t("login.form.loginLink")}
                </button>
                <span className="text-foreground/35">/</span>
                <button
                  type="button"
                  onClick={() => handleAuthModeChange("signup")}
                  className={`transition-colors ${
                    activeAuthMode === "signup"
                      ? "text-foreground"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  {t("login.form.signUpLink")}
                </button>
              </div>
            ) : (
              <h1 className="animate-element animate-delay-100 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {resolvedTitle}
              </h1>
            )}
            <p className="animate-element animate-delay-200 text-sm leading-6 text-muted-foreground">
              {resolvedDescription}
            </p>

            <div className="space-y-4">
              {showMethodToggle && (
                <div className="animate-element animate-delay-300">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">
                    {t("login.form.methodLabel")}
                  </label>
                  <div className="mt-2 flex rounded-2xl border border-border/80 bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => onLoginMethodChange?.("email")}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        activeMethod === "email"
                          ? "border-border/70 bg-background text-foreground shadow-sm"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("login.form.methodEmail")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoginMethodChange?.("phone")}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        activeMethod === "phone"
                          ? "border-border/70 bg-background text-foreground shadow-sm"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("login.form.methodPhone")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoginMethodChange?.("employee")}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        activeMethod === "employee"
                          ? "border-border/70 bg-background text-foreground shadow-sm"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("login.form.methodEmployee")}
                    </button>
                  </div>
                </div>
              )}

              {activeMethod === "email" ? (
                <form className="space-y-4" onSubmit={handleEmailSubmit}>
                  <div className="animate-element animate-delay-300">
                    <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                      {t("login.form.emailLabel")}
                    </label>
                    <GlassInputWrapper>
                      <input
                        name="email"
                        type="email"
                        placeholder={t("login.form.emailPlaceholder")}
                        className="w-full rounded-2xl bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                      />
                    </GlassInputWrapper>
                  </div>

                  <div className="animate-element animate-delay-400">
                    <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                      {t("login.form.passwordLabel")}
                    </label>
                    <GlassInputWrapper>
                      <div className="relative">
                        <input
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("login.form.passwordPlaceholder")}
                          className="w-full rounded-2xl bg-transparent px-4 py-3.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-3 flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                          ) : (
                            <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                          )}
                        </button>
                      </div>
                    </GlassInputWrapper>
                  </div>
                  {isSignUpMode && (
                    <div className="animate-element animate-delay-500">
                      <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                        {t("login.form.confirmPasswordLabel")}
                      </label>
                      <GlassInputWrapper>
                        <input
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("login.form.confirmPasswordPlaceholder")}
                          className="w-full rounded-2xl bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                        />
                      </GlassInputWrapper>
                    </div>
                  )}
                  {statusMessage && (
                    <p
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl border border-blue-200/80 bg-blue-50/85 px-3 py-2 text-sm text-blue-900"
                    >
                      {statusMessage}
                    </p>
                  )}

                  {!isSignUpMode && (
                    <div className="animate-element animate-delay-600 flex items-center justify-between gap-3 text-sm">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="rememberMe"
                          className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-foreground/90">{t("login.form.remember")}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => onResetPassword?.()}
                        className="text-primary/80 transition-colors hover:text-primary hover:underline"
                      >
                        {t("login.form.resetPassword")}
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="animate-element animate-delay-700 w-full rounded-2xl bg-primary py-3.5 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {isSignUpMode ? t("login.form.signUpLink") : t("login.form.signIn")}
                  </button>
                </form>
              ) : activeMethod === "phone" ? (
                <div className="space-y-4">
                  <div className="animate-element animate-delay-300">
                    <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                      {t("login.form.phoneLabel")}
                    </label>
                    <GlassInputWrapper>
                      <input
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        pattern="^\\+\\d{8,15}$"
                        placeholder={t("login.form.phonePlaceholder")}
                        value={phoneNumber}
                        onChange={(event) => onPhoneNumberChange?.(event.target.value)}
                        readOnly={!onPhoneNumberChange}
                        className="w-full rounded-2xl bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                      />
                    </GlassInputWrapper>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("login.form.phoneHelper")}
                    </p>
                    {statusMessage && (
                      <p
                        role="alert"
                        aria-live="assertive"
                        className="mt-2 rounded-xl border border-blue-200/80 bg-blue-50/85 px-3 py-2 text-sm text-blue-900"
                      >
                        {statusMessage}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onSendCode}
                    disabled={!onSendCode}
                    className="animate-element animate-delay-400 w-full rounded-2xl bg-primary py-3.5 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("login.form.sendCode")}
                  </button>

                  <div className="animate-element animate-delay-500">
                    <div id="recaptcha-container" className="min-h-[78px]" />
                  </div>

                  {phoneStep === "enterCode" && (
                    <>
                      <div className="animate-element animate-delay-600">
                        <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                          {t("login.form.smsCodeLabel")}
                        </label>
                        <GlassInputWrapper>
                          <input
                            name="smsCode"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder={t("login.form.smsCodePlaceholder")}
                            value={smsCode}
                            onChange={(event) => onSmsCodeChange?.(event.target.value)}
                            readOnly={!onSmsCodeChange}
                            className="w-full rounded-2xl bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                          />
                        </GlassInputWrapper>
                      </div>
                      <button
                        type="button"
                        onClick={onConfirmCode}
                        disabled={!onConfirmCode}
                        className="animate-element animate-delay-700 w-full rounded-2xl bg-primary py-3.5 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("login.form.confirmCode")}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <form className="space-y-4" onSubmit={onEmployeeSignIn}>
                  <div className="animate-element animate-delay-300">
                    <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                      {t("login.form.usernameLabel")}
                    </label>
                    <GlassInputWrapper>
                      <input
                        name="employeeUsername"
                        type="text"
                        autoComplete="username"
                        placeholder={t("login.form.usernamePlaceholder")}
                        value={employeeUsername}
                        onChange={(event) => onEmployeeUsernameChange?.(event.target.value)}
                        readOnly={!onEmployeeUsernameChange}
                        className="w-full rounded-2xl bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                      />
                    </GlassInputWrapper>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("login.form.employeeHelper")}
                    </p>
                  </div>

                  <div className="animate-element animate-delay-400">
                    <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                      {t("login.form.passwordLabel")}
                    </label>
                    <GlassInputWrapper>
                      <div className="relative">
                        <input
                          name="employeePassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder={t("login.form.passwordPlaceholder")}
                          className="w-full rounded-2xl bg-transparent px-4 py-3.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-3 flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                          ) : (
                            <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                          )}
                        </button>
                      </div>
                    </GlassInputWrapper>
                  </div>

                  {statusMessage && (
                    <p
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl border border-blue-200/80 bg-blue-50/85 px-3 py-2 text-sm text-blue-900"
                    >
                      {statusMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="animate-element animate-delay-700 w-full rounded-2xl bg-primary py-3.5 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {t("login.form.signIn")}
                  </button>
                </form>
              )}
            </div>

            <div className="animate-element animate-delay-700 relative flex items-center justify-center">
              <span className="w-full border-t border-border/80"></span>
              <span className="absolute rounded-full border border-border/70 bg-background px-3 py-0.5 text-xs font-medium text-muted-foreground">
                {t("login.form.orContinue")}
              </span>
            </div>

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-border/80 bg-white/70 py-3.5 text-sm font-medium transition-colors hover:bg-muted/40"
            >
                <GoogleIcon />
                {t("login.form.google")}
            </button>

          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }}></div>
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
              {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" /></div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
