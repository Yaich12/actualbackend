'use client'

import { useRef, useState, type ReactNode } from 'react'

import { motion, useScroll, useTransform } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'

import { Stats } from 'components/ui/stats-section-with-text'

const IMG_PADDING = 12

type TextParallaxContentProps = {
  imgUrl: string
  subheading: string
  heading: string
  children?: ReactNode
}

type StickyImageProps = {
  imgUrl: string
}

type OverlayCopyProps = {
  subheading: string
  heading: string
}

export const TextParallaxContentExample = () => {
  const [aiModalOpen, setAiModalOpen] = useState(false)

  return (
    <div className="bg-white">
      <TextParallaxContent
        imgUrl="/hero-2/pexels-yankrukov-5793904.jpg"
        subheading="Collaborate"
        heading="Built for all of us."
      />

      <div className="bg-white">
        <Stats />
      </div>

      <TextParallaxContent
        imgUrl="/hero-2/pexels-shkrabaanthony-5217852.jpg"
        subheading="Quality"
        heading="Never compromise."
      />

      <section className="bg-white px-4 pb-20 pt-12 md:px-12">
        <article className="md:col-span-3 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-stone-400">
                Driften
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-stone-900">Klinisk superkraft</h3>
              <p className="mt-4 text-sm leading-relaxed text-stone-600">
                Journalisering, fremskridtsmåling og klinisk sparring. Det hele sker automatisk,
                mens du lytter.
              </p>
            </div>

            <div className="relative w-full rounded-2xl border border-slate-100 bg-gradient-to-br from-rose-50 via-white to-slate-50 p-6">
              <div className="rounded-2xl border border-white/60 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                  AI Co-Pilot · Powered by CORTI
                </div>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl bg-rose-50 p-4 text-sm text-stone-700">
                    Journalnotat for Søren oprettet. Vil du se handleplanen?
                  </div>
                  <button className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-inner">
                    Vis handleplan
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                className="absolute bottom-6 right-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/40 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                +
              </button>
            </div>
          </div>
        </article>
      </section>

      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm">
          <div className="relative w-full max-w-6xl rounded-[28px] bg-white p-8 shadow-2xl shadow-black/20 ring-1 ring-slate-200 md:p-12">
            <button
              type="button"
              onClick={() => setAiModalOpen(false)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              aria-label="Luk"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-6 md:space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
                  Efficiency · Powered by Corti
                </p>
                <h2 className="text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
                  Automatiser journalnoter med AI
                </h2>
                <p className="max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
                  Selma+ lytter med via CORTI og omdanner samtaler til strukturerede kliniske noter,
                  handleplaner og faktureringsklare koder – helt automatisk.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-4 rounded-[28px] bg-gradient-to-br from-rose-50/80 via-white to-indigo-50/60 p-6 shadow-sm ring-1 ring-white">
                  <div className="h-32 rounded-2xl bg-white/70 shadow-inner shadow-rose-100" />
                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <p className="text-sm font-semibold text-rose-500">AI Copilot</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      Vi har resuméet klar for din konsultation. Klik for at godkende eller redigere.
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Powered by CORTI</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-[28px] bg-slate-50 p-6 shadow-inner ring-1 ring-white/60">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Ambient speech</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      Brug din iPhone eller Mac til at optage sessionen. Vi transskribere, strukturerer
                      og lægger det direkte ind som journalnoter og handleplaner.
                    </p>
                  </div>
                  <div className="pt-2">
                    <p className="text-base font-semibold text-slate-900">Epic-grade kontrol</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      Redigér noter i et Apple-lignende interface og send dem til EPJ på få sekunder. Du
                      bevarer fuld kontrol – AI&apos;en gør det tunge arbejde.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TextParallaxContent = ({
  imgUrl,
  subheading,
  heading,
  children,
}: TextParallaxContentProps) => {
  return (
    <div
      style={{
        paddingLeft: IMG_PADDING,
        paddingRight: IMG_PADDING,
      }}
    >
      <div className="relative h-[150vh]">
        <StickyImage imgUrl={imgUrl} />
        <OverlayCopy heading={heading} subheading={subheading} />
      </div>
      {children}
    </div>
  )
}

const StickyImage = ({ imgUrl }: StickyImageProps) => {
  const targetRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['end end', 'end start'],
  })

  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.85])
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])

  return (
    <motion.div
      style={{
        backgroundImage: `url(${imgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: `calc(100vh - ${IMG_PADDING * 2}px)`,
        top: IMG_PADDING,
        scale,
      }}
      ref={targetRef}
      className="sticky z-0 overflow-hidden rounded-3xl"
    >
      <motion.div
        className="absolute inset-0 bg-neutral-950/70"
        style={{
          opacity,
        }}
      />
    </motion.div>
  )
}

const OverlayCopy = ({ subheading, heading }: OverlayCopyProps) => {
  const targetRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start end', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], [250, -250])
  const opacity = useTransform(scrollYProgress, [0.25, 0.5, 0.75], [0, 1, 0])

  return (
    <motion.div
      style={{
        y,
        opacity,
      }}
      ref={targetRef}
      className="absolute left-0 top-0 flex h-screen w-full flex-col items-center justify-center text-white"
    >
      <p className="mb-2 text-center text-xl md:mb-4 md:text-3xl">{subheading}</p>
      <p className="text-center text-4xl font-bold md:text-7xl">{heading}</p>
    </motion.div>
  )
}

