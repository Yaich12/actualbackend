import React, { useEffect, useMemo, useState } from 'react';
import '../bookingpage.css';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ChevronDown } from 'lucide-react';

function ForlobCreate({ onSave, isSaving = false }) {
  const [form, setForm] = useState({
    name: '',
    condition: 'knee_oa',
    format: 'group',
    setting: 'clinic',
    weeks: 8,
    sessionsPerWeek: 2,
    sessionLength: 60,
    pricePerSession: '',
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
      ...form,
      totalSessions,
      createdAt: new Date().toISOString(),
    };
    if (onSave) {
      await onSave(payload);
      return;
    }
    console.log('Forløb klar til gemning:', payload);
    alert('Forløb oprettet (hook det op til Firestore senere).');
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-slate-50/60 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
            Opret nyt forløb
          </h1>
          <p className="text-xs text-slate-500 md:text-sm">
            Design et struktureret behandlingsforløb – f.eks. artroseforløb, GLAD-hold eller postoperativ genoptræning.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-3 md:p-6"
      >
        <div className="space-y-4 md:col-span-2">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Forløbsnavn</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="GLAD knæ, Hofteartrose-forløb, Lændehold, osv."
                value={form.name}
                onChange={handleChange('name')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Primær problemstilling</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.condition}
                onChange={handleChange('condition')}
              >
                <option value="knee_oa">Knæartrose</option>
                <option value="hip_oa">Hofteartrose</option>
                <option value="glad">GLAD-forløb</option>
                <option value="acl">Postoperativ ACL</option>
                <option value="shoulder">Skulder / impingement</option>
                <option value="low_back">Uspecifik lændesmerte</option>
                <option value="other">Andet / blandet MSK</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Format</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.format}
                onChange={handleChange('format')}
              >
                <option value="individual">Individuel</option>
                <option value="small_group">Lille hold (2–4)</option>
                <option value="group">Hold (5–12)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Setting</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.setting}
                onChange={handleChange('setting')}
              >
                <option value="clinic">Klinik / træningssal</option>
                <option value="gym">Fitnesscenter</option>
                <option value="online">Online / hybrid</option>
                <option value="home">Hjemmebaseret</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Max antal deltagere</label>
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
              <label className="text-xs font-medium text-slate-700">Varighed (uger)</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.weeks}
                onChange={handleChange('weeks')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Sessioner pr. uge</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.sessionsPerWeek}
                onChange={handleChange('sessionsPerWeek')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Varighed pr. session (min)</label>
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
            <label className="text-xs font-medium text-slate-700">Kliniske & funktionelle mål</label>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="F.eks. reducere smerte, øge gangdistance, forbedre STS, øge selv-efficacy ift. træning osv."
              value={form.goals}
              onChange={handleChange('goals')}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">Hvad indeholder forløbet typisk?</p>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentEducation}
                  onChange={handleChange('contentEducation')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Patientuddannelse / smerteforklaring
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentStrength}
                  onChange={handleChange('contentStrength')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Styrketræning (store muskelgrupper)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentNeuromuscular}
                  onChange={handleChange('contentNeuromuscular')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Neuromuskulær træning / balance
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentHomeProgram}
                  onChange={handleChange('contentHomeProgram')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Hjemmeprogram med progression
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.contentOutcomeMeasures}
                  onChange={handleChange('contentOutcomeMeasures')}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Outcome-mål (f.eks. KOOS, HOOS, NRS, STS)
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Interne noter (valgfrit)</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Praktiske detaljer, kontraindikationer, krav til udstyr osv."
              value={form.notes}
              onChange={handleChange('notes')}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-1">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Overblik</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{form.name || 'Nyt forløb'}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {totalSessions > 0
                ? `${form.weeks} uger · ${form.sessionsPerWeek} sessioner/uge · ca. ${totalSessions} sessioner i alt`
                : 'Angiv uger og sessioner/uge for at se totalen.'}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Format:{' '}
              <span className="font-medium">
                {form.format === 'individual' ? 'Individuel' : form.format === 'small_group' ? 'Lille hold' : 'Hold'}
              </span>{' '}
              · Setting:{' '}
              <span className="font-medium">
                {form.setting === 'clinic'
                  ? 'Klinik'
                  : form.setting === 'gym'
                  ? 'Fitness'
                  : form.setting === 'online'
                  ? 'Online'
                  : 'Hjemme'}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Max deltagere: <span className="font-medium">{form.maxParticipants}</span>
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Økonomi</p>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-700">Pris pr. session (DKK)</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.pricePerSession}
                onChange={handleChange('pricePerSession')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-700">Pakkepris for hele forløbet (DKK)</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.packagePrice}
                onChange={handleChange('packagePrice')}
              />
              <p className="text-[11px] text-slate-500">
                Du kan udfylde begge felter og vælge i faktureringen, hvad du bruger i praksis.
              </p>
            </div>
            {totalSessions > 0 && form.pricePerSession && (
              <p className="mt-1 text-[11px] text-slate-600">
                Estimeret omsætning pr. deltager ved sessionpris:{' '}
                <span className="font-semibold">
                  DKK {(totalSessions * (Number(form.pricePerSession) || 0)).toLocaleString('da-DK', { minimumFractionDigits: 2 })}
                </span>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="mt-auto inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            disabled={isSaving}
          >
            {isSaving ? 'Gemmer...' : 'Gem forløb'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Forloeb() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [forloebList, setForloebList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      setForloebList([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setLoadError(null);
    const ref = collection(db, 'users', user.uid, 'forloeb');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
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
        console.error('[Forløb] load error', err);
        setLoadError('Kunne ikke hente forløb.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const filteredForloeb = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return forloebList;
    return forloebList.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const condition = (f.condition || '').toLowerCase();
      return name.includes(q) || condition.includes(q);
    });
  }, [searchQuery, forloebList]);

  const conditionLabel = (value) => {
    switch (value) {
      case 'knee_oa':
        return 'Knæartrose';
      case 'hip_oa':
        return 'Hofteartrose';
      case 'glad':
        return 'GLAD-forløb';
      case 'acl':
        return 'Postoperativ ACL';
      case 'shoulder':
        return 'Skulder / impingement';
      case 'low_back':
        return 'Uspecifik lændesmerte';
      default:
        return 'Andet';
    }
  };

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: 'Ikke logget ind',
        email: 'Log ind for at fortsætte',
        initials: '?',
        photoURL: null,
      };
    }

    const name = user.displayName || user.email || 'Selma bruger';
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
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">Forløb</h1>
                <p className="text-xs text-slate-500 md:text-sm">
                  Overblik over dine gemte forløb. Opret nye med “Opret forløb”.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="toolbar-pill toolbar-primary"
              >
                Opret forløb
                <ChevronDown className="toolbar-caret" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  placeholder="Søg forløb eller diagnose"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              {loading || loadError ? (
                <div className="p-6 text-sm text-slate-600">
                  {loadError || 'Henter forløb...'}
                </div>
              ) : filteredForloeb.length === 0 ? (
                <div className="p-6 text-sm text-slate-600">
                  Ingen forløb endnu. Klik “Opret forløb” for at komme i gang.
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
                            {item.name || 'Uden navn'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {conditionLabel(item.condition)} · {item.format === 'individual'
                              ? 'Individuel'
                              : item.format === 'small_group'
                              ? 'Lille hold'
                              : 'Hold'} · {item.setting === 'clinic'
                              ? 'Klinik'
                              : item.setting === 'gym'
                              ? 'Fitness'
                              : item.setting === 'online'
                              ? 'Online'
                              : 'Hjemme'}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-slate-500">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('da-DK') : ''}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-[12px] text-slate-700 md:grid-cols-2">
                        <span>
                          {item.weeks || '?'} uger · {item.sessionsPerWeek || '?'}/uge ·{' '}
                          {item.totalSessions || '?'} sessioner
                        </span>
                        <span>Varighed pr. session: {item.sessionLength || '?'} min</span>
                        <span>
                          Pris pr. session:{' '}
                          {item.pricePerSession
                            ? `DKK ${Number(item.pricePerSession).toLocaleString('da-DK', {
                                minimumFractionDigits: 2,
                              })}`
                            : '—'}
                        </span>
                        <span>
                          Pakkepris:{' '}
                          {item.packagePrice
                            ? `DKK ${Number(item.packagePrice).toLocaleString('da-DK', {
                                minimumFractionDigits: 2,
                              })}`
                            : '—'}
                        </span>
                        <span>Maks deltagere: {item.maxParticipants || '—'}</span>
                      </div>
                      {item.goals && (
                        <p className="mt-2 text-[12px] text-slate-600 line-clamp-2">
                          Mål: {item.goals}
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
                  <span className="text-sm font-semibold text-slate-900">Opret forløb</span>
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
                      if (!user?.uid) {
                        alert('Log ind for at gemme forløb.');
                        return;
                      }
                      setIsSaving(true);
                      try {
                        const collectionRef = collection(db, 'users', user.uid, 'forloeb');
                        const docPayload = {
                          ...payload,
                          therapistId: user.uid,
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        };
                        await addDoc(collectionRef, docPayload);
                        setShowCreateModal(false);
                      } catch (err) {
                        console.error('[Forløb] Kunne ikke gemme forløb', err);
                        alert('Kunne ikke gemme forløb. Prøv igen.');
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
