import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, CheckCircle2, MessageCircle, Sparkles } from 'lucide-react';

const FEATURE_ITEMS = [
  {
    title: 'Faglig Sparring (Clinical Decision Support)',
    description:
      'Er du i tvivl om en diagnose? Ally analyserer symptomerne og giver dig kvalificerede forslag baseret på evidens.',
  },
  {
    title: 'Kontekst-bevidst',
    description:
      'I modsætning til ChatGPT, kender Ally dine journaler. Den ved, at patienten har diabetes og tidligere knæskader, når du spørger om råd.',
  },
  {
    title: 'Administrativ Ninja',
    description:
      'Bed Ally om at skrive en henvisning, opsummere et langt forløb eller formulere en mail til en forsikring. Det tager sekunder.',
  },
];

const EXAMPLES = [
  {
    label: 'Statusattest',
    clinician:
      "Opsummer Hans' forløb de sidste 3 måneder og giv mig et forslag til statusattest.",
    ally:
      'Her er et kort udkast: Hans har fulgt 8 behandlingsgange med markant forbedret ROM og reduceret smerte. Anbefaler fortsat træning og opfølgning om 4 uger.',
  },
  {
    label: 'Henvisning',
    clinician: 'Skriv en henvisning til MR for Mette med mistanke om meniskskade.',
    ally:
      'Henvisning klar: Mette, 34 år, knæsmerter ved belastning og låsningsfornemmelse. Klinisk test positiv. Ønsker MR for afklaring.',
  },
  {
    label: 'Forsikringsmail',
    clinician: 'Lav en kort mail til forsikringen om Anders’ behandlingsstatus.',
    ally:
      'Mail udkast: Anders har gennemført 6 sessioner. Funktionsniveau forbedret 30%. Vi anbefaler 3 ekstra behandlinger for varig effekt.',
  },
  {
    label: 'Klinisk sparring',
    clinician: 'Har du forslag til næste behandling for en patient med kronisk lændesmerte?',
    ally:
      'Forslag: Fokus på gradueret belastning, core-stabilitet og individuel øvelsesplan. Overvej opfølgning efter 7-10 dage.',
  },
];

function SelmaCopilotPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-8">
        <Link to="/" className="text-lg font-semibold tracking-tight text-white">
          Selma+
        </Link>
        <Link
          to="/signup"
          className="rounded-full bg-[#4f6fc1] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#415fb6]"
        >
          Prøv systemet gratis
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-slate-950 to-[#111c32]" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white">
              Premium
            </span>
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-200" />
              Selma Copilot
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Selma Copilot: Aldrig mere alene i klinikken.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-200">
            Mød <span className="font-semibold text-white">Ally</span>. Din nye intelligente kollega, der kender dine
            patienter, husker retningslinjerne og altid har tid til faglig sparring.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              to="/signup"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
            >
              Prøv systemet gratis
            </Link>
            <span className="text-xs text-slate-400">
              AI-laget der gør Selma+ til din mest erfarne kollega.
            </span>
          </div>
        </div>
      </section>

      <section className="bg-[#0b1220] py-20 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              Ally, din AI-agent
            </p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Ally sidder altid klar i side-panelet.
            </h2>
            <p className="mt-4 text-base text-slate-200">
              Selma Copilot kører som et side-panel i dit system, så du kan spørge om råd, få udkast og
              sikre dokumentation uden at forlade patienten.
            </p>
            <div className="mt-6 grid gap-4">
              {FEATURE_ITEMS.map((item) => (
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
              Selma Copilot
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white">Ally</span>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.75fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Klinikoverblik
                </div>
                <div className="mt-3 space-y-3 text-xs text-slate-300">
                  <div className="rounded-xl bg-white/10 px-3 py-2">Dagens patienter: 12</div>
                  <div className="rounded-xl bg-white/10 px-3 py-2">Aktive forløb: 34</div>
                  <div className="rounded-xl bg-white/10 px-3 py-2">Næste opfølgning: 15:30</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                  <MessageCircle className="h-4 w-4" />
                  Ally chat
                </div>
                <div className="mt-3 space-y-3 text-xs">
                  <div className="rounded-2xl bg-white/10 px-3 py-2 text-slate-200">
                    <div className="text-[10px] font-semibold text-blue-200">Behandler</div>
                    <p>Opsummer Hans' forløb de sidste 3 måneder og giv mig et forslag til statusattest.</p>
                  </div>
                  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-50 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <div className="text-[10px] font-semibold text-blue-100">Ally</div>
                    <div className="mt-2 space-y-2 text-[11px] leading-relaxed">
                      <p>Her er hovedpunkterne til attesten:</p>
                      <p>
                        <span className="font-semibold">Diagnose:</span> Lumbal Discusprolaps (DM511)
                      </p>
                      <p>
                        <span className="font-semibold">Status:</span> Smerter reduceret (NRS 8 → 3).
                        Positiv Lasegue v. 60°.
                      </p>
                      <p>
                        <span className="font-semibold">Plan:</span> 4 ugers genoptræning + deltid.
                      </p>
                      <p>Jeg har oprettet dokumentet. Skal jeg sende det til godkendelse?</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              Side-panel med Ally er altid tilgængeligt under konsultationen.
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
            <Bot className="h-4 w-4" />
            Flere eksempler
          </div>
          <h3 className="mt-4 text-3xl font-semibold">Sådan bruger klinikker Ally i praksis</h3>
          <p className="mt-3 max-w-2xl text-base text-slate-200">
            Se konkrete scenarier, hvor Ally sparer tid, løfter kvaliteten og holder styr på dokumentationen.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {EXAMPLES.map((example) => (
              <div key={example.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                  {example.label}
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-slate-200">
                    <div className="text-[10px] font-semibold text-blue-200">Behandler</div>
                    <p>{example.clinician}</p>
                  </div>
                  <div className="rounded-2xl bg-white/20 px-4 py-3 text-white">
                    <div className="text-[10px] font-semibold text-blue-200">Ally</div>
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
            <h3 className="text-3xl font-semibold">Få Ally aktiveret i din klinik</h3>
            <p className="mt-3 text-base text-slate-600">
              Selma Copilot aktiveres som et premium lag oven på dit Selma+ system.
              Når det er aktivt, kan du spørge, diktere og dokumentere direkte fra journalen.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Premium AI-lag
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Klar til at opleve Ally? Kontakt os og få en demo af Selma Copilot.
            </p>
            <Link
              to="/signup"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Book en demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SelmaCopilotPage;
