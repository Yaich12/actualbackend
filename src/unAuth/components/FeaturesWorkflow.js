import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Mic, Sparkles } from "lucide-react";
import FactsRPanel from "../../features/booking/Journal/indlæg/FactsRPanel";
import Whisper from "../../features/booking/Journal/indlæg/whisper";
import { useLanguage } from "../language/LanguageProvider";
import "../../features/booking/Journal/indlæg/indlæg.css";

const FACTS_STYLE_VARS = {
  "--bg-surface": "#ffffff",
  "--bg-subtle": "#f8fafc",
  "--text-primary": "#0f172a",
  "--text-muted": "#64748b",
  "--border-subtle": "#e2e8f0",
};

const transition = { duration: 0.45, ease: "easeOut" };

function FeaturesWorkflow({ sectionId } = {}) {
  const { t, getArray } = useLanguage();
  const [activeId, setActiveId] = useState("facts");

  const featureTabs = getArray("features.workflow.tabs", []);
  const factsSample = getArray("features.workflow.sample.facts", []);
  const transcriptSample = getArray("features.workflow.sample.transcripts", []);

  const whisperSample = useMemo(
    () => ({
      text: t("features.workflow.sample.whisperText"),
      usage: {
        type: t("features.workflow.whisper.usageType"),
        input_tokens: 812,
        output_tokens: 156,
        total_tokens: 968,
        input_token_details: {
          text_tokens: 410,
          audio_tokens: 402,
        },
      },
    }),
    [t]
  );

  const factsGroupLabels = useMemo(
    () => ({
      anamnesis: t("features.workflow.factsPanel.groups.anamnesis"),
      objective: t("features.workflow.factsPanel.groups.objective"),
      plan: t("features.workflow.factsPanel.groups.plan"),
    }),
    [t]
  );

  const factsPanelLabels = useMemo(
    () => ({
      title: t("features.workflow.factsPanel.title"),
      poweredBy: t("features.workflow.factsPanel.poweredBy"),
      groupFallback: t("features.workflow.factsPanel.groupFallback"),
      status: {
        connecting: t("features.workflow.factsPanel.status.connecting"),
        streaming: t("features.workflow.factsPanel.status.streaming"),
        finalizing: t("features.workflow.factsPanel.status.finalizing"),
        ended: t("features.workflow.factsPanel.status.ended"),
        error: t("features.workflow.factsPanel.status.error"),
        idle: t("features.workflow.factsPanel.status.idle"),
      },
      record: {
        start: t("features.workflow.factsPanel.record.start"),
        stop: t("features.workflow.factsPanel.record.stop"),
      },
      interactionLabel: t("features.workflow.factsPanel.interaction"),
      latestLabel: t("features.workflow.factsPanel.latest"),
      insertBarLabel: t("features.workflow.factsPanel.insertBarLabel"),
      insertBarTitle: t("features.workflow.factsPanel.insertBarTitle"),
      insertTargets: {
        auto: t("features.workflow.factsPanel.insertTargets.auto"),
        anamnesis: t("features.workflow.factsPanel.insertTargets.anamnesis"),
        conclusion_focus: t("features.workflow.factsPanel.insertTargets.conclusionFocus"),
        conclusion_content: t("features.workflow.factsPanel.insertTargets.conclusionContent"),
        conclusion_tasks: t("features.workflow.factsPanel.insertTargets.conclusionTasks"),
        conclusion_reflection: t("features.workflow.factsPanel.insertTargets.conclusionReflection"),
        combined: t("features.workflow.factsPanel.insertTargets.combined"),
      },
      insertSelected: t("features.workflow.factsPanel.insertSelected"),
      insertSelectedTitle: t("features.workflow.factsPanel.insertSelectedTitle"),
      insertAll: t("features.workflow.factsPanel.insertAll"),
      insertAllTitle: t("features.workflow.factsPanel.insertAllTitle"),
      tabs: {
        facts: t("features.workflow.factsPanel.tabs.facts"),
        transcript: t("features.workflow.factsPanel.tabs.transcript"),
      },
      actions: {
        flush: t("features.workflow.factsPanel.actions.flush"),
        clear: t("features.workflow.factsPanel.actions.clear"),
      },
      item: {
        select: t("features.workflow.factsPanel.item.select"),
        recommended: t("features.workflow.factsPanel.item.recommended"),
        insert: t("features.workflow.factsPanel.item.insert"),
        insertTitle: t("features.workflow.factsPanel.item.insertTitle"),
      },
      empty: {
        facts: t("features.workflow.factsPanel.empty.facts"),
        transcript: t("features.workflow.factsPanel.empty.transcript"),
      },
      meta: {
        source: t("features.workflow.factsPanel.meta.source"),
        discarded: t("features.workflow.factsPanel.meta.discarded"),
      },
    }),
    [t]
  );

  const formattedFacts = useMemo(
    () =>
      factsSample.map((fact) => ({
        ...fact,
        group: factsGroupLabels[fact.groupKey] || fact.group || "",
      })),
    [factsGroupLabels, factsSample]
  );

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
    () =>
      featureTabs.find((feature) => feature.id === activeId) ||
      featureTabs[0] || { id: activeId, title: "", description: "", bullets: [] },
    [activeId, featureTabs]
  );
  const activeBullets = activeFeature?.bullets || [];

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
            {t("features.workflow.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            {t("features.workflow.title")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            {t("features.workflow.description")}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div id="features-transcription" className="scroll-mt-24" aria-hidden="true" />
          <div id="features-factsr" className="scroll-mt-24" aria-hidden="true" />
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label={t("features.workflow.ariaLabel")}
          >
            {featureTabs.map((feature) => {
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
                  <span className="text-xs text-slate-400">{t("features.workflow.tabTag")}</span>
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
                  {isFacts
                    ? t("features.workflow.badge.facts")
                    : t("features.workflow.badge.transcription")}
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
                  {activeBullets.map((bullet) => (
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
                      {isFacts
                        ? t("features.workflow.panel.titleFacts")
                        : t("features.workflow.panel.titleTranscription")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isFacts
                        ? t("features.workflow.panel.subtitleFacts")
                        : t("features.workflow.panel.subtitleTranscription")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses}`}>
                    {t("features.workflow.panel.liveBadge")}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotPing}`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${dotSolid}`} />
                    </span>
                    {t("features.workflow.panel.record")}
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
                        transcripts={transcriptSample}
                        facts={formattedFacts}
                        isRecording
                        recordingStatus={t("features.workflow.panel.recordingStatus")}
                        onToggleRecording={() => {}}
                        insertTarget="auto"
                        onChangeInsertTarget={() => {}}
                        labels={factsPanelLabels}
                        suggestionForFact={(fact) => {
                          const groupKey = fact?.groupKey;
                          if (groupKey === "objective") {
                            return { label: factsGroupLabels.objective, key: "objective" };
                          }
                          if (groupKey === "plan") {
                            return { label: factsGroupLabels.plan, key: "plan" };
                          }
                          if (!groupKey && typeof fact?.group === "string") {
                            const normalized = fact.group.toLowerCase();
                            if (normalized.includes(factsGroupLabels.objective.toLowerCase())) {
                              return { label: factsGroupLabels.objective, key: "objective" };
                            }
                            if (normalized.includes(factsGroupLabels.plan.toLowerCase())) {
                              return { label: factsGroupLabels.plan, key: "plan" };
                            }
                          }
                          return { label: factsGroupLabels.anamnesis, key: "anamnesis" };
                        }}
                        onInsertSelected={() => {}}
                        onInsertAll={() => {}}
                        onInsertOne={() => {}}
                        onFlush={() => {}}
                        onClear={() => {}}
                      />
                    ) : (
                      <Whisper
                        data={whisperSample}
                        labels={{
                          ariaLabel: t("features.workflow.whisper.ariaLabel"),
                          title: t("features.workflow.whisper.title"),
                          subtitle: t("features.workflow.whisper.subtitle"),
                          excerptTitle: t("features.workflow.whisper.excerptTitle"),
                          placeholder: t("features.workflow.whisper.placeholder"),
                          usageTitle: t("features.workflow.whisper.usageTitle"),
                          usageLabels: {
                            type: t("features.workflow.whisper.usageLabels.type"),
                            input: t("features.workflow.whisper.usageLabels.input"),
                            output: t("features.workflow.whisper.usageLabels.output"),
                            total: t("features.workflow.whisper.usageLabels.total"),
                            textTokens: t("features.workflow.whisper.usageLabels.textTokens"),
                            audioTokens: t("features.workflow.whisper.usageLabels.audioTokens"),
                          },
                        }}
                      />
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
