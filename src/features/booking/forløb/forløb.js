import React, { useEffect, useMemo, useState } from 'react';
import '../bookingpage.css';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { useLanguage } from '../../../LanguageContext';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ChevronDown } from 'lucide-react';
import { migrateLegacyCollectionToClinic } from '../../../utils/workspaceContext';

const parseOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumberWithFallback = (value, fallback) => {
  const parsed = parseOptionalNumber(value);
  return parsed === null ? fallback : parsed;
};

function ForlobCreate({ onSave, isSaving = false }) {
  const { t, locale } = useLanguage();
  const [form, setForm] = useState({
    name: '',
    format: 'group',
    setting: 'clinic',
    weeks: 8,
    sessionsPerWeek: 2,
    sessionLength: 60,
    packagePrice: '',
    maxParticipants: 8,
    goals: '',
    contentEducation: true,
    contentStrength: true,
    contentNeuromuscular: true,
    contentHomeProgram: true,
    contentOutcomeMeasures: false,
    notes: '',
  });

  const totalSessions = useMemo(() => {
    const w = Number(form.weeks) || 0;
    const s = Number(form.sessionsPerWeek) || 0;
    return w * s;
  }, [form.weeks, form.sessionsPerWeek]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      format: form.format,
      setting: form.setting,
      weeks: parseNumberWithFallback(form.weeks, 8),
      sessionsPerWeek: parseNumberWithFallback(form.sessionsPerWeek, 2),
      sessionLength: parseNumberWithFallback(form.sessionLength, 60),
      packagePrice: parseOptionalNumber(form.packagePrice),
      maxParticipants: parseNumberWithFallback(form.maxParticipants, 8),
      goals: form.goals.trim(),
      contentEducation: Boolean(form.contentEducation),
      contentStrength: Boolean(form.contentStrength),
      contentNeuromuscular: Boolean(form.contentNeuromuscular),
      contentHomeProgram: Boolean(form.contentHomeProgram),
      contentOutcomeMeasures: Boolean(form.contentOutcomeMeasures),
      notes: form.notes.trim(),
      totalSessions,
      createdAt: new Date().toISOString(),
    };
    if (onSave) {
      await onSave(payload);
      return;
    }
    console.log('Forløb klar til gemning:', payload);
    alert(
      t(
        'booking.programs.create.alertSaved',
        'Forløb oprettet (hook det op til Firestore senere).'
      )
    );
  };

  const formatLabels = {
    individual: t('booking.programs.options.format.individual', 'Individuel'),
    small_group: t('booking.programs.options.format.smallGroup', 'Lille hold (2–4)'),
    group: t('booking.programs.options.format.group', 'Hold (5–12)'),
  };
  const settingLabels = {
    clinic: t('booking.programs.options.setting.clinic', 'Klinik / træningssal'),
    gym: t('booking.programs.options.setting.gym', 'Fitnesscenter'),
    online: t('booking.programs.options.setting.online', 'Online / hybrid'),
    home: t('booking.programs.options.setting.home', 'Hjemmebaseret'),
  };
  const currencyLabel = t('booking.services.price.currency', 'DKK');

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-slate-50/60 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
            {t('booking.programs.create.title', 'Opret nyt forløb')}
          </h1>
          <p className="text-xs text-slate-500 md:text-sm">
            {t(
              'booking.programs.create.subtitle',
              'Design et struktureret behandlingsforløb – f.eks. artroseforløb, GLAD-hold eller postoperativ genoptræning.'
            )}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-3 md:p-6"
      >
        <div className="space-y-4 md:col-span-2">
          <div className="grid gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {t('booking.programs.create.fields.name.label', 'Forløbsnavn')}
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={t(
                  'booking.programs.create.fields.name.placeholder',
                  'GLAD knæ, Hofteartrose-forløb, Lændehold, osv.'
                )}
                value={form.name}
                onChange={handleChange('name')}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {t('booking.programs.create.fields.format.label', 'Format')}
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.format}
                onChange={handleChange('format')}
              >
                <option value="individual">{formatLabels.individual}</option>
                <option value="small_group">{formatLabels.small_group}</option>
                <option value="group">{formatLabels.group}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {t('booking.programs.create.fields.setting.label', 'Setting')}
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.setting}
                onChange={handleChange('setting')}
              >
                <option value="clinic">{settingLabels.clinic}</option>
                <option value="gym">{settingLabels.gym}</option>
                <option value="online">{settingLabels.online}</option>
                <option value="home">{settingLabels.home}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {t('booking.programs.create.fields.maxParticipants.label', 'Max antal deltagere')}
              </label>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.maxParticipants}
                onChange={handleChange('maxParticipants')}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {t('booking.programs.create.fields.durationWeeks.label', 'Varighed (uger)')}
              </label>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.weeks}
                onChange={handleChange('weeks')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {t('booking.programs.create.fields.sessionsPerWeek.label', 'Sessioner pr. uge')}
              </label>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.sessionsPerWeek}
                onChange={handleChange('sessionsPerWeek')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {t('booking.programs.create.fields.sessionLength.label', 'Varighed pr. session (min)')}
              </label>
              <input
                type="number"
                min="20"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.sessionLength}
                onChange={handleChange('sessionLength')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              {t('booking.programs.create.fields.goals.label', 'Kliniske & funktionelle mål')}
            </label>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t(
                'booking.programs.create.fields.goals.placeholder',
                'F.eks. reducere smerte, øge gangdistance, forbedre STS, øge selv-efficacy ift. træning osv.'
              )}
              value={form.goals}
              onChange={handleChange('goals')}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">
              {t('booking.programs.create.fields.content.label', 'Hvad indeholder forløbet typisk?')}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentEducation}
                  onChange={handleChange('contentEducation')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t('booking.programs.create.fields.content.education', 'Patientuddannelse / smerteforklaring')}
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentStrength}
                  onChange={handleChange('contentStrength')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t('booking.programs.create.fields.content.strength', 'Styrketræning (store muskelgrupper)')}
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentNeuromuscular}
                  onChange={handleChange('contentNeuromuscular')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t('booking.programs.create.fields.content.neuromuscular', 'Neuromuskulær træning / balance')}
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentHomeProgram}
                  onChange={handleChange('contentHomeProgram')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t('booking.programs.create.fields.content.homeProgram', 'Hjemmeprogram med progression')}
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentOutcomeMeasures}
                  onChange={handleChange('contentOutcomeMeasures')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t('booking.programs.create.fields.content.outcomes', 'Outcome-mål (f.eks. KOOS, HOOS, NRS, STS)')}
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              {t('booking.programs.create.fields.notes.label', 'Interne noter (valgfrit)')}
            </label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t(
                'booking.programs.create.fields.notes.placeholder',
                'Praktiske detaljer, kontraindikationer, krav til udstyr osv.'
              )}
              value={form.notes}
              onChange={handleChange('notes')}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-1">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t('booking.programs.summary.title', 'Overblik')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {form.name || t('booking.programs.summary.newProgram', 'Nyt forløb')}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {totalSessions > 0
                ? t(
                    'booking.programs.summary.sessions',
                    '{weeks} uger · {sessions} sessioner/uge · ca. {total} sessioner i alt',
                    { weeks: form.weeks, sessions: form.sessionsPerWeek, total: totalSessions }
                  )
                : t(
                    'booking.programs.summary.empty',
                    'Angiv uger og sessioner/uge for at se totalen.'
                  )}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              {t('booking.programs.summary.format', 'Format')}:{' '}
              <span className="font-medium">
                {form.format === 'individual'
                  ? formatLabels.individual
                  : form.format === 'small_group'
                  ? t('booking.programs.summary.formatSmall', 'Lille hold')
                  : t('booking.programs.summary.formatGroup', 'Hold')}
              </span>{' '}
              · {t('booking.programs.summary.setting', 'Setting')}:{' '}
              <span className="font-medium">
                {form.setting === 'clinic'
                  ? t('booking.programs.summary.settingClinic', 'Klinik')
                  : form.setting === 'gym'
                  ? t('booking.programs.summary.settingGym', 'Fitness')
                  : form.setting === 'online'
                  ? t('booking.programs.summary.settingOnline', 'Online')
                  : t('booking.programs.summary.settingHome', 'Hjemme')}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              {t('booking.programs.summary.maxParticipants', 'Max deltagere')}:{' '}
              <span className="font-medium">{form.maxParticipants}</span>
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t('booking.programs.financial.title', 'Økonomi')}
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-700">
                {t(
                  'booking.programs.financial.packagePrice',
                  'Pakkepris for hele forløbet ({currency})',
                  { currency: currencyLabel }
                )}
              </label>
              <input
                type="number"
                min="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.packagePrice}
                onChange={handleChange('packagePrice')}
              />
              <p className="text-[11px] text-slate-500">
                {t(
                  'booking.programs.financial.packageHint',
                  'Denne pris bruges i salg/fakturering, når klienten faktureres for hele forløbet.'
                )}
              </p>
            </div>
            {parseOptionalNumber(form.packagePrice) !== null && (
              <p className="mt-1 text-[11px] text-slate-600">
                {t('booking.programs.financial.packageSummary', 'Pakkepris for forløbet:')}{' '}
                <span className="font-semibold">
                  {currencyLabel}{' '}
                  {parseOptionalNumber(form.packagePrice)?.toLocaleString(locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="mt-auto inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            disabled={isSaving}
          >
            {isSaving
              ? t('booking.programs.actions.saving', 'Gemmer...')
              : t('booking.programs.actions.save', 'Gem forløb')}
          </button>
        </div>
      </form>
    </div>
  );
}

function Forloeb() {
  const { user, workspaceUid, activeClinicId } = useAuth();
  const clinicId = `${activeClinicId || ''}`.trim();
  const { t, locale } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [forloebList, setForloebList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!clinicId && !workspaceUid) {
      setForloebList([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setLoadError(null);
    let cancelled = false;
    let unsub = () => {};
    const setUnsubscribe = (nextUnsubscribe) => {
      let stopped = false;
      unsub = () => {
        if (stopped) return;
        stopped = true;
        nextUnsubscribe();
      };
    };
    const attachListener = async () => {
      if (clinicId && workspaceUid) {
        try {
          await migrateLegacyCollectionToClinic({
            clinicId,
            legacyOwnerUid: workspaceUid,
            collectionName: 'forloeb',
            transformDoc: ({ data }) => ({
              clinicId,
              createdByUid: data.createdByUid || data.therapistId || user?.uid || null,
            }),
          });
        } catch (migrationError) {
          console.error('[Forløb] migration error', migrationError);
        }
      }
      if (cancelled) return;
      const ref = clinicId
        ? collection(db, 'clinics', clinicId, 'forloeb')
        : collection(db, 'users', workspaceUid, 'forloeb');
      const q = query(ref, orderBy('createdAt', 'desc'));
      const stop = onSnapshot(
        q,
        (snap) => {
          if (cancelled) return;
          const mapped = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
            };
          });
          setForloebList(mapped);
          setLoading(false);
        },
        (err) => {
          if (cancelled) return;
          console.error('[Forløb] load error', err);
          setLoadError(t('booking.programs.errors.loadFailed', 'Kunne ikke hente forløb.'));
          setLoading(false);
        }
      );
      if (cancelled) {
        stop();
        return;
      }
      setUnsubscribe(stop);
    };
    void attachListener();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [clinicId, t, user?.uid, workspaceUid]);

  const filteredForloeb = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return forloebList;
    return forloebList.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const condition = (f.condition || '').toLowerCase();
      return name.includes(q) || condition.includes(q);
    });
  }, [searchQuery, forloebList]);
  const formatProgramPrice = (value) => {
    const parsed = parseOptionalNumber(value);
    if (parsed === null) return '—';
    return `${t('booking.services.price.currency', 'DKK')} ${parsed.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: t('booking.calendar.notLoggedIn', 'Ikke logget ind'),
        email: t('booking.calendar.loginToContinue', 'Log ind for at fortsætte'),
        initials: '?',
        photoURL: null,
      };
    }

    const name =
      user.displayName ||
      user.email ||
      t('booking.topbar.defaultUser', 'Selma bruger');
    const email = user.email || '—';
    const initialsSource = (user.displayName || user.email || '?').trim();
    const initials = initialsSource
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return {
      name,
      email,
      initials,
      photoURL: user.photoURL || null,
    };
  }, [user]);

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          <div className="booking-main">
          <div className="flex h-full flex-col gap-4 rounded-2xl bg-slate-50/60 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                  {t('booking.programs.list.title', 'Forløb')}
                </h1>
                <p className="text-xs text-slate-500 md:text-sm">
                  {t(
                    'booking.programs.list.subtitle',
                    'Overblik over dine gemte forløb. Opret nye med “Opret forløb”.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="toolbar-pill toolbar-primary"
              >
                {t('booking.programs.actions.create', 'Opret forløb')}
                <ChevronDown className="toolbar-caret" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  placeholder={t('booking.programs.list.searchPlaceholder', 'Søg forløb eller diagnose')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              {loading || loadError ? (
                <div className="p-6 text-sm text-slate-600">
                  {loadError || t('booking.programs.list.loading', 'Henter forløb...')}
                </div>
              ) : filteredForloeb.length === 0 ? (
                <div className="p-6 text-sm text-slate-600">
                  {t(
                    'booking.programs.list.empty',
                    'Ingen forløb endnu. Klik “Opret forløb” for at komme i gang.'
                  )}
                </div>
              ) : (
                <div className="p-4 grid gap-3 md:grid-cols-2">
                  {filteredForloeb.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.name || t('booking.programs.list.untitled', 'Uden navn')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.format === 'individual'
                              ? t('booking.programs.options.format.individualShort', 'Individuel')
                              : item.format === 'small_group'
                              ? t('booking.programs.options.format.smallGroupShort', 'Lille hold')
                              : t('booking.programs.options.format.groupShort', 'Hold')}{' '}
                            ·{' '}
                            {item.setting === 'clinic'
                              ? t('booking.programs.options.setting.clinicShort', 'Klinik')
                              : item.setting === 'gym'
                              ? t('booking.programs.options.setting.gymShort', 'Fitness')
                              : item.setting === 'online'
                              ? t('booking.programs.options.setting.onlineShort', 'Online')
                              : t('booking.programs.options.setting.homeShort', 'Hjemme')}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-slate-500">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString(locale)
                            : ''}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-[12px] text-slate-700 md:grid-cols-2">
                        <span>
                          {t(
                            'booking.programs.list.sessionsMeta',
                            '{weeks} uger · {sessions}/uge · {total} sessioner',
                            {
                              weeks: item.weeks || '?',
                              sessions: item.sessionsPerWeek || '?',
                              total: item.totalSessions || '?',
                            }
                          )}
                        </span>
                        <span>
                          {t(
                            'booking.programs.list.sessionLength',
                            'Varighed pr. session: {count} min',
                            { count: item.sessionLength || '?' }
                          )}
                        </span>
                        <span>
                          {t('booking.programs.list.packagePrice', 'Pakkepris:')}{' '}
                          {formatProgramPrice(item.packagePrice)}
                        </span>
                        <span>
                          {t(
                            'booking.programs.list.maxParticipants',
                            'Maks deltagere: {count}',
                            { count: item.maxParticipants || '—' }
                          )}
                        </span>
                      </div>
                      {item.goals && (
                        <p className="mt-2 text-[12px] text-slate-600 line-clamp-2">
                          {t('booking.programs.list.goals', 'Mål: {goals}', { goals: item.goals })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {showCreateModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.32)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1200,
              }}
            >
              <div
                style={{
                  width: 'min(1100px, 96vw)',
                  maxHeight: '94vh',
                  overflowY: 'auto',
                  background: '#fff',
                  borderRadius: '16px',
                  boxShadow: '0 24px 60px rgba(15,23,42,0.18)',
                }}
              >
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-sm font-semibold text-slate-900">
                    {t('booking.programs.actions.create', 'Opret forløb')}
                  </span>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '16px',
                      cursor: 'pointer',
                      color: '#0f172a',
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: '8px 8px 18px 8px' }}>
                  <ForlobCreate
                    isSaving={isSaving}
                    onSave={async (payload) => {
                      if (!clinicId && !workspaceUid) {
                        alert(t('booking.programs.errors.notLoggedIn', 'Log ind for at gemme forløb.'));
                        return;
                      }
                      setIsSaving(true);
                      try {
                        const collectionRef = clinicId
                          ? collection(db, 'clinics', clinicId, 'forloeb')
                          : collection(db, 'users', workspaceUid, 'forloeb');
                        const docPayload = {
                          ...payload,
                          clinicId: clinicId || null,
                          createdByUid: user?.uid || null,
                          therapistId: user?.uid || null,
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        };
                        await addDoc(collectionRef, docPayload);
                        setShowCreateModal(false);
                      } catch (err) {
                        console.error('[Forløb] Kunne ikke gemme forløb', err);
                        alert(
                          t('booking.programs.errors.saveFailed', 'Kunne ikke gemme forløb. Prøv igen.')
                        );
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </BookingSidebarLayout>
  );
}

export { ForlobCreate };
export default Forloeb;
