import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, CheckCircle2, MessageCircle, Sparkles } from 'lucide-react';
import { useLanguage } from './language/LanguageProvider';

function SelmaCopilotPage() {
  const { t, getArray } = useLanguage();
  const brand = t('common.brand');
  const featureItems = getArray('features.selmaCopilot.features', []);
  const examples = getArray('features.selmaCopilot.examples.items', []);
  const overviewStats = getArray('features.selmaCopilot.panel.overviewStats', []);
  const allyDetailLines = getArray('features.selmaCopilot.panel.chat.allyDetails', []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-8">
        <Link to="/" className="text-lg font-semibold tracking-tight text-white">
          {brand}
        </Link>
        <Link
          to="/signup"
          className="rounded-full bg-[#4f6fc1] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#415fb6]"
        >
          {t('features.selmaCopilot.ctaTryFree')}
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-slate-950 to-[#111c32]" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white">
              {t('features.selmaCopilot.hero.badge')}
            </span>
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-200" />
              {t('features.selmaCopilot.hero.badgeLabel')}
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {t('features.selmaCopilot.hero.title')}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-200">
            {t('features.selmaCopilot.hero.descriptionIntro')}{' '}
            <span className="font-semibold text-white">{t('features.selmaCopilot.hero.assistantName')}</span>
            {t('features.selmaCopilot.hero.descriptionOutro')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              to="/signup"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
            >
              {t('features.selmaCopilot.ctaTryFree')}
            </Link>
            <span className="text-xs text-slate-400">
              {t('features.selmaCopilot.hero.tagline')}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-[#0b1220] py-20 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.selmaCopilot.alwaysOn.eyebrow')}
            </p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              {t('features.selmaCopilot.alwaysOn.title')}
            </h2>
            <p className="mt-4 text-base text-slate-200">
              {t('features.selmaCopilot.alwaysOn.description')}
            </p>
            <div className="mt-6 grid gap-4">
              {featureItems.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-blue-200">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">{item.title}</div>
                      <p className="mt-2 text-sm text-slate-200">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-blue-500/10">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.selmaCopilot.panel.title')}
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white">
                {t('features.selmaCopilot.hero.assistantName')}
              </span>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.75fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {t('features.selmaCopilot.panel.overviewTitle')}
                </div>
                <div className="mt-3 space-y-3 text-xs text-slate-300">
                  {overviewStats.map((item) => (
                    <div key={item} className="rounded-xl bg-white/10 px-3 py-2">{item}</div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                  <MessageCircle className="h-4 w-4" />
                  {t('features.selmaCopilot.panel.chat.title')}
                </div>
                <div className="mt-3 space-y-3 text-xs">
                  <div className="rounded-2xl bg-white/10 px-3 py-2 text-slate-200">
                    <div className="text-[10px] font-semibold text-blue-200">
                      {t('features.selmaCopilot.panel.chat.clinicianLabel')}
                    </div>
                    <p>{t('features.selmaCopilot.panel.chat.clinicianMessage')}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-50 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <div className="text-[10px] font-semibold text-blue-100">
                      {t('features.selmaCopilot.panel.chat.allyLabel')}
                    </div>
                    <div className="mt-2 space-y-2 text-[11px] leading-relaxed">
                      <p>{t('features.selmaCopilot.panel.chat.allyIntro')}</p>
                      {allyDetailLines.map((line) => (
                        <p key={line.label}>
                          <span className="font-semibold">{line.label}:</span> {line.value}
                        </p>
                      ))}
                      <p>{t('features.selmaCopilot.panel.chat.allyOutro')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              {t('features.selmaCopilot.panel.footerNote')}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
            <Bot className="h-4 w-4" />
            {t('features.selmaCopilot.examples.eyebrow')}
          </div>
          <h3 className="mt-4 text-3xl font-semibold">{t('features.selmaCopilot.examples.title')}</h3>
          <p className="mt-3 max-w-2xl text-base text-slate-200">
            {t('features.selmaCopilot.examples.description')}
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {examples.map((example) => (
              <div key={example.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                  {example.label}
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-slate-200">
                    <div className="text-[10px] font-semibold text-blue-200">
                      {t('features.selmaCopilot.panel.chat.clinicianLabel')}
                    </div>
                    <p>{example.clinician}</p>
                  </div>
                  <div className="rounded-2xl bg-white/20 px-4 py-3 text-white">
                    <div className="text-[10px] font-semibold text-blue-200">
                      {t('features.selmaCopilot.panel.chat.allyLabel')}
                    </div>
                    <p>{example.ally}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h3 className="text-3xl font-semibold">{t('features.selmaCopilot.activate.title')}</h3>
            <p className="mt-3 text-base text-slate-600">
              {t('features.selmaCopilot.activate.description')}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <Sparkles className="h-5 w-5 text-blue-600" />
              {t('features.selmaCopilot.activate.cardTitle')}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {t('features.selmaCopilot.activate.cardDescription')}
            </p>
            <Link
              to="/signup"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {t('features.selmaCopilot.activate.cta')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SelmaCopilotPage;
