"use client";

import React, {
  Children,
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, type Transition, type Variants } from "framer-motion";
import { useInView, type UseInViewOptions } from "framer-motion";
import confetti from "canvas-confetti";
import type { CreateTypes as ConfettiInstance, GlobalOptions as ConfettiGlobalOptions, Options as ConfettiOptions } from "canvas-confetti";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Gem, Github, Globe, Loader, Lock, Mail, PartyPopper, X } from "lucide-react";
import { cn } from "lib/utils";

type Api = { fire: (options?: ConfettiOptions) => void };
export type ConfettiRef = Api | null;

const ConfettiContext = createContext<Api>({} as Api);

const Confetti = forwardRef<
  ConfettiRef,
  React.ComponentPropsWithRef<"canvas"> & {
    options?: ConfettiOptions;
    globalOptions?: ConfettiGlobalOptions;
    manualstart?: boolean;
  }
>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, ...rest } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);

  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
      } else if (instanceRef.current) {
        instanceRef.current.reset();
        instanceRef.current = null;
      }
    },
    [globalOptions],
  );

  const fire = useCallback(
    (opts: ConfettiOptions = {}) => instanceRef.current?.({ ...options, ...opts }),
    [options],
  );

  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) fire();
  }, [manualstart, fire]);

  return <canvas ref={canvasRef} {...rest} />;
});

Confetti.displayName = "Confetti";

type TextLoopProps = {
  children: React.ReactNode[];
  className?: string;
  interval?: number;
  transition?: Transition;
  variants?: Variants;
  onIndexChange?: (index: number) => void;
  stopOnEnd?: boolean;
};

export function TextLoop({
  children,
  className,
  interval = 2,
  transition = { duration: 0.3 },
  variants,
  onIndexChange,
  stopOnEnd = false,
}: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);

  useEffect(() => {
    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        if (stopOnEnd && current === items.length - 1) {
          clearInterval(timer);
          return current;
        }
        const next = (current + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, stopOnEnd]);

  const motionVariants: Variants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  };

  return (
    <div className={cn("relative inline-block whitespace-nowrap", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentIndex}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          variants={variants || motionVariants}
        >
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: { hidden: { y: number }; visible: { y: number } };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: UseInViewOptions["margin"];
  blur?: string;
}

function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = true,
  inViewMargin = "-50px",
  blur = "6px",
}: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isInView = !inView || inViewResult;

  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: "blur(0px)" },
  };

  const combinedVariants = variant || defaultVariants;

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      exit="hidden"
      variants={combinedVariants}
      transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const glassButtonVariants = cva("relative isolate all-unset cursor-pointer rounded-full transition-all", {
  variants: {
    size: {
      default: "text-base font-medium",
      sm: "text-sm font-medium",
      lg: "text-lg font-medium",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: { size: "default" },
});

const glassButtonTextVariants = cva("glass-button-text relative block select-none tracking-tighter", {
  variants: {
    size: {
      default: "px-6 py-3.5",
      sm: "px-4 py-2",
      lg: "px-8 py-4",
      icon: "flex h-10 w-10 items-center justify-center",
    },
  },
  defaultVariants: { size: "default" },
});

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, onClick, disabled, ...props }, ref) => {
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const button = e.currentTarget.querySelector("button");
      if (button && e.target !== button) button.click();
    };

    return (
      <div
        className={cn(
          "glass-button-wrap cursor-pointer rounded-full relative",
          disabled && "opacity-60 cursor-not-allowed pointer-events-none",
          className,
        )}
        onClick={handleWrapperClick}
      >
        <button
          className={cn("glass-button relative z-10", glassButtonVariants({ size }))}
          ref={ref}
          onClick={onClick}
          disabled={disabled}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
        </button>
        <div className="glass-button-shadow rounded-full pointer-events-none" />
      </div>
    );
  },
);

GlassButton.displayName = "GlassButton";

const GradientBackground = () => (
  <>
    <style>
      {`@keyframes float1{0%{transform:translate(0,0)}50%{transform:translate(-10px,10px)}100%{transform:translate(0,0)}}@keyframes float2{0%{transform:translate(0,0)}50%{transform:translate(10px,-10px)}100%{transform:translate(0,0)}}`}
    </style>
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className="absolute top-0 left-0 w-full h-full"
    >
      <defs>
        <linearGradient id="rev_grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--color-primary)", stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: "var(--color-chart-3)", stopOpacity: 0.6 }} />
        </linearGradient>
        <linearGradient id="rev_grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--color-chart-4)", stopOpacity: 0.9 }} />
          <stop offset="50%" style={{ stopColor: "var(--color-secondary)", stopOpacity: 0.7 }} />
          <stop offset="100%" style={{ stopColor: "var(--color-chart-1)", stopOpacity: 0.6 }} />
        </linearGradient>
        <radialGradient id="rev_grad3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: "var(--color-destructive)", stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: "var(--color-chart-5)", stopOpacity: 0.4 }} />
        </radialGradient>
        <filter id="rev_blur1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="35" />
        </filter>
        <filter id="rev_blur2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="25" />
        </filter>
        <filter id="rev_blur3" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="45" />
        </filter>
      </defs>
      <g style={{ animation: "float1 20s ease-in-out infinite" }}>
        <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#rev_grad1)" filter="url(#rev_blur1)" transform="rotate(-30 200 500)" />
        <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#rev_grad2)" filter="url(#rev_blur2)" transform="rotate(15 650 225)" />
      </g>
      <g style={{ animation: "float2 25s ease-in-out infinite" }}>
        <circle cx="650" cy="450" r="150" fill="url(#rev_grad3)" filter="url(#rev_blur3)" opacity="0.7" />
        <ellipse cx="50" cy="150" rx="180" ry="120" fill="var(--color-accent)" filter="url(#rev_blur2)" opacity="0.8" />
      </g>
    </svg>
  </>
);

const GoogleBrandIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
    <path fill="#EA4335" d="M12 11v3.6h5.09c-.22 1.18-1.37 3.46-5.09 3.46-3.07 0-5.58-2.54-5.58-5.69S8.93 6.68 12 6.68c1.75 0 2.93.74 3.6 1.38l2.45-2.36C16.44 4.1 14.43 3.2 12 3.2 6.9 3.2 2.7 7.41 2.7 12.5c0 5.1 4.2 9.3 9.3 9.3 5.36 0 8.9-3.77 8.9-9.07 0-.61-.06-1.07-.13-1.53H12Z" />
  </svg>
);

const GitHubIcon = () => <Github className="h-5 w-5 text-slate-800" aria-hidden="true" />;

const modalSteps = [
  { message: "Signing you up...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
  { message: "Onboarding you...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
  { message: "Finalizing...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
  { message: "Welcome Aboard!", icon: <PartyPopper className="w-12 h-12 text-green-500" /> },
];

const TEXT_LOOP_INTERVAL = 1.5;

const DefaultLogo = () => (
  <div className="bg-primary text-primary-foreground rounded-md p-1.5">
    <Gem className="h-4 w-4" />
  </div>
);

interface AuthComponentProps {
  logo?: React.ReactNode;
  brandName?: string;
  onGoogleSignIn?: () => Promise<void> | void;
  onEmailSubmit?: (payload: { email: string; password: string; confirmPassword: string }) => Promise<void> | void;
  isProcessing?: boolean;
}

export const AuthComponent = ({
  logo = <DefaultLogo />,
  brandName = "EaseMize",
  onGoogleSignIn,
  onEmailSubmit,
  isProcessing = false,
}: AuthComponentProps) => {
  const [email, setEmailValue] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authStep, setAuthStep] = useState<"email" | "password" | "confirmPassword">("email");
  const [modalStatus, setModalStatus] = useState<"closed" | "loading" | "error" | "success">("closed");
  const [modalErrorMessage, setModalErrorMessage] = useState("");

  const confettiRef = useRef<ConfettiRef>(null);

  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = confirmPassword.length >= 6;

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  const fireSideCanons = () => {
    const fire = confettiRef.current?.fire;
    if (fire) {
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
      const particleCount = 50;
      fire({ ...defaults, particleCount, origin: { x: 0, y: 1 }, angle: 60 });
      fire({ ...defaults, particleCount, origin: { x: 1, y: 1 }, angle: 120 });
    }
  };

  const handleGoogleClick = () => {
    if (isProcessing) return;
    onGoogleSignIn?.();
  };

  const submitEmail = async () => {
    if (!onEmailSubmit) return;
    setModalStatus("loading");
    try {
      await onEmailSubmit({ email, password, confirmPassword });
      fireSideCanons();
      setModalStatus("success");
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : "Unable to finish sign up.");
      setModalStatus("error");
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalStatus === "loading" || authStep !== "confirmPassword" || isProcessing) return;
    if (password !== confirmPassword) {
      setModalErrorMessage("Passwords do not match!");
      setModalStatus("error");
    } else {
      if (onEmailSubmit) {
        await submitEmail();
      } else {
        setModalStatus("loading");
        const loadingStepsCount = modalSteps.length - 1;
        const totalDuration = loadingStepsCount * TEXT_LOOP_INTERVAL * 1000;
        setTimeout(() => {
          fireSideCanons();
          setModalStatus("success");
        }, totalDuration);
      }
    }
  };

  const handleProgressStep = async () => {
    if (authStep === "email" && isEmailValid) {
      if (onEmailSubmit) {
        await submitEmail();
      } else {
        setAuthStep("password");
      }
    } else if (authStep === "password" && isPasswordValid) {
      setAuthStep("confirmPassword");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleProgressStep();
    }
  };

  const handleGoBack = () => {
    if (authStep === "confirmPassword") {
      setAuthStep("password");
      setConfirmPassword("");
    } else if (authStep === "password") {
      setAuthStep("email");
    }
  };

  const closeModal = () => {
    setModalStatus("closed");
    setModalErrorMessage("");
  };

  useEffect(() => {
    if (authStep === "password") {
      setTimeout(() => passwordInputRef.current?.focus(), 500);
    } else if (authStep === "confirmPassword") {
      setTimeout(() => confirmPasswordInputRef.current?.focus(), 500);
    }
  }, [authStep]);

  useEffect(() => {
    if (modalStatus === "success") {
      fireSideCanons();
    }
  }, [modalStatus]);

  const Modal = () => (
    <AnimatePresence>
      {modalStatus !== "closed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-card/80 border-4 border-border rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-2"
          >
            {(modalStatus === "error" || modalStatus === "success") && (
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {modalStatus === "error" && (
              <>
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-lg font-medium text-foreground">{modalErrorMessage}</p>
                <GlassButton onClick={closeModal} size="sm" className="mt-4">
                  Try Again
                </GlassButton>
              </>
            )}
            {modalStatus === "loading" && (
              <TextLoop interval={TEXT_LOOP_INTERVAL} stopOnEnd>
                {modalSteps.slice(0, -1).map((step, i) => (
                  <div key={i} className="flex flex-col items-center gap-4">
                    {step.icon}
                    <p className="text-lg font-medium text-foreground">{step.message}</p>
                  </div>
                ))}
              </TextLoop>
            )}
            {modalStatus === "success" && (
              <div className="flex flex-col items-center gap-4">
                {modalSteps[modalSteps.length - 1].icon}
                <p className="text-lg font-medium text-foreground">{modalSteps[modalSteps.length - 1].message}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const disableInteractions = isProcessing || modalStatus === "loading";

  return (
    <div className="bg-background min-h-screen w-screen flex flex-col">
      <style>{`input[type=password]::-ms-reveal,input[type=password]::-ms-clear{display:none!important}input[type=password]::-webkit-credentials-auto-fill-button,input[type=password]::-webkit-strong-password-auto-fill-button{display:none!important}input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{-webkit-box-shadow:0 0 0 30px transparent inset!important;-webkit-text-fill-color:var(--foreground)!important;background-color:transparent!important;background-clip:content-box!important;transition:background-color 5000s ease-in-out 0s!important;color:var(--foreground)!important;caret-color:var(--foreground)!important}input:autofill{background-color:transparent!important;background-clip:content-box!important;-webkit-text-fill-color:var(--foreground)!important;color:var(--foreground)!important}input:-internal-autofill-selected{background-color:transparent!important;background-image:none!important;color:var(--foreground)!important;-webkit-text-fill-color:var(--foreground)!important}input:-webkit-autofill::first-line{color:var(--foreground)!important;-webkit-text-fill-color:var(--foreground)!important}`}</style>
      <Confetti ref={confettiRef} manualstart className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]" />
      <Modal />
      <div className={cn("fixed top-4 left-4 z-20 flex items-center gap-2", "md:left-1/2 md:-translate-x-1/2")}>
        {logo}
        <h1 className="text-base font-bold text-foreground">{brandName}</h1>
      </div>
      <div className={cn("flex w-full flex-1 h-full items-center justify-center bg-card", "relative overflow-hidden")}>
        <div className="absolute inset-0 z-0">
          <GradientBackground />
        </div>
        <fieldset className="relative z-10 flex flex-col items-center gap-8 w-[280px] mx-auto p-4">
          <AnimatePresence mode="wait">
            {authStep === "email" && (
              <motion.div
                key="email-content"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full flex flex-col items-center gap-4"
              >
                <BlurFade delay={0.25 * 1} className="w-full">
                  <div className="text-center">
                    <p className="font-serif font-light text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground whitespace-nowrap">
                      Get started with us
                    </p>
                  </div>
                </BlurFade>
                <BlurFade delay={0.25 * 2}>
                  <p className="text-sm font-medium text-muted-foreground">Continue with</p>
                </BlurFade>
                <BlurFade delay={0.25 * 3}>
                  <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                    <button
                      type="button"
                      onClick={handleGoogleClick}
                      disabled={disableInteractions}
                      className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-full border border-white/70 bg-white px-6 py-3 text-base font-semibold text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.18)] disabled:translate-y-0 disabled:shadow-none disabled:opacity-60"
                    >
                      <GoogleBrandIcon />
                      <span>Google</span>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-full border border-white/70 bg-white px-6 py-3 text-base font-semibold text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.1)]"
                    >
                      <GitHubIcon />
                      <span>GitHub</span>
                    </button>
                  </div>
                </BlurFade>
                <BlurFade delay={0.25 * 4} className="w-[300px]">
                  <div className="flex items-center w-full gap-2 py-2">
                    <hr className="w-full border-border" />
                    <span className="text-xs font-semibold text-muted-foreground">OR</span>
                    <hr className="w-full border-border" />
                  </div>
                </BlurFade>
              </motion.div>
            )}

            {authStep === "password" && (
              <motion.div
                key="password-title"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full flex flex-col items-center text-center gap-4"
              >
                <BlurFade delay={0} className="w-full">
                  <div className="text-center">
                    <p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-foreground whitespace-nowrap">
                      Create your password
                    </p>
                  </div>
                </BlurFade>
                <BlurFade delay={0.25}>
                  <p className="text-sm font-medium text-muted-foreground">Your password must be at least 6 characters.</p>
                </BlurFade>
              </motion.div>
            )}

            {authStep === "confirmPassword" && (
              <motion.div
                key="confirm-title"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full flex flex-col items-center text-center gap-4"
              >
                <BlurFade delay={0} className="w-full">
                  <div className="text-center">
                    <p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-foreground whitespace-nowrap">
                      One last step
                    </p>
                  </div>
                </BlurFade>
                <BlurFade delay={0.25}>
                  <p className="text-sm font-medium text-muted-foreground">Confirm your password to continue.</p>
                </BlurFade>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleFinalSubmit} className="w-[300px] space-y-6">
            <AnimatePresence>
              {authStep !== "confirmPassword" && (
                <motion.div
                  key="email-password-fields"
                  exit={{ opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="w-full space-y-6"
                >
                  <BlurFade delay={authStep === "email" ? 0.25 * 5 : 0} inView className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {authStep === "password" && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.4 }}
                            className="absolute -top-6 left-4 z-10"
                          >
                            <label className="text-xs text-muted-foreground font-semibold">Email</label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="w-full">
                        <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.12)] backdrop-blur">
                          <Mail className="h-5 w-5 text-slate-500" />
                          <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmailValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void handleProgressStep();
                            }}
                            disabled={!isEmailValid || disableInteractions}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-slate-900 to-slate-700 text-white shadow-[0_12px_24px_rgba(15,23,42,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                            aria-label="Continue with email"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </BlurFade>

                  <AnimatePresence>
                    {authStep === "password" && (
                      <BlurFade key="password-field" className="w-full">
                        <div className="relative w-full">
                          <AnimatePresence>
                            {password.length > 0 && (
                              <motion.div
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.3 }}
                                className="absolute -top-6 left-4 z-10"
                              >
                                <label className="text-xs text-muted-foreground font-semibold">Password</label>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="glass-input-wrap w-full">
                            <div className="glass-input">
                              <span className="glass-input-text-area" />
                              <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                {isPasswordValid ? (
                                  <button
                                    type="button"
                                    aria-label="Toggle password visibility"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-full"
                                  >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                  </button>
                                ) : (
                                  <Lock className="h-5 w-5 text-foreground/80 flex-shrink-0" />
                                )}
                              </div>
                              <input
                                ref={passwordInputRef}
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                              />
                              <div
                                className={cn(
                                  "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
                                  isPasswordValid ? "w-10 pr-1" : "w-0",
                                )}
                              >
                                <GlassButton
                                  type="button"
                                  onClick={handleProgressStep}
                                  size="icon"
                                  aria-label="Submit password"
                                  contentClassName="text-foreground/80 hover:text-foreground"
                                  disabled={disableInteractions}
                                >
                                  <ArrowRight className="w-5 h-5" />
                                </GlassButton>
                              </div>
                            </div>
                          </div>
                        </div>
                        <BlurFade inView delay={0.2}>
                          <button
                            type="button"
                            onClick={handleGoBack}
                            className="mt-4 flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                          >
                            <ArrowLeft className="w-4 h-4" /> Go back
                          </button>
                        </BlurFade>
                      </BlurFade>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {authStep === "confirmPassword" && (
                <BlurFade key="confirm-password-field" className="w-full">
                  <div className="relative w-full">
                    <AnimatePresence>
                      {confirmPassword.length > 0 && (
                        <motion.div
                          initial={{ y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="absolute -top-6 left-4 z-10"
                        >
                          <label className="text-xs text-muted-foreground font-semibold">Confirm Password</label>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="glass-input-wrap w-[300px]">
                      <div className="glass-input">
                        <span className="glass-input-text-area" />
                        <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                          {isConfirmPasswordValid ? (
                            <button
                              type="button"
                              aria-label="Toggle confirm password visibility"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-full"
                            >
                              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          ) : (
                            <Lock className="h-5 w-5 text-foreground/80 flex-shrink-0" />
                          )}
                        </div>
                        <input
                          ref={confirmPasswordInputRef}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                        />
                        <div
                          className={cn(
                            "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
                            isConfirmPasswordValid ? "w-10 pr-1" : "w-0",
                          )}
                        >
                          <GlassButton
                            type="submit"
                            size="icon"
                            aria-label="Finish sign-up"
                            contentClassName="text-foreground/80 hover:text-foreground"
                            disabled={disableInteractions}
                          >
                            <ArrowRight className="w-5 h-5" />
                          </GlassButton>
                        </div>
                      </div>
                    </div>
                  </div>
                  <BlurFade inView delay={0.2}>
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className="mt-4 flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Go back
                    </button>
                  </BlurFade>
                </BlurFade>
              )}
            </AnimatePresence>
          </form>
        </fieldset>
      </div>
    </div>
  );
};

export default AuthComponent;

