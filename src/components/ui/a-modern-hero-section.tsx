import { Link } from 'react-router-dom';
import { CalendarDays, LayoutGrid, Mic } from 'lucide-react';

const SCROLL_DURATION_MS = 1350;
const SCROLL_KEY = 'selmaScrollToLiveBuilder';

const easeInOutCubic = (value: number) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

const animateScrollTo = (targetY: number, duration = SCROLL_DURATION_MS) => {
  const startY = window.scrollY || window.pageYOffset;
  const distance = targetY - startY;
  let startTime: number | null = null;

  const step = (timestamp: number) => {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo(0, startY + distance * eased);
    if (elapsed < duration) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

const scrollToElementById = (id: string, duration = SCROLL_DURATION_MS) => {
  if (typeof window === 'undefined') return false;
  const element = document.getElementById(id);
  if (!element) return false;
  const targetY = Math.max(0, element.getBoundingClientRect().top + window.pageYOffset - 16);
  animateScrollTo(targetY, duration);
  return true;
};

export default function HeroSection() {
  const handleScrollToBuilder = () => {
    const didScroll = scrollToElementById('live-builder-demo');
    if (didScroll) return;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SCROLL_KEY, '1');
      window.location.assign('/website-builder');
    }
  };

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top section with title and text */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-black mb-4 sm:mb-6 tracking-tight">
            Selma+
          </h1>
          <p className="text-lg sm:text-xl text-black mb-8 sm:mb-10 max-w-2xl mx-auto">
            Say hello to the newest members of the family.
          </p>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-12 sm:mb-16">
            <Link
              to="#demo"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 sm:px-10 sm:py-4 rounded-full text-base sm:text-lg transition-colors duration-200 min-w-[160px] text-center"
            >
              Læs mere
            </Link>
            <Link
              to="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 sm:px-10 sm:py-4 rounded-full text-base sm:text-lg transition-colors duration-200 min-w-[160px] text-center"
            >
              Prøv gratis
            </Link>
          </div>
        </div>

        {/* Acuity-style feature cards */}
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {/* Card 1: Website Builder + AI Agent */}
          <div className="rounded-[36px] bg-[#5a7cc8] p-6 shadow-xl shadow-slate-200/60">
            <div className="rounded-[28px] bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  WEBSITE &amp; AI AGENT
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <CalendarDays className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mx-auto w-full max-w-[220px] rounded-[26px] border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Booking
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900">Book your visit</div>
                  <div className="mt-3 space-y-2 text-[11px] text-slate-600">
                    {['Fysioterapi', 'Kiropraktik', 'Osteopati'].map((label) => (
                      <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span>{label}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          Vælg
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
                  >
                    Vælg tid
                  </button>
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-2xl font-semibold text-white">Say hello to new patients 24/7</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Via your new beautiful website we have built for you. And as a new feature, it is powered by an AI
              secretary that will answer every question they could have about your services.
            </p>
            <button
              type="button"
              onClick={handleScrollToBuilder}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#4f6fc1] shadow-sm transition hover:bg-white"
            >
              Try it out now 👇
            </button>
          </div>

          {/* Card 2: Journal & Economy */}
          <div className="rounded-[36px] bg-[#5a7cc8] p-6 shadow-xl shadow-slate-200/60">
            <div className="rounded-[28px] bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  CLINIC SYSTEM
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Mic className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Team calendar
                    <span className="text-slate-500">Week 32</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-[11px] text-slate-500">
                    {[
                      { name: "Anna", shade: "bg-blue-200/70" },
                      { name: "Jonas", shade: "bg-emerald-200/70" },
                      { name: "Sara", shade: "bg-violet-200/70" },
                    ].map((col) => (
                      <div key={col.name} className="space-y-2">
                        <div className="text-[10px] font-semibold text-slate-500">{col.name}</div>
                        <div className={`h-3 rounded-full ${col.shade}`} />
                        <div className="h-3 rounded-full bg-slate-100" />
                        <div className={`h-3 rounded-full ${col.shade}`} />
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-3 right-3 w-[170px] rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-lg">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                        <Mic className="h-3 w-3" />
                      </span>
                      AI forslag
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">Ny tid foreslået</div>
                    <div className="mt-1 text-xs text-slate-500">Patient: Emil • Ons 10:30</div>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-2xl font-semibold text-white">Det intelligente kliniksystem</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Glem alt om separate systemer. Få booking, team-kalender og AI-journalisering i ét flow. Fra
              stemmestyrede notater (Factr) til automatiske SMS-påmindelser og statistik – alt er samlet her.
            </p>
            <ul className="mt-5 grid gap-2 text-xs text-white/85">
              {[
                "✓ Team-overblik & Kalender",
                "✓ Voice-to-Text Journal (Factr)",
                "✓ AI-Agenter & Rådgivning",
                "✓ Patient-mål & Statistik",
              ].map((item) => (
                <li key={item} className="rounded-full bg-white/10 px-3 py-1">
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/features"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-white/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-[#4f6fc1]"
            >
              Udforsk systemet →
            </Link>
          </div>

          {/* Card 3: Admin overview */}
          <div className="rounded-[36px] bg-[#5a7cc8] p-6 shadow-xl shadow-slate-200/60">
            <div className="rounded-[28px] bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  OVERBLIK
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <LayoutGrid className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Bookinger', value: '28' },
                    { label: 'Omsætning', value: 'DKK 42k' },
                    { label: 'Nye klienter', value: '12' },
                    { label: 'Ugeplan', value: '7 dage' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-2xl font-semibold text-white">Fuldt overblik over klinikken</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Styr kalender, patienter og omsætning ét sted. Få ro i maven og fokus på behandling.
            </p>
            <Link
              to="/features"
              className="mt-6 inline-flex text-sm font-semibold text-white/90 transition hover:text-white"
            >
              Se admin-funktioner →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
