"use client";

import { Card, CardContent, CardHeader } from "components/ui/card";
import { TimelineContent } from "components/ui/timeline-animation";
import { VerticalCutReveal } from "components/ui/vertical-cut-reveal";
import NumberFlow from "@number-flow/react";
import { CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { getIdToken } from "../../utils/auth";
import { setPostAuthRedirectTarget } from "../../utils/postAuthRedirect";
import { useLanguage } from "../../unAuth/language/LanguageProvider";

const PLAN_CONFIG = [
  {
    id: "starter",
    priceByLanguage: { da: 499, en: 75 },
    buttonVariant: "outline" as const,
    checkoutPlan: "solo" as const,
  },
  {
    id: "business",
    priceByLanguage: { da: 799, en: 119 },
    buttonVariant: "default" as const,
    popular: true,
    checkoutPlan: "duo" as const,
  },
  {
    id: "enterprise",
    priceByLanguage: null,
    price: null,
    buttonVariant: "outline" as const,
    checkoutPlan: null,
  },
];

type PricingSectionProps = {
  mode?: "marketing" | "subscribe";
  initialPlan?: "solo" | "duo" | null;
  disableCheckout?: boolean;
};

export default function PricingSection5({
  mode = "marketing",
  initialPlan = null,
  disableCheckout = false,
}: PricingSectionProps) {
  const { t, getArray, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pricingRef = useRef<HTMLDivElement>(null);
  const [activeCheckoutPlan, setActiveCheckoutPlan] = useState<"solo" | "duo" | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"solo" | "duo" | null>(initialPlan);
  const isDanish = language === "da";
  const currencyPrefix = isDanish ? "" : "$";
  const currencySuffix = isDanish ? " DKK" : "";
  const plans = PLAN_CONFIG.map((plan) => ({
    ...plan,
    price:
      plan.priceByLanguage && typeof plan.priceByLanguage === "object"
        ? (isDanish ? plan.priceByLanguage.da : plan.priceByLanguage.en)
        : plan.price,
    name: t(`pricing.plans.${plan.id}.name`),
    description: t(`pricing.plans.${plan.id}.description`),
    buttonText: t(`pricing.plans.${plan.id}.buttonText`),
    includes: getArray(`pricing.plans.${plan.id}.includes`, []),
  }));

  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
    }
  }, [initialPlan]);

  const startCheckout = async (plan: "solo" | "duo") => {
    setCheckoutError("");
    setSelectedPlan(plan);

    if (mode === "marketing") {
      if (user) {
        navigate(`/subscribe?plan=${plan}`);
        return;
      }
      setPostAuthRedirectTarget(`/subscribe?plan=${plan}`);
      const params = new URLSearchParams();
      params.set("plan", plan);
      params.set("next", "/subscribe");
      navigate(`/login?${params.toString()}`);
      return;
    }

    if (disableCheckout) {
      setCheckoutError("Kun owner kan starte abonnement.");
      return;
    }

    if (!user) {
      setPostAuthRedirectTarget(`/subscribe?plan=${plan}`);
      const params = new URLSearchParams();
      params.set("plan", plan);
      params.set("next", "/subscribe");
      navigate(`/login?${params.toString()}`);
      return;
    }

    setActiveCheckoutPlan(plan);
    try {
      const token = await getIdToken();
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }
      if (!data?.url) {
        throw new Error("Missing checkout url");
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error("[pricing] checkout error:", error);
      setCheckoutError(t("pricing.checkoutError", "Kunne ikke starte betaling. Prøv igen."));
    } finally {
      setActiveCheckoutPlan(null);
    }
  };

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  return (
    <div className="px-4 pt-20 min-h-screen max-w-7xl mx-auto relative" ref={pricingRef}>
      <article className="text-left mb-6 space-y-4 max-w-2xl">
        <h2 className="md:text-6xl text-4xl capitalize font-medium text-gray-900 mb-4">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-start"
            transition={{
              type: "spring",
              stiffness: 250,
              damping: 40,
              delay: 0,
            }}
          >
            {t("pricing.title")}
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="md:text-base text-sm text-gray-600 w-[80%]"
        >
          {t("pricing.description")}
        </TimelineContent>

      </article>

      <div className="grid md:grid-cols-3 gap-4 py-6">
        {plans.map((plan, index) => {
          const isCheckoutLoading = plan.checkoutPlan
            ? activeCheckoutPlan === plan.checkoutPlan
            : false;
          const isSelected = plan.checkoutPlan
            ? selectedPlan === plan.checkoutPlan
            : false;
          const isCheckoutDisabled =
            Boolean(isCheckoutLoading) ||
            (mode === "subscribe" && disableCheckout && Boolean(plan.checkoutPlan));
          return (
            <TimelineContent
              key={plan.name}
              as="div"
              animationNum={2 + index}
              timelineRef={pricingRef}
              customVariants={revealVariants}
            >
              <Card
                className={`relative border border-neutral-200 ${
                  plan.popular ? "ring-2 ring-orange-500 bg-orange-50" : "bg-white"
                } ${isSelected ? "ring-2 ring-emerald-400" : ""}`}
              >
                <CardHeader className="text-left">
                  <div className="flex justify-between">
                    <h3 className="xl:text-3xl md:text-2xl text-3xl font-semibold text-gray-900 mb-2">
                      {t("pricing.planTitle", { name: plan.name })}
                    </h3>
                    {plan.popular && (
                      <div>
                        <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {t("pricing.labels.popular")}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="xl:text-sm md:text-xs text-sm text-gray-600 mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline">
                    {plan.price === null ? (
                      <span className="text-4xl font-semibold text-gray-900">
                        {t("pricing.labels.contactForPrice")}
                      </span>
                    ) : (
                      <>
                        <span className="text-4xl font-semibold text-gray-900">
                          {currencyPrefix}
                          <NumberFlow
                            value={plan.price}
                            className="text-4xl font-semibold"
                          />
                          {currencySuffix}
                        </span>
                        <span className="text-gray-600 ml-1">/{t("pricing.labels.month")}</span>
                      </>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <button
                    type="button"
                    className={`w-full mb-6 p-4 text-xl rounded-xl ${
                      plan.popular
                        ? "bg-gradient-to-t from-orange-500 to-orange-600 shadow-lg shadow-orange-500 border border-orange-400 text-white"
                        : plan.buttonVariant === "outline"
                          ? "bg-gradient-to-t from-neutral-900 to-neutral-600 shadow-lg shadow-neutral-900 border border-neutral-700 text-white"
                          : ""
                    } ${isCheckoutLoading ? "opacity-80 cursor-wait" : ""}`}
                    onClick={
                      plan.checkoutPlan ? () => startCheckout(plan.checkoutPlan) : undefined
                    }
                    disabled={isCheckoutDisabled}
                    aria-busy={Boolean(isCheckoutLoading)}
                  >
                    {plan.buttonText}
                  </button>
                  <button className="w-full mb-6 p-4 text-xl rounded-xl bg-white text-black border border-gray-200 shadow-lg shadow-gray-200">
                    {t("pricing.secondaryCta")}
                  </button>

                  <div className="space-y-3 pt-4 border-t border-neutral-200">
                    <h2 className="text-xl font-semibold uppercase text-gray-900 mb-3">
                      {t("pricing.labels.features")}
                    </h2>
                    <h4 className="font-medium text-base text-gray-900 mb-3">
                      {plan.includes[0] || ""}
                    </h4>
                    <ul className="space-y-2 font-semibold">
                      {plan.includes.slice(1).map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center">
                          <span className="h-6 w-6 bg-white border border-orange-500 rounded-full grid place-content-center mt-0.5 mr-3">
                            <CheckCheck className="h-4 w-4 text-orange-500" />
                          </span>
                          <span className="text-sm text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TimelineContent>
          );
        })}
      </div>
      {checkoutError ? (
        <div className="mt-2 text-sm text-rose-600">
          {checkoutError}
        </div>
      ) : null}
    </div>
  );
}
