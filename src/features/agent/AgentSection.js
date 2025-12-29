import React from "react";
import { motion } from "framer-motion";
import { Bot, Sparkles, CheckCircle2, Mic, Users, Command } from "lucide-react";

const soapNote = `Subjective:
- Patient reports neck stiffness after desk work.
- Symptoms worsen in the afternoon; relief with light movement.

Objective:
- Limited cervical rotation to the right.
- Tenderness along upper trapezius.

Assessment:
- Mechanical neck pain with muscular tension.

Plan:
- Manual therapy and mobility exercises.
- Home program: daily stretches + posture breaks.
- Follow-up in 1 week.`;

const statusSteps = [
  "Anamnese & Data",
  "Klinisk Strukturering",
  "Klar til Journalisering",
];

const motionProps = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" },
  viewport: { once: true, amount: 0.25 },
};

function AgentSection() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-16 text-slate-900">
      <motion.section
        className="pb-10"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Bot className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              <Sparkles className="h-3 w-3" />
              Agent for colleagues
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Klinik-Assistenten
              </h1>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                Ready
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-base text-slate-600">
          Selma+ uses Corti-grade infrastructure to turn consultations into structured notes for
          healthcare practitioners. Below, each capability is explained one step at a time.
        </p>
      </motion.section>

      <div className="space-y-16">
        <motion.section {...motionProps}>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="rounded-[32px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-8 shadow-xl shadow-emerald-200/50">
              <div className="rounded-2xl bg-white/90 p-5 shadow-lg">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                  <span className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Transcript
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
                <div className="mt-4 space-y-3 text-xs text-emerald-900">
                  <div>
                    <div className="font-semibold text-emerald-800">Clinician</div>
                    <div>Good morning. What brings you in today?</div>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-800">Patient</div>
                    <div>The pain started two days ago when walking.</div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Live or batch
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Upload in a batch or stream live
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Selma+ listens in real time during consultations or processes audio after the
                session. The same infrastructure supports any clinical workflow.
              </p>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm text-slate-600">
                <li>Live streaming for in-room visits and telehealth.</li>
                <li>Batch uploads for recorded notes or voice memos.</li>
                <li>Secure handling designed for healthcare data.</li>
              </ul>
            </div>
          </div>
        </motion.section>

        <motion.section {...motionProps}>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="lg:order-2">
              <div className="rounded-[32px] bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-700 p-8 shadow-xl shadow-emerald-200/50">
                <div className="rounded-2xl bg-white/90 p-5 shadow-lg">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                    <span className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Dictating
                    </span>
                    <span className="text-emerald-700">Continuous</span>
                  </div>
                  <p className="mt-4 text-xs text-emerald-900">
                    Clinical impression suggests upper trapezius strain with improved mobility
                    after light movement.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                      tendinopathy
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                      mobility
                    </span>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-600">
                      hypotension
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Medical language
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Capture clinical language naturally
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Selma+ understands medical terminology, abbreviations, and specialty language so
                transcripts are ready for review with minimal cleanup.
              </p>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm text-slate-600">
                <li>Handles mixed languages and everyday shorthand.</li>
                <li>Keeps critical terms intact for documentation.</li>
                <li>Learns clinic-specific phrasing over time.</li>
              </ul>
            </div>
          </div>
        </motion.section>

        <motion.section {...motionProps}>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="rounded-[32px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-8 shadow-xl shadow-emerald-200/50">
              <div className="rounded-2xl bg-white/90 p-5 shadow-lg">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <Users className="h-4 w-4" />
                  Diarization
                </div>
                <div className="mt-4 space-y-3 text-xs text-emerald-900">
                  <div>
                    <div className="font-semibold text-emerald-800">Patient</div>
                    <div>The pain sits behind my shoulder blade.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-800">Clinician</div>
                    <div>Does it change when you raise your arm?</div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Speaker clarity
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Diarize every speaker
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Selma+ separates patient and clinician voices so facts are attributed correctly
                and ready for structured documentation.
              </p>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm text-slate-600">
                <li>Clear speaker labels for fast review.</li>
                <li>Clean formatting for clinical handoffs.</li>
                <li>Optimized for SOAP extraction.</li>
              </ul>
            </div>
          </div>
        </motion.section>

        <motion.section {...motionProps}>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="lg:order-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      <Sparkles className="h-3 w-3" />
                      Agent Insight
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      Klinik-Assistenten
                    </div>
                  </div>
                  <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                    Ready
                  </span>
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  Jeg har struktureret samtalen efter kliniske standarder. Anamnesen er skilt fra
                  de objektive fund, så du hurtigt kan danne dig et overblik.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {statusSteps.map((label) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Draft journal note (SOAP)
                  </div>
                  <textarea
                    className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                    value={soapNote}
                    readOnly
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Structured output
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Structured SOAP output, ready to approve
              </h2>
              <p className="mt-4 text-base text-slate-600">
                The agent turns the consultation into a clean SOAP draft you can sign off in
                Selma+ or edit with your own clinical judgment.
              </p>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm text-slate-600">
                <li>Subjective, Objective, Assessment, Plan in one view.</li>
                <li>Editable before approval and export.</li>
                <li>Designed for clinic-specific workflows.</li>
              </ul>
            </div>
          </div>
        </motion.section>

        <motion.section {...motionProps}>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="rounded-[32px] bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-700 p-8 shadow-xl shadow-emerald-200/50">
              <div className="rounded-2xl bg-white/90 p-5 shadow-lg">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                  <span className="flex items-center gap-2">
                    <Command className="h-4 w-4" />
                    Review commands
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Ready
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-xs text-emerald-900">
                  <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                    Select last sentence
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 shadow-sm">
                    Approve for journal
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                    Share with colleague
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                In control
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                You are in command-and-control
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Selma+ keeps clinicians in control, with quick approvals and collaboration
                features for teams and colleagues.
              </p>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm text-slate-600">
                <li>Approve, edit, or reject sections before finalizing.</li>
                <li>Share drafts with colleagues for quick sign-off.</li>
                <li>Apply templates to keep documentation consistent.</li>
              </ul>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default AgentSection;
