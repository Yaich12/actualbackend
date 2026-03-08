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
import { buildApiUrl } from "../../utils/runtimeUrls";
import { useLanguage } from "../../unAuth/language/LanguageProvider";

const PLAN_CONFIG = [
  {
    id: "starter",
    priceByLanguage: { da: 399, en: 59 },
    buttonVariant: "outline" as const,
    popular: false,
    checkoutPlan: "solo" as const,
  },
  {
    id: "enterprise",
    priceByLanguage: null,
    price: null,
    buttonVariant: "outline" as const,
    popular: false,
    checkoutPlan: null,
  },
];

type PricingSectionProps = {
  mode?: "marketing" | "subscribe";
  initialPlan?: "solo" | null;
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
  const [activeCheckoutPlan, setActiveCheckoutPlan] = useState<"solo" | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"solo" | null>(initialPlan);
  const isDanish = language === "da";
  const currencyPrefix = isDanish ? "" : "$";
  const currencySuffix = isDanish ? " kr" : "";
  const getOptionalText = (key: string) => {
    const value = t(key);
    return value === key ? "" : value;
  };
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
    priceNote: getOptionalText(`pricing.plans.${plan.id}.priceNote`),
    featureNote: getOptionalText(`pricing.plans.${plan.id}.featureNote`),
  }));
  const trustItems = getArray("pricing.trust", []);

  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
    }
  }, [initialPlan]);

  const startCheckout = async (plan: "solo") => {
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
      const response = await fetch(buildApiUrl("/api/stripe/create-checkout-session"), {
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
    <div className="px-4 pt-20 pb-10 min-h-screen max-w-7xl mx-auto relative" ref={pricingRef}>
      <article className="text-left mb-7 space-y-4 max-w-6xl">
        <h2 className="xl:text-6xl md:text-5xl text-4xl font-medium text-gray-900 mb-4 xl:whitespace-nowrap">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-start xl:!flex-nowrap"
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
          className="md:text-lg text-base text-gray-600 max-w-3xl"
        >
          {t("pricing.description")}
        </TimelineContent>

      </article>

      <div className="grid md:grid-cols-2 gap-5 py-6">
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
                className={`relative h-full flex flex-col border border-slate-200 bg-white rounded-2xl shadow-sm ${
                  isSelected ? "ring-2 ring-emerald-400" : ""
                }`}
              >
                <CardHeader className="text-left min-h-[230px] pb-5">
                  <div className="flex justify-between">
                    <h3 className="xl:text-4xl md:text-3xl text-3xl font-semibold text-gray-900 mb-2 leading-tight">
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
                  <p className="xl:text-base md:text-sm text-base text-gray-600 mb-5">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline">
                    {plan.price === null ? (
                      <span className="text-4xl font-semibold text-gray-900 leading-none">
                        {t("pricing.labels.contactForPrice")}
                      </span>
                    ) : (
                      <>
                        <span className="text-4xl font-semibold text-gray-900 leading-none">
                          {currencyPrefix}
                          <NumberFlow
                            value={plan.price}
                            className="text-4xl font-semibold leading-none"
                          />
                          {currencySuffix}
                        </span>
                        <span className="text-gray-600 ml-2 text-base">/{t("pricing.labels.month")}</span>
                      </>
                    )}
                  </div>
                  <p
                    className={`text-base mt-3 min-h-6 ${
                      plan.price !== null && plan.priceNote ? "text-gray-600" : "text-transparent"
                    }`}
                  >
                    {plan.price !== null && plan.priceNote ? plan.priceNote : "placeholder"}
                  </p>
                </CardHeader>

                <CardContent className="pt-0 flex-1 flex flex-col">
                  <button
                    type="button"
                    className={`w-full mb-3 py-4 text-xl rounded-xl border border-slate-900 bg-slate-900 text-white shadow-sm transition-colors ${
                      isCheckoutLoading ? "opacity-80 cursor-wait" : "hover:bg-slate-800"
                    }`}
                    onClick={
                      plan.checkoutPlan ? () => startCheckout(plan.checkoutPlan) : undefined
                    }
                    disabled={isCheckoutDisabled}
                    aria-busy={Boolean(isCheckoutLoading)}
                  >
                    {plan.buttonText}
                  </button>
                  <button className="w-full mb-6 py-4 text-xl rounded-xl bg-white text-slate-900 border border-slate-200 shadow-sm transition-colors hover:bg-slate-50">
                    {t("pricing.secondaryCta")}
                  </button>

                  <div className="space-y-3 pt-5 border-t border-slate-200 flex-1">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 mb-2">
                      {t("pricing.labels.features")}
                    </h2>
                    <h4 className="font-medium text-lg text-gray-900 mb-4">
                      {plan.includes[0] || ""}
                    </h4>
                    <ul className="space-y-3 font-semibold">
                      {plan.includes.slice(1).map((feature, featureIndex) => {
                        const isSubItem =
                          feature.trim().startsWith("–") || feature.trim().startsWith("-");
                        return (
                          <li
                            key={featureIndex}
                            className={isSubItem ? "pl-9" : "flex items-start"}
                          >
                            {isSubItem ? null : (
                              <span className="h-5 w-5 bg-white border border-orange-500 rounded-full grid place-content-center mt-1 mr-3 shrink-0">
                                <CheckCheck className="h-3 w-3 text-orange-500" />
                              </span>
                            )}
                            <span
                              className={`leading-8 ${
                                isSubItem ? "text-base text-slate-500" : "text-base md:text-lg text-slate-600"
                              }`}
                            >
                              {feature}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {plan.featureNote ? (
                      <p className="text-sm leading-relaxed text-slate-500 whitespace-pre-line pt-3">
                        {plan.featureNote}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </TimelineContent>
          );
        })}
      </div>
      {trustItems.length ? (
        <div className="pt-2 pb-2 border-t border-slate-200">
          <ul className="flex flex-col md:flex-row md:flex-wrap gap-x-8 gap-y-3 font-semibold">
            {trustItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-center">
                <span className="h-5 w-5 bg-white border border-orange-500 rounded-full grid place-content-center mt-0.5 mr-3">
                  <CheckCheck className="h-3 w-3 text-orange-500" />
                </span>
                <span className="text-base md:text-lg text-slate-600">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {checkoutError ? (
        <div className="mt-2 text-sm text-rose-600">
          {checkoutError}
        </div>
      ) : null}
    </div>
  );
}
