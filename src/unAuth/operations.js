import React from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  LineChart,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useLanguage } from './language/LanguageProvider';

const FeatureItem = ({ icon: Icon, text }) => (
  <li className="flex items-start gap-3 text-slate-600">
    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
      <Icon className="h-4 w-4" />
    </span>
    <span className="text-sm leading-relaxed">{text}</span>
  </li>
);

function OperationsPage() {
  const { t, getArray } = useLanguage();
  const brand = t('common.brand');
  const financeIntegrations = getArray('features.operations.finance.integrations', []);
  const teamBullets = getArray('features.operations.team.bullets', []);
  const teamMembers = getArray('features.operations.team.panelMembers', []);

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
          {t('features.operations.ctaTryFree')}
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-slate-950 to-[#111c32]" />
        <div className="absolute right-6 top-16 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-6 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.operations.hero.eyebrow')}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {t('features.operations.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-200">
              {t('features.operations.hero.description')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                {t('features.operations.ctaTryFree')}
              </Link>
              <div className="text-xs text-slate-400">
                {t('features.operations.hero.meta')}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-blue-500/10">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              {t('features.operations.hero.panelTitle')}
              <span className="text-slate-400">{t('features.operations.hero.panelStatus')}</span>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {t('features.operations.hero.revenueLabel')}
                  <LineChart className="h-4 w-4 text-blue-200" />
                </div>
                <div className="mt-3 text-2xl font-semibold">{t('features.operations.hero.revenueValue')}</div>
                <div className="mt-2 text-xs text-slate-300">{t('features.operations.hero.revenueDelta')}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-slate-100">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200">
                  <BadgeCheck className="h-4 w-4" />
                  {t('features.operations.hero.reconcileLabel')}
                </div>
                <div className="mt-2 text-sm font-semibold">{t('features.operations.hero.reconcileTitle')}</div>
                <div className="mt-2 text-xs text-slate-300">{t('features.operations.hero.reconcileDescription')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            {t('features.operations.finance.eyebrow')}
          </p>
          <h2 className="mt-4 text-3xl font-semibold">{t('features.operations.finance.title')}</h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <CreditCard className="h-5 w-5 text-blue-600" />
                {t('features.operations.finance.cards.billing.title')}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {t('features.operations.finance.cards.billing.description')}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                {t('features.operations.finance.cards.integrations.title')}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {t('features.operations.finance.cards.integrations.description')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {financeIntegrations.map((name) => (
                  <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <LineChart className="h-5 w-5 text-blue-600" />
                {t('features.operations.finance.cards.analytics.title')}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {t('features.operations.finance.cards.analytics.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t('features.operations.team.eyebrow')}
            </p>
            <h2 className="mt-4 text-3xl font-semibold">{t('features.operations.team.title')}</h2>
            <p className="mt-4 text-base text-slate-600">
              {t('features.operations.team.description')}
            </p>
            <ul className="mt-6 grid gap-4">
              {teamBullets.map((bullet, index) => {
                const iconMap = [Users, CalendarDays, RefreshCw];
                const Icon = iconMap[index] || Users;
                return <FeatureItem key={bullet} icon={Icon} text={bullet} />;
              })}
            </ul>
          </div>
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t('features.operations.team.panelTitle')}
              <span className="text-slate-500">{t('features.operations.team.panelTag')}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-[11px] text-slate-500">
              {teamMembers.map((name, index) => (
                <div key={name} className="space-y-2">
                  <div className="text-[10px] font-semibold text-slate-400">{name}</div>
                  <div className={`h-2 rounded-full ${index === 0 ? 'bg-blue-400/70' : 'bg-emerald-400/70'}`} />
                  <div className="h-2 rounded-full bg-slate-200" />
                  <div className={`h-2 rounded-full ${index === 2 ? 'bg-violet-400/70' : 'bg-blue-400/70'}`} />
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
              {t('features.operations.team.panelNote')}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="order-2 lg:order-1">
            <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6 shadow-lg">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t('features.operations.programs.panelTitle')}
                <span className="text-slate-500">{t('features.operations.programs.panelTag')}</span>
              </div>
              <div className="mt-4 rounded-2xl bg-white p-4">
                <div className="text-sm font-semibold text-slate-700">{t('features.operations.programs.panelName')}</div>
                <div className="mt-2 text-xs text-slate-500">{t('features.operations.programs.panelPasses')}</div>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div className="h-full w-3/4 rounded-full bg-blue-500" />
                </div>
                <div className="mt-4 grid gap-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>{t('features.operations.programs.panelSessionLabel')}</span>
                    <span className="font-semibold text-slate-600">{t('features.operations.programs.panelSessionTime')}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>{t('features.operations.programs.panelProgramLabel')}</span>
                    <span className="font-semibold text-slate-600">{t('features.operations.programs.panelProgramValue')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t('features.operations.programs.eyebrow')}
            </p>
            <h2 className="mt-4 text-3xl font-semibold">{t('features.operations.programs.title')}</h2>
            <p className="mt-4 text-base text-slate-600">
              {t('features.operations.programs.description')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OperationsPage;
