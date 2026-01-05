import React from 'react';
import { CheckCircle2, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import LandingBuilder from './components/LandingBuilder';
import BookingFlow from './components/BookingFlow';
import { useLanguage } from './language/LanguageProvider';

function WebsiteBuilderPage() {
  const { t, getArray } = useLanguage();
  const brandShort = t('common.brandShort');
  const showLiveBuilder = false;
  const importanceBullets = getArray('features.websiteBuilder.whyMatters.bullets', []);
  const aiFeatures = getArray('features.websiteBuilder.ai.features', []);
  const servicesList = getArray('features.websiteBuilder.design.serviceItems', []);
  const brandBullets = getArray('features.websiteBuilder.design.sideBullets', []);
  const growthBullets = getArray('features.websiteBuilder.growth.bullets', []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <section className="bg-white text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative">
            <img
              src="/hero-2/pexels-rdne-7755558.jpg"
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
            <ul className="mt-6 list-disc space-y-3 pl-5 text-sm text-slate-600">
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
                const iconMap = [Sparkles, MessageCircle, ShieldCheck];
                const Icon = iconMap[index] || Sparkles;
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
            <img
              src="/hero-2/physio-hero-02.jpg"
              alt={t('features.websiteBuilder.ai.imageAlt')}
              className="h-[360px] w-full rounded-[32px] object-cover shadow-2xl shadow-slate-900/60 lg:h-[420px]"
              loading="lazy"
            />
            <div className="absolute bottom-6 right-6 max-w-xs rounded-3xl bg-white/90 p-4 shadow-2xl shadow-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-900/80 p-1 text-sm font-semibold uppercase tracking-wide text-white">
                  {brandShort}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('features.websiteBuilder.ai.chat.label')}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {t('features.websiteBuilder.ai.chat.agent')}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-2xl bg-blue-900/90 px-3 py-2 text-slate-50">
                  <p className="text-xs font-semibold text-blue-200">
                    {t('features.websiteBuilder.ai.chat.agent')}
                  </p>
                  <p>{t('features.websiteBuilder.ai.chat.agentMessage')}</p>
                </div>
                <div className="rounded-2xl bg-slate-100/80 px-3 py-2 text-slate-900">
                  <p className="text-xs font-semibold text-slate-500">
                    {t('features.websiteBuilder.ai.chat.patient')}
                  </p>
                  <p>{t('features.websiteBuilder.ai.chat.patientMessage')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {t('features.websiteBuilder.design.eyebrow')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              {t('features.websiteBuilder.design.title')}
            </h2>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span>{t('features.websiteBuilder.design.cardLabel')}</span>
                <span>{t('features.websiteBuilder.design.cardTag')}</span>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <img
                  src="/hero-2/physio-hero-02.jpg"
                  alt={t('features.websiteBuilder.design.imageAlt')}
                  className="h-56 w-full rounded-3xl object-cover"
                  loading="lazy"
                />
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {t('features.websiteBuilder.design.cardTitle')}
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-slate-600">
                    {servicesList.map((service) => (
                      <li
                        key={service}
                        className="flex items-center justify-between border-b border-slate-200 pb-2"
                      >
                        {service} <span className="text-slate-400">+</span>
                      </li>
                    ))}
                  </ul>
                  <button className="mt-5 rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                    {t('features.websiteBuilder.design.cardCta')}
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                {t('features.websiteBuilder.design.sideTitle')}
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                {t('features.websiteBuilder.design.sideDescription')}
              </p>
              <ul className="mt-5 list-disc space-y-3 pl-5 text-sm text-slate-600">
                {brandBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eef2fb] text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
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
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <ul className="list-disc space-y-3 pl-5 text-sm text-slate-600">
                  {growthBullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  {t('features.websiteBuilder.growth.callout')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f0ff] text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {t('features.websiteBuilder.builder.eyebrow')}
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {t('features.websiteBuilder.builder.title')}
            </h2>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
              <CheckCircle2 className="h-4 w-4" />
              {t('features.websiteBuilder.builder.pill')}
            </div>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              {t('features.websiteBuilder.builder.description')}
            </p>
          </div>
          <div className="mt-10 flex justify-center">
            <img
              src="/hero-2/physio-gallery-01.jpg"
              alt={t('features.websiteBuilder.builder.imageAlt')}
              className="h-[320px] w-full max-w-4xl rounded-[32px] object-cover shadow-2xl shadow-slate-200/60 sm:h-[420px]"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <BookingFlow />
      {showLiveBuilder ? <LandingBuilder /> : null}
    </div>
  );
}

export default WebsiteBuilderPage;
