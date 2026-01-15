import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import "./booking-payment-flow-hero.css";
import { useLanguage } from "../language/LanguageProvider";

function BookingPaymentFlowHero() {
  const { t } = useLanguage();
  const [isActive, setIsActive] = useState(false);
  const totalAmount = 500;
  const feeAmount = 10;
  const netAmount = totalAmount - feeAmount;
  const currency = "kr";
  const percent = Math.round((feeAmount / totalAmount) * 100);

  const formatMoney = (value) => `${value.toFixed(2)} ${currency}`;
  const interpolate = (template, variables) =>
    Object.entries(variables).reduce(
      (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
      template ?? ""
    );

  const [showFee, setShowFee] = useState(false);
  const [showTotalHop, setShowTotalHop] = useState(false);
  const [showNetHop, setShowNetHop] = useState(false);
  const heroRef = useRef(null);
  const totalControls = useAnimation();
  const netControls = useAnimation();
  const isRunningRef = useRef(false);

  useEffect(() => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const run = async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      while (isActive) {
        setShowFee(false);
        setShowTotalHop(true);
        setShowNetHop(false);
        await totalControls.start({
          offsetDistance: "0%",
          transition: { duration: 0 },
        });
        await netControls.start({
          offsetDistance: "58%",
          transition: { duration: 0 },
        });
        await totalControls.start({
          offsetDistance: "58%",
          transition: { duration: 1.1, ease: "easeInOut" },
        });
        setShowFee(true);
        await sleep(240);
        setShowTotalHop(false);
        setShowNetHop(true);
        await sleep(140);
        setShowFee(false);
        await netControls.start({
          offsetDistance: "100%",
          transition: { duration: 1.1, ease: "easeInOut" },
        });
        await sleep(260);
      }
      isRunningRef.current = false;
    };

    if (isActive) {
      run();
    } else {
      totalControls.stop();
      netControls.stop();
      setShowFee(false);
      setShowTotalHop(false);
      setShowNetHop(false);
      isRunningRef.current = false;
    }

    return () => {
      isRunningRef.current = false;
    };
  }, [totalControls, netControls, isActive]);

  useEffect(() => {
    if (!heroRef.current) return () => {};
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActive(entry.isIntersecting);
      },
      { threshold: 0.35 }
    );
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={heroRef} className="flow-hero">
      <div className="flow-hero__container">
        <div className="flow-hero__grid">
          <div className="flow-hero__copy">
            <span className="flow-hero__eyebrow">
              {t("features.websiteBuilder.paymentFlow.eyebrow")}
            </span>
            <h2 className="flow-hero__title">
              {t("features.websiteBuilder.paymentFlow.title")}
            </h2>
            <p className="flow-hero__subtitle">
              {interpolate(t("features.websiteBuilder.paymentFlow.description"), {
                amount: totalAmount.toFixed(0),
                currency,
                fee: feeAmount.toFixed(0),
                percent: String(percent),
                net: netAmount.toFixed(0),
              })}
            </p>
            <div className="flow-hero__scenario-inline">
              {t("features.websiteBuilder.paymentFlow.labels.scenario")}
            </div>
            <div className="flow-hero__stats" aria-label="Payment summary">
              <div className="flow-hero__stat">
                <div className="flow-hero__stat-label">
                  {interpolate(
                    t("features.websiteBuilder.paymentFlow.stats.patientPays"),
                    { amount: totalAmount.toFixed(0), currency }
                  )}
                </div>
              </div>
              <div className="flow-hero__stat">
                <div className="flow-hero__stat-label">
                  {interpolate(
                    t("features.websiteBuilder.paymentFlow.stats.selmaFee"),
                    {
                      percent: String(percent),
                      fee: feeAmount.toFixed(0),
                      currency,
                    }
                  )}
                </div>
              </div>
              <div className="flow-hero__stat">
                <div className="flow-hero__stat-label">
                  {interpolate(
                    t("features.websiteBuilder.paymentFlow.stats.clinicReceives"),
                    { net: netAmount.toFixed(0), currency }
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={`flow-hero__visual ${isActive ? "flow-hero__visual--active" : ""}`}>
            <div className="flow-hero__orbits" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            {/* Outer connector line: Patient -> Selma+ fee -> Clinic (behind pills) */}
            <svg className="flow-hero__outer-route" viewBox="0 0 100 100" aria-hidden="true">
              <path
                className="flow-hero__outer-path"
                d="M16 64 L46 64 L46 20 L92 20 L92 64 L84 64"
              />
              <circle className="flow-hero__outer-dot flow-hero__outer-dot--patient" cx="16" cy="64" r="1.8" />
              <circle className="flow-hero__outer-dot flow-hero__outer-dot--selma" cx="92" cy="20" r="1.8" />
              <circle className="flow-hero__outer-dot flow-hero__outer-dot--clinic" cx="92" cy="64" r="1.8" />
            </svg>

            <div className="flow-hero__pill flow-hero__pill--patient">
              <span className="flow-hero__pill-amount">{formatMoney(totalAmount)}</span>
              <span className="flow-hero__pill-label">
                {t("features.websiteBuilder.paymentFlow.labels.patient")}
              </span>
            </div>

            <div className="flow-hero__pill flow-hero__pill--clinic">
              <span className="flow-hero__pill-amount flow-hero__pill-amount--net">
                {formatMoney(netAmount)}
              </span>
              <span className="flow-hero__pill-label">
                {t("features.websiteBuilder.paymentFlow.labels.clinic")}
              </span>
            </div>

            <div className="flow-hero__pill flow-hero__pill--selma">
              <span className="flow-hero__pill-amount flow-hero__pill-amount--fee">
                {formatMoney(feeAmount)}
              </span>
              <span className="flow-hero__pill-label">
                {t("features.websiteBuilder.paymentFlow.labels.selma")}
              </span>
            </div>

            <div className="flow-hero__phone" aria-label="Payment flow mockup">
              <div className="flow-hero__phone-inner">
                <div className="flow-phone">
                  <div className="flow-phone__top">
                    <div className="flow-phone__brand">
                      <img
                        src="/assets/selmalogo.png"
                        alt={t("features.websiteBuilder.paymentFlow.brandAlt")}
                        className="flow-phone__brand-logo"
                      />
                      <div className="flow-phone__brand-name">SELMA+</div>
                    </div>

                    <div className="flow-map" aria-hidden="true">
                      <div className="flow-map__grid" />

                      <svg className="flow-map__route" viewBox="0 0 100 100">
                        <defs>
                          <marker
                            id="flow-arrow"
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto"
                          >
                            <path d="M0 0 L10 5 L0 10 Z" fill="rgba(37, 99, 235, 0.9)" />
                          </marker>
                          <marker
                            id="fee-arrow"
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto"
                          >
                            <path d="M0 0 L10 5 L0 10 Z" fill="rgba(14, 165, 233, 0.95)" />
                          </marker>
                        </defs>
                        <path
                          className="flow-map__path"
                          d="M18 78 L18 52 L52 52 L52 28 L82 28 L82 24"
                          markerEnd="url(#flow-arrow)"
                        />
                        <path
                          className="flow-map__path flow-map__path--soft"
                          d="M18 78 L18 52 L52 52"
                        />

                        {/* Fee branch (Selma+ hub pulls out fee) */}
                        <path
                          className={`flow-map__branch ${showFee ? "flow-map__branch--active" : ""}`}
                          d="M52 52 L92 52"
                          markerEnd="url(#fee-arrow)"
                        />
                      </svg>

                      <div className="flow-map__marker flow-map__marker--patient" />
                      <div className="flow-map__marker flow-map__marker--selma" />
                      <div className="flow-map__marker flow-map__marker--clinic" />

                      <AnimatePresence>
                        {showFee ? (
                          <motion.div
                            className="flow-map__fee-badge"
                            initial={{ opacity: 0, scale: 0.96, y: 6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -6 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            <div className="flow-map__fee-title">
                              {interpolate(
                                t("features.websiteBuilder.paymentFlow.feeBadge.title"),
                                {
                                  percent: String(percent),
                                  fee: feeAmount.toFixed(0),
                                  currency,
                                }
                              )}
                            </div>
                            <div className="flow-map__fee-subtitle">
                              {t("features.websiteBuilder.paymentFlow.feeBadge.subtitle")}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showTotalHop ? (
                          <motion.div
                            className="flow-map__amount"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.12, ease: "easeOut" }}
                            style={{
                              offsetPath:
                                'path("M18 78 L18 52 L52 52 L52 28 L82 28 L82 24")',
                              offsetRotate: "0deg",
                            }}
                            animate={totalControls}
                          >
                            {formatMoney(totalAmount)}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showNetHop ? (
                          <motion.div
                            className="flow-map__amount flow-map__amount--net"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.12, ease: "easeOut" }}
                            style={{
                              offsetPath:
                                'path("M18 78 L18 52 L52 52 L52 28 L82 28 L82 24")',
                              offsetRotate: "0deg",
                            }}
                            animate={netControls}
                          >
                            {formatMoney(netAmount)}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flow-drawer">
                    <div className="flow-drawer__title">Booking bekræftet!</div>

                    <div className="flow-meta">
                      <div className="flow-meta__row">
                        <div className="flow-meta__label">
                          {t("features.websiteBuilder.paymentFlow.patient.timeLabel")}
                        </div>
                        <div className="flow-meta__value">
                          {t("features.websiteBuilder.paymentFlow.patient.timeValue")}
                        </div>
                      </div>
                      <div className="flow-meta__row">
                        <div className="flow-meta__label">Betaling</div>
                        <div className="flow-meta__value">Apple Pay</div>
                      </div>
                    </div>

                    <div className="flow-receipt">
                      <div className="flow-receipt__header">Order receipt</div>
                      <div className="flow-receipt__row">
                        <span>Klinik bookingpris</span>
                        <span>{formatMoney(netAmount)}</span>
                      </div>
                      <div className="flow-receipt__row flow-receipt__row--fee">
                          <span>Selma+ transaktionsgebyr</span>
                        <span>{formatMoney(feeAmount)}</span>
                      </div>
                      <div className="flow-receipt__row flow-receipt__row--total">
                        <span>Total</span>
                        <span>{formatMoney(totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default BookingPaymentFlowHero;
