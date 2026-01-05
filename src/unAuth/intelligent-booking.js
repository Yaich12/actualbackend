import React from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  CalendarDays,
  FileText,
  GripVertical,
  Layers,
  LineChart,
  MessageCircle,
  Mic,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useLanguage } from './language/LanguageProvider';

const FeatureItem = ({ icon: Icon, text, tone = 'light' }) => {
  const iconStyles =
    tone === 'dark'
      ? 'bg-white/10 text-blue-200'
      : 'bg-blue-50 text-blue-600';
  const textStyles = tone === 'dark' ? 'text-slate-200' : 'text-slate-600';

  return (
    <li className={`flex items-start gap-3 ${textStyles}`}>
      <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ${iconStyles}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm leading-relaxed">{text}</span>
    </li>
  );
};

function IntelligentBookingPage() {
  const { t, getArray } = useLanguage();
  const brand = t('common.brand');
  const teamMembers = getArray('features.intelligentBooking.hero.teamMembers', []);
  const visualOverviewBullets = getArray('features.intelligentBooking.visualOverview.bullets', []);
  const journalBullets = getArray('features.intelligentBooking.journal.bullets', []);
  const teamCalendarLabels = getArray('features.intelligentBooking.visualOverview.teamLabels', []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-8">
        <Link to="/" className="text-lg font-semibold tracking-tight text-white">
          {brand}
        </Link>
        <div className="flex items-center gap-3">
        <Link
          to="/signup"
          className="rounded-full bg-[#4f6fc1] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#415fb6]"
        >
          {t('features.intelligentBooking.ctaTryFree')}
        </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-slate-950 to-[#111c32]" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.intelligentBooking.hero.eyebrow')}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {t('features.intelligentBooking.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-200">
              {t('features.intelligentBooking.hero.description')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                {t('features.intelligentBooking.ctaTryFree')}
              </Link>
              <div className="text-xs text-slate-400">
                {t('features.intelligentBooking.hero.meta')}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-blue-500/10">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.intelligentBooking.hero.panelTitle')}
              <span className="text-slate-400">{t('features.intelligentBooking.hero.panelStatus')}</span>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {t('features.intelligentBooking.hero.teamView')}
                  <Users className="h-4 w-4 text-blue-200" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-[11px] text-slate-300">
                  {teamMembers.map((name) => (
                    <div key={name}>
                      <div className="text-[10px] font-semibold text-slate-400">{name}</div>
                      <div className="mt-2 space-y-2">
                        <div className="h-2 rounded-full bg-blue-400/60" />
                        <div className="h-2 rounded-full bg-slate-600/60" />
                        <div className="h-2 rounded-full bg-emerald-400/60" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-slate-100">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200">
                  <Sparkles className="h-4 w-4" />
                  {t('features.intelligentBooking.hero.aiSuggestions.label')}
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {t('features.intelligentBooking.hero.aiSuggestions.title')}
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  {t('features.intelligentBooking.hero.aiSuggestions.description')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t('features.intelligentBooking.visualOverview.eyebrow')}
            </p>
            <h2 className="mt-4 text-3xl font-semibold">{t('features.intelligentBooking.visualOverview.title')}</h2>
            <p className="mt-4 text-base text-slate-600">
              {t('features.intelligentBooking.visualOverview.description')}
            </p>
            <ul className="mt-6 grid gap-4">
              {visualOverviewBullets.map((bullet, index) => {
                const iconMap = [GripVertical, Users, Layers, MessageCircle];
                const Icon = iconMap[index] || GripVertical;
                return <FeatureItem key={bullet} icon={Icon} text={bullet} />;
              })}
            </ul>
          </div>

          <div className="relative rounded-[32px] bg-slate-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t('features.intelligentBooking.visualOverview.panelTitle')}
              <span className="flex items-center gap-2 text-slate-500">
                <GripVertical className="h-4 w-4" />
                {t('features.intelligentBooking.visualOverview.panelTag')}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-[11px] text-slate-300">
              {teamCalendarLabels.map((label, index) => (
                <div key={label} className="space-y-2">
                  <div className="text-[10px] font-semibold text-slate-400">{label}</div>
                  <div className={`h-3 rounded-full ${index === 0 ? 'bg-blue-400/70' : 'bg-emerald-400/70'}`} />
                  <div className="h-3 rounded-full bg-slate-700/70" />
                  <div className={`h-3 rounded-full ${index === 2 ? 'bg-violet-400/70' : 'bg-blue-400/70'}`} />
                  <div className="h-3 rounded-full bg-slate-700/70" />
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-xs text-slate-300">
              {t('features.intelligentBooking.visualOverview.panelNote')}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="order-2 lg:order-1">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
                {t('features.intelligentBooking.journal.panelTitle')}
                <Mic className="h-4 w-4 text-blue-200" />
              </div>
              <div className="mt-4 rounded-2xl bg-white/10 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {t('features.intelligentBooking.journal.voiceRecording')}
                </div>
                <div className="mt-3 flex items-end gap-1">
                  {[6, 10, 7, 14, 9, 12, 6, 10, 8, 12].map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      style={{ height }}
                      className="w-2 rounded-full bg-blue-400/70"
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-200">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t('features.intelligentBooking.journal.transcriptLabel')}
                  </div>
                  <p className="mt-2">
                    {t('features.intelligentBooking.journal.transcriptText')}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-200">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t('common.soap')}
                  </div>
                  <ul className="mt-2 space-y-2 text-sm">
                    {getArray('features.intelligentBooking.journal.soapItems', []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.intelligentBooking.journal.eyebrow')}
            </p>
            <h2 className="mt-4 text-3xl font-semibold">{t('features.intelligentBooking.journal.title')}</h2>
            <p className="mt-4 text-base text-slate-200">
              {t('features.intelligentBooking.journal.description')}
            </p>
            <Link
              to="/transcription-factsr#factsr-section"
              className="mt-4 inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-[#4f6fc1]"
            >
              {t('features.intelligentBooking.journal.cta')} →
            </Link>
            <ul className="mt-6 grid gap-4">
              {journalBullets.map((bullet, index) => {
                const iconMap = [Mic, FileText, Sparkles];
                const Icon = iconMap[index] || Mic;
                return <FeatureItem key={bullet} icon={Icon} text={bullet} tone="dark" />;
              })}
            </ul>
          </div>
        </div>
      </section>


      <section className="bg-[#0b1220] py-20 text-white">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-blue-500/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
                  <Sparkles className="h-4 w-4 text-blue-200" />
                  {t('features.intelligentBooking.copilotCallout.eyebrow')}
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {t('features.intelligentBooking.copilotCallout.title')}
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-slate-200">
                  {t('features.intelligentBooking.copilotCallout.description')}
                </p>
              </div>
              <Link
                to="/selma-copilot"
                className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-[#4f6fc1]"
              >
                {t('features.intelligentBooking.copilotCallout.cta')} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.intelligentBooking.business.eyebrow')}
            </p>
            <h2 className="mt-4 text-3xl font-semibold">{t('features.intelligentBooking.business.title')}</h2>
            <p className="mt-4 text-base text-slate-200">
              {t('features.intelligentBooking.business.description')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] bg-white p-5 text-slate-900 shadow-2xl">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('features.intelligentBooking.business.revenue.label')}
                <LineChart className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-3 text-2xl font-semibold">{t('features.intelligentBooking.business.revenue.value')}</div>
              <div className="mt-1 text-xs text-slate-500">{t('features.intelligentBooking.business.revenue.delta')}</div>
              <div className="mt-4 flex items-end gap-2">
                {[24, 36, 28, 44, 30, 52, 40].map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    style={{ height }}
                    className="w-3 rounded-full bg-blue-200"
                  />
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/70">
                {t('features.intelligentBooking.business.kpi.label')}
                <BarChart3 className="h-4 w-4 text-blue-200" />
              </div>
              <div className="mt-4 grid gap-4 text-sm text-slate-200">
                <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span>{t('features.intelligentBooking.business.kpi.items.utilization')}</span>
                  <span className="font-semibold text-white">86%</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span>{t('features.intelligentBooking.business.kpi.items.returning')}</span>
                  <span className="font-semibold text-white">64%</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span>{t('features.intelligentBooking.business.kpi.items.growth')}</span>
                  <span className="font-semibold text-white">+12%</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
                <TrendingUp className="h-4 w-4 text-blue-200" />
                {t('features.intelligentBooking.business.kpi.note')}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default IntelligentBookingPage;
