import React, { useCallback } from 'react';
import { Briefcase, Calendar, ShieldCheck, Sparkles, Store } from 'lucide-react';

const cards = [
  {
    id: 'axis',
    title: 'Axis',
    label: 'AI Journal',
    description: 'Live notes that listen, structure SOAP, and keep the clinical flow intact.',
    chips: ['SOAP', 'Voice', 'Auto-draft'],
    icon: Sparkles,
    span: 'md:col-span-2',
    isWide: true,
    isPulse: true,
    accent: 'text-emerald-300',
  },
  {
    id: 'atlas',
    title: 'Atlas',
    label: 'Booking + Calendar',
    description: 'Smart scheduling that fills gaps and keeps your day predictable.',
    chips: ['Smart gaps', 'Waitlist'],
    icon: Calendar,
    accent: 'text-sky-300',
  },
  {
    id: 'admin',
    title: 'Admin',
    label: 'Operations',
    description: 'Staff, rooms, and clinic settings in one calm control center.',
    chips: ['Teams', 'Rooms'],
    icon: Briefcase,
    accent: 'text-violet-300',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    label: 'Security',
    description: 'Audit trails, consent logs, and clinical-grade data handling.',
    chips: ['Audit trails', 'GDPR ready'],
    icon: ShieldCheck,
    accent: 'text-amber-300',
  },
  {
    id: 'labs',
    title: 'Selma Labs',
    label: 'Marketplace',
    description: 'Add-on apps, templates, and integrations that extend Selma+.',
    chips: ['Integrations', 'Templates', 'Apps'],
    icon: Store,
    span: 'md:col-span-2',
    isWide: true,
    accent: 'text-teal-300',
  },
];

function Both() {
  const handleSpotlight = useCallback((event) => {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - left) / width) * 100;
    const y = ((event.clientY - top) / height) * 100;
    event.currentTarget.style.setProperty('--spotlight-x', `${x}%`);
    event.currentTarget.style.setProperty('--spotlight-y', `${y}%`);
  }, []);

  return (
    <section className="w-full" id="products">
      <div className="flex w-full flex-col gap-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Selma+ Suite
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            The clinical workspace, built as a product suite
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Five focused products share one infrastructure so clinics can stay in flow without
            switching tools.
          </p>
        </div>

        <div className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className={`group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900 p-6 text-white shadow-[0_25px_60px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-1 ${
                  card.span ?? ''
                } ${card.isWide ? 'min-h-[250px]' : 'min-h-[220px]'}`}
                onMouseMove={handleSpotlight}
                style={{ '--spotlight-x': '50%', '--spotlight-y': '50%' }}
              >
                {card.isPulse && (
                  <span className="pointer-events-none absolute inset-0 rounded-3xl border border-emerald-400/30 bg-emerald-400/5 opacity-70 animate-[pulse_6s_ease-in-out_infinite]" />
                )}

                <span
                  className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(240px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(59, 130, 246, 0.35), transparent 70%)',
                  }}
                />

                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                      {card.label}
                    </p>
                    <h3 className={`${card.isWide ? 'text-2xl' : 'text-xl'} font-semibold`}>
                      {card.title}
                    </h3>
                  </div>
                  <span
                    className={`flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/60 ${
                      card.isWide ? 'h-14 w-14' : 'h-11 w-11'
                    }`}
                  >
                    <Icon className={`${card.isWide ? 'h-7 w-7' : 'h-5 w-5'} ${card.accent}`} />
                  </span>
                </div>

                <p className="relative z-10 text-sm leading-relaxed text-slate-300">
                  {card.description}
                </p>

                <div className="relative z-10 mt-auto flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  {card.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-slate-700/70 bg-slate-800/70 px-3 py-1"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Both;
