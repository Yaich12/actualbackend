import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Mic, Sparkles } from "lucide-react";
import FactsRPanel from "../../features/booking/Journal/indlæg/FactsRPanel";
import Whisper from "../../features/booking/Journal/indlæg/whisper";
import "../../features/booking/Journal/indlæg/indlæg.css";

const FEATURE_TABS = [
  {
    id: "transcription",
    label: "Transkribering",
    title: "Live transkribering direkte i journalen",
    description:
      "Selma+ lytter med og skriver samtalen ned, mens du behandler. Du får et ryddeligt transkript uden ekstra klik.",
    bullets: [
      "Speaker-adskillelse og tydelige markeringer",
      "Seneste sætninger ligger klar til gennemgang",
      "Skabt til kliniske noter og ro i rummet",
    ],
  },
  {
    id: "facts",
    label: "FactsR™",
    title: "FactsR™ udleder kliniske fakta automatisk",
    description:
      "FactsR sorterer samtalen i Anamnese, Fund og Plan, så du kan indsætte forslag direkte i journalens felter.",
    bullets: [
      "Auto-forslag til de rigtige journal-sektioner",
      "Indsæt enkelt-facts eller hele blokke",
      "Sparer tid uden at gå på kompromis",
    ],
  },
];

const FACTS_PANEL_SAMPLE = [
  { id: "f-1", text: "Smerter i højre skulder ved løft", group: "Anamnese" },
  { id: "f-2", text: "Debut for 3 uger siden efter havearbejde", group: "Anamnese" },
  { id: "f-3", text: "Nedsat ROM ved abduktion", group: "Fund" },
  { id: "f-4", text: "Palpationsømhed omkring deltoideus", group: "Fund" },
  { id: "f-5", text: "Træningsprogram 2x/uge", group: "Plan" },
  { id: "f-6", text: "Opfølgning om 2 uger", group: "Plan" },
];

const FACTS_PANEL_TRANSCRIPTS = [
  { id: "t-1", transcript: "Patienten angiver smerter ved løft.", final: true },
  { id: "t-2", transcript: "Tester ROM og planlægger øvelser.", final: true },
  { id: "t-3", transcript: "Opfølgning om to uger.", final: false },
];

const WHISPER_SAMPLE = {
  text:
    "Behandler: Hvordan har skulderen været siden sidst?\n\n" +
    "Patient: Den er bedre, men stadig stram ved løft.\n\n" +
    "Behandler: Vi tester ROM og justerer øvelserne.\n\n" +
    "Patient: Det lyder godt.",
  usage: {
    type: "clinical",
    input_tokens: 812,
    output_tokens: 156,
    total_tokens: 968,
    input_token_details: {
      text_tokens: 410,
      audio_tokens: 402,
    },
  },
};

const FACTS_STYLE_VARS = {
  "--bg-surface": "#ffffff",
  "--bg-subtle": "#f8fafc",
  "--text-primary": "#0f172a",
  "--text-muted": "#64748b",
  "--border-subtle": "#e2e8f0",
};

const transition = { duration: 0.45, ease: "easeOut" };

function FeaturesWorkflow({ sectionId } = {}) {
  const [activeId, setActiveId] = useState("facts");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "features-transcription") {
        setActiveId("transcription");
      }
      if (hash === "features-factsr") {
        setActiveId("facts");
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const activeFeature = useMemo(
    () => FEATURE_TABS.find((feature) => feature.id === activeId) || FEATURE_TABS[0],
    [activeId]
  );

  const isFacts = activeId === "facts";
  const AccentIcon = isFacts ? Sparkles : Mic;
  const accentBg = isFacts ? "bg-emerald-50" : "bg-blue-50";
  const accentText = isFacts ? "text-emerald-600" : "text-blue-600";
  const badgeClasses = isFacts ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700";
  const dotPing = isFacts ? "bg-emerald-400" : "bg-blue-400";
  const dotSolid = isFacts ? "bg-emerald-500" : "bg-blue-500";

  return (
    <section id={sectionId} className="bg-white py-16 text-slate-900 scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Funktioner
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Transkribering og FactsR - sådan bruger du det i journalen
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Vi viser præcis den arbejdsgang, du møder inde i journalen - bare gjort
            klar til forsiden, så det er nemt at forstå for behandleren.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div id="features-transcription" className="scroll-mt-24" aria-hidden="true" />
          <div id="features-factsr" className="scroll-mt-24" aria-hidden="true" />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Selma+ journal features">
            {FEATURE_TABS.map((feature) => {
              const isActive = feature.id === activeId;
              return (
                <button
                  key={feature.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(feature.id)}
                  className={`flex flex-1 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition sm:min-w-[220px] ${
                    isActive
                      ? "border-slate-200 bg-slate-50 text-slate-900 shadow-sm"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base font-semibold">{feature.label}</span>
                  <span className="text-xs text-slate-400">Journal</span>
                </button>
              );
            })}
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={transition}
                className="space-y-6"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {isFacts ? "FactsR™ i journalen" : "Live transkribering"}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {activeFeature.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-600">
                    {activeFeature.description}
                  </p>
                </div>
                <div className="grid gap-3">
                  {activeFeature.bullets.map((bullet) => (
                    <div key={bullet} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-medium text-slate-700">{bullet}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentBg}`}>
                    <AccentIcon className={`h-6 w-6 ${accentText}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {isFacts ? "FactsR™" : "Live transkript"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isFacts ? "Powered by Corti" : "Sikker lyd optagelse"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses}`}>
                    Live
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotPing}`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${dotSolid}`} />
                    </span>
                    Optag
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" style={FACTS_STYLE_VARS}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={transition}
                    className="pointer-events-none max-h-[520px] overflow-hidden"
                  >
                    {isFacts ? (
                      <FactsRPanel
                        status="streaming"
                        interactionId="7f23-9a2b"
                        transcripts={FACTS_PANEL_TRANSCRIPTS}
                        facts={FACTS_PANEL_SAMPLE}
                        isRecording
                        recordingStatus="Optager i baggrunden"
                        onToggleRecording={() => {}}
                        insertTarget="auto"
                        onChangeInsertTarget={() => {}}
                        suggestionForFact={(fact) => {
                          const group = `${fact?.group || ""}`.toLowerCase();
                          if (group.includes("fund")) {
                            return { label: "Fund", key: "objective" };
                          }
                          if (group.includes("plan")) {
                            return { label: "Plan", key: "plan" };
                          }
                          return { label: "Anamnese", key: "anamnesis" };
                        }}
                        onInsertSelected={() => {}}
                        onInsertAll={() => {}}
                        onInsertOne={() => {}}
                        onFlush={() => {}}
                        onClear={() => {}}
                      />
                    ) : (
                      <Whisper data={WHISPER_SAMPLE} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesWorkflow;
