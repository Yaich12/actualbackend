import React from 'react';
import { ArrowLeft, CheckCircle2, Globe, Instagram, Send } from 'lucide-react';
import LandingBuilder from './components/LandingBuilder';
import BookingFlow from './components/BookingFlow';
import { useLanguage } from './language/LanguageProvider';
import './website-builder.css';
import BookingPaymentFlowHero from './components/BookingPaymentFlowHero';

function WebsiteBuilderPage() {
  const { t, getArray } = useLanguage();
  const showLiveBuilder = false;
  const importanceBullets = getArray('features.websiteBuilder.whyMatters.bullets', []);
  const aiFeatures = getArray('features.websiteBuilder.ai.features', []);
  const [monthlyRevenue, setMonthlyRevenue] = React.useState(40000);
  const [averageTreatmentPrice, setAverageTreatmentPrice] = React.useState(500);

  const calculations = React.useMemo(() => {
    const safeMonthlyRevenue = Number.isFinite(monthlyRevenue) ? Math.max(monthlyRevenue, 0) : 0;
    const safeAverageTreatmentPrice = Number.isFinite(averageTreatmentPrice)
      ? Math.max(averageTreatmentPrice, 1)
      : 1;

    const paymentsPerMonth = safeMonthlyRevenue / safeAverageTreatmentPrice;
    const typicalMonthly = (safeMonthlyRevenue * 0.019) + (paymentsPerMonth * 1.5);
    const selmaPayMonthly = (safeMonthlyRevenue * 0.015) + (paymentsPerMonth * 1.8);
    const typicalAnnual = typicalMonthly * 12;
    const selmaPayAnnual = selmaPayMonthly * 12;
    const annualSavings = Math.max(typicalAnnual - selmaPayAnnual, 0);

    return {
      typicalAnnual,
      selmaPayAnnual,
      annualSavings,
    };
  }, [monthlyRevenue, averageTreatmentPrice]);

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat('da-DK', {
        maximumFractionDigits: 0,
      }),
    []
  );

  const formatDkk = (value) => `${currencyFormatter.format(Math.round(value))} kr`;

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
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-600">
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

                <p className="mt-6 text-sm font-semibold text-slate-900">
                  {t('features.websiteBuilder.growth.cta')}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  {t('features.websiteBuilder.growth.cardTitle')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t('features.websiteBuilder.growth.cardDescription')}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('features.websiteBuilder.growth.comparison.typicalTitle')}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {t('features.websiteBuilder.growth.comparison.typicalFee')}
                    </p>
                    <p className="mt-3 text-2xl font-bold text-slate-900">
                      {formatDkk(calculations.typicalAnnual)}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {t('features.websiteBuilder.growth.comparison.perYear')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                      {t('features.websiteBuilder.growth.comparison.selmaTitle')}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {t('features.websiteBuilder.growth.comparison.selmaFee')}
                    </p>
                    <p className="mt-3 text-2xl font-bold text-slate-900">
                      {formatDkk(calculations.selmaPayAnnual)}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {t('features.websiteBuilder.growth.comparison.perYear')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                      {t('features.websiteBuilder.growth.comparison.savingsTitle')}
                    </span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-emerald-700">
                    {formatDkk(calculations.annualSavings)}
                  </p>
                  <p className="text-sm font-medium text-emerald-800">
                    {t('features.websiteBuilder.growth.comparison.perYear')}
                  </p>
                </div>

                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t('features.websiteBuilder.growth.comparison.noHiddenFees')}
                </p>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {t('features.websiteBuilder.growth.calculator.title')}
                  </h4>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-600">
                        {t('features.websiteBuilder.growth.calculator.monthlyRevenue')}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={monthlyRevenue}
                        onChange={(event) => setMonthlyRevenue(Number(event.target.value))}
                        className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300/40"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-600">
                        {t('features.websiteBuilder.growth.calculator.averagePrice')}
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={averageTreatmentPrice}
                        onChange={(event) => setAverageTreatmentPrice(Number(event.target.value))}
                        className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300/40"
                      />
                    </label>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        {t('features.websiteBuilder.growth.calculator.typicalAnnual')}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatDkk(calculations.typicalAnnual)}/år
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        {t('features.websiteBuilder.growth.calculator.selmaAnnual')}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatDkk(calculations.selmaPayAnnual)}/år
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-emerald-700">
                        {t('features.websiteBuilder.growth.calculator.savingsAnnual')}
                      </span>
                      <span className="text-lg font-bold text-emerald-700">
                        {formatDkk(calculations.annualSavings)}/år
                      </span>
                    </div>
                  </div>
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
