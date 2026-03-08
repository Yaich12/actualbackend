import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import LoomEmbed from "../../components/ui/LoomEmbed";
import { useLanguage } from "../language/LanguageProvider";
import "../../features/booking/Journal/indlæg/indlæg.css";

const transition = { duration: 0.45, ease: "easeOut" };
const workflowVideoByTab = {
  transcription: "823b210c7dca4000a0ee4e8896f9495c",
  facts: "875ff0de7fd948d5ac07859fabc35ed8",
};

function FeaturesWorkflow({ sectionId } = {}) {
  const { t, getArray } = useLanguage();
  const [activeId, setActiveId] = useState("facts");

  const featureTabs = getArray("features.workflow.tabs", []);
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
  const activeVideoId = workflowVideoByTab[activeId] || workflowVideoByTab.facts;

  return (
    <section id={sectionId} className="bg-white py-16 text-slate-900 scroll-mt-24">
      <div className="mx-auto w-full max-w-7xl px-6">
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

          <div className="mt-10 grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
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

            <div className="flex w-full items-start justify-center">
              <div className="w-full max-w-none">
                <LoomEmbed
                  key={activeId}
                  videoId={activeVideoId}
                  title={isFacts ? "Diktering video" : "Transkribering video"}
                  className="!h-auto !w-full !max-w-none !aspect-[16/9] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
                  frameClassName="!h-full !w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesWorkflow;
