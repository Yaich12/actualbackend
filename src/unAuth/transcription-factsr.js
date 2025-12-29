import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, Sparkles } from 'lucide-react';
import FeaturesWorkflow from './components/FeaturesWorkflow';

function TranscriptionFactsrPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-slate-950 to-[#111c32]" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-8 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
              AI Intelligence Hub
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Transcription and FactsR
            </h1>
            <p className="mt-4 text-base text-slate-200">
              Live transkribering og FactsR samlet ét sted, så du kan fokusere på patienten og
              få struktureret dokumentation uden ekstra klik.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                Prøv systemet gratis
              </Link>
              <a
                href="#factsr-section"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white"
              >
                <Sparkles className="h-4 w-4" />
                Se FactsR demo
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
                <Mic className="h-4 w-4 text-blue-200" />
                Live transkribering
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
                <Sparkles className="h-4 w-4 text-blue-200" />
                FactsR strukturering
              </span>
            </div>
          </div>
        </div>
      </section>

      <FeaturesWorkflow sectionId="factsr-section" />

    </div>
  );
}

export default TranscriptionFactsrPage;
