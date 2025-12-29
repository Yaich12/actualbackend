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
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-4 sm:mb-6 tracking-tight">
            The first clinic system designed to disappear.
          </h2>
          <p className="text-lg sm:text-xl text-black/80 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed">
            You became a therapist to heal people, not to manage software. That&apos;s why we built Selma+. It handles
            the booking, writes the journals, and balances the books—automatically. So you can stop looking at the
            screen, and start looking at your patient.
          </p>
          <p className="text-sm sm:text-base text-black/70 font-medium tracking-wide mb-8 sm:mb-10">
            See how we give you your time back:
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
          <div className="rounded-[36px] bg-[#5a7cc8] p-7 sm:p-8 shadow-xl shadow-slate-200/60">
            <div className="rounded-[28px] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  DIGITAL RECEPTION
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <CalendarDays className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span>Selma+ Reception</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-[12px] text-slate-600">
                    Velkommen til Klinik Selma, hvad kan jeg hjælpe med?
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400">
                    Skriv en besked...
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white">
                      Send
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-2xl font-semibold text-white">Din klinik er altid åben</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Få en smuk hjemmeside med indbygget AI-receptionist. Den tager imod nye patienter og svarer på spørgsmål
              døgnet rundt – også mens du sover.
            </p>
            <Link
              to="/website-builder"
              onClick={(event) => {
                event.preventDefault();
                handleScrollToBuilder();
              }}
              className="mt-6 inline-flex items-center justify-center text-sm font-semibold text-white/95 transition hover:text-white"
            >
              Se løsningen →
            </Link>
          </div>

          {/* Card 2: Journal & Economy */}
          <div className="rounded-[36px] bg-[#5a7cc8] p-7 sm:p-8 shadow-xl shadow-slate-200/60">
            <div className="rounded-[28px] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  INTELLIGENT SYSTEM
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Mic className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">Kalender</div>
                      <div className="mt-3 space-y-2">
                        <div className="h-2 w-full rounded-full bg-blue-200/80" />
                        <div className="h-2 w-5/6 rounded-full bg-slate-200" />
                        <div className="h-2 w-4/5 rounded-full bg-blue-200/70" />
                        <div className="h-2 w-2/3 rounded-full bg-slate-200" />
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Journal
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-semibold text-white">
                          AI
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="h-2 w-full rounded-full bg-emerald-200/70" />
                        <div className="h-2 w-4/5 rounded-full bg-slate-200" />
                        <div className="h-2 w-5/6 rounded-full bg-emerald-200/60" />
                        <div className="h-2 w-2/3 rounded-full bg-slate-200" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-2xl font-semibold text-white">Mere tid til behandling</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Slut med at klikke rundt. I Selma+ er din kalender og journal smeltet sammen, og AI-assistenten hjælper
              dig med at skrive notaterne lynhurtigt.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/features"
                className="inline-flex items-center justify-center rounded-full border border-white/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-[#4f6fc1]"
              >
                Udforsk systemet →
              </Link>
              <Link
                to="/selma-copilot"
                className="inline-flex items-center justify-center rounded-full border border-white/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-[#4f6fc1]"
              >
                Mød Ally →
              </Link>
            </div>
          </div>

          {/* Card 3: Admin overview */}
          <div className="rounded-[36px] bg-[#5a7cc8] p-7 sm:p-8 shadow-xl shadow-slate-200/60">
            <div className="rounded-[28px] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  OVERBLIK
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <LayoutGrid className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Omsætning</span>
                      <span className="text-emerald-600">+12%</span>
                    </div>
                    <div className="mt-3 h-12 rounded-xl bg-emerald-50 p-2">
                      <div className="h-full w-full rounded-lg bg-gradient-to-r from-emerald-200 via-emerald-100 to-white" />
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                      Status: Alt afstemt
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white">
                        ✓
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-2xl font-semibold text-white">Ro i maven omkring tallene</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Slip for det manuelle bøvl. Fakturering, indberetning til &quot;danmark&quot; og regnskab sker automatisk
              i baggrunden.
            </p>
            <Link
              to="/features/operations"
              className="mt-6 inline-flex text-sm font-semibold text-white/90 transition hover:text-white"
            >
              Se funktioner →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
