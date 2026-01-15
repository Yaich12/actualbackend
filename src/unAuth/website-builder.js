import React from 'react';
import { ArrowLeft, CheckCircle2, Globe, Instagram, Send } from 'lucide-react';
import LandingBuilder from './components/LandingBuilder';
import BookingFlow from './components/BookingFlow';
import { useLanguage } from './language/LanguageProvider';
import './website-builder.css';
import BookingPaymentFlowHero from './components/BookingPaymentFlowHero';

function WebsiteBuilderPage() {
  const { t, getArray } = useLanguage();
  const brandShort = t('common.brandShort');
  const showLiveBuilder = false;
  const importanceBullets = getArray('features.websiteBuilder.whyMatters.bullets', []);
  const aiFeatures = getArray('features.websiteBuilder.ai.features', []);
  const getPaymentLogo = (method) => {
    const name = String(method || '').toLowerCase();
    if (name.includes('mobile')) {
      return { src: "/hero-5/MobilePay-1200x627.jpg", alt: "MobilePay" };
    }
    if (name.includes('apple')) {
      return { src: "/hero-5/apple-pay-logo-coopbank.webp", alt: "Apple Pay" };
    }
    if (name.includes('visa')) {
      return { src: "/hero-5/Visa_Grey.avif", alt: "Visa" };
    }
    if (name.includes('mastercard')) {
      return { src: "/hero-5/Mastercard_2019_logo.svg", alt: "Mastercard" };
    }
    return { src: "/hero-5/unnamed.jpg", alt: String(method || "Payment") };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="fixed left-4 top-4 z-50">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('features.websiteBuilder.bookingFlow.actions.back')}
        </a>
      </div>
      <section className="bg-white text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative">
            <img
              src="/hero-5/physio-picture.jpg"
              alt={t('features.websiteBuilder.whyMatters.imageAlt')}
              className="h-[320px] w-full rounded-3xl object-cover shadow-2xl shadow-slate-200/60 sm:h-[420px]"
              loading="lazy"
            />
            <div className="absolute left-6 top-6 rounded-2xl bg-white/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-md">
              {t('features.websiteBuilder.whyMatters.badge')}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {t('features.websiteBuilder.whyMatters.eyebrow')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              {t('features.websiteBuilder.whyMatters.title')}
            </h2>
            <p className="mt-4 max-w-xl text-base text-slate-600">
              {t('features.websiteBuilder.whyMatters.description')}
            </p>
            <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-600">
              {importanceBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t('features.websiteBuilder.ai.eyebrow')}
            </p>
            <h2 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
              {t('features.websiteBuilder.ai.title')}
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-slate-200">
              {t('features.websiteBuilder.ai.description')}
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {aiFeatures.map((feature, index) => {
                const iconMap = [Instagram, Globe, Send];
                const Icon = iconMap[index] || Globe;
                return (
                <div
                  key={feature.title}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-900/40"
                >
                  <Icon className="h-6 w-6 text-blue-300" />
                  <div>
                    <div className="text-sm font-semibold text-white">{feature.title}</div>
                    <p className="text-sm text-slate-300">{feature.description}</p>
                  </div>
                </div>
              )})}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-blue-500/10 via-slate-900/0 to-sky-400/10 blur-2xl" aria-hidden="true" />

            <div className="relative mx-auto flex w-full flex-wrap items-center justify-end gap-6">
              {/* Instagram profile mockup */}
              <div className="relative z-10 w-[320px] sm:w-[360px]">
                <img
                  src="/hero-5/insta-profil.jpg"
                  alt="Instagram-profil mockup"
                  className="w-full rounded-[28px] shadow-[0_30px_80px_rgba(15,23,42,0.45)]"
                  loading="lazy"
                />
              </div>

              {/* Website booking mockup */}
              <div className="relative z-10 w-[320px] sm:w-[360px]">
                <img
                  src="/hero-5/booking-hjemmeside.jpg"
                  alt="Hjemmeside booking mockup"
                  className="w-full rounded-[28px] shadow-[0_30px_80px_rgba(15,23,42,0.45)]"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eef2fb] text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="rounded-[40px] bg-white px-6 py-10 shadow-xl shadow-slate-200/60 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {t('features.websiteBuilder.growth.eyebrow')}
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                  {t('features.websiteBuilder.growth.title')}
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  {t('features.websiteBuilder.growth.description')}
                </p>

                {/* Payment method logos (under the "We support..." line) */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {[
                    { key: "MobilePay", src: "/hero-5/MobilePay-1200x627.jpg", crop: true },
                    { key: "Apple Pay", src: "/hero-5/apple-pay-logo-coopbank.webp" },
                    { key: "Google Pay", src: "/hero-5/unnamed.jpg" },
                    { key: "Dankort", textOnly: true },
                    { key: "Visa", src: "/hero-5/Visa_Grey.avif" },
                    { key: "Mastercard", src: "/hero-5/Mastercard_2019_logo.svg" },
                  ].map((m) => (
                    <span
                      key={m.key}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      {m.textOnly ? (
                        <span className="px-1 text-[11px] font-extrabold tracking-wide text-slate-700">
                          DANKORT
                        </span>
                      ) : (
                        <img
                          src={m.src}
                          alt={m.key}
                          className={m.crop ? "h-4 w-10 rounded-sm object-cover object-left" : "h-4 w-auto"}
                          loading="lazy"
                        />
                      )}
                      <span>{m.key}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  {t('features.websiteBuilder.growth.cardTitle')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t('features.websiteBuilder.growth.cardDescription')}
                </p>

                <div className="mt-5 inline-flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 shadow-lg shadow-slate-900/20">
                  <img
                    src="/hero-5/selma-logo-final.jpg"
                    alt="Selma+"
                    className="h-5 w-5 rounded-full bg-white p-[3px]"
                    loading="lazy"
                  />
                  <span className="text-sm font-semibold text-white/80">×</span>
                  <img
                    src="/hero-5/unnamed.webp"
                    alt="Stripe"
                    className="h-5 w-auto"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BookingPaymentFlowHero />

      <BookingFlow />
      {showLiveBuilder ? <LandingBuilder /> : null}
    </div>
  );
}

export default WebsiteBuilderPage;
