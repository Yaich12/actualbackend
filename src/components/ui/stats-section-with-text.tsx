import { useEffect, useState } from "react"
import { useLanguage } from "../../unAuth/language/LanguageProvider"

const SLIDE_DURATION = 10000

type Slide = {
  title: string
  text: string
  image: string
  alt: string
}

function Stats() {
  const { getArray } = useLanguage()
  const slides = getArray("landing.statsSection.slides", []) as Slide[]
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!slides?.length) return
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length)
    }, SLIDE_DURATION)

    return () => clearInterval(interval)
  }, [slides?.length])

  const activeSlide = slides[activeIndex] || slides[0]

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="relative order-2 lg:order-1 min-h-[340px] sm:min-h-[280px] lg:min-h-[320px]">
            {activeSlide ? (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-left text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl lg:text-4xl">
                  {activeSlide.title}
                </h2>
                <p className="text-left text-base leading-relaxed text-slate-600 md:text-lg">
                  {activeSlide.text}
                </p>
              </div>
            ) : null}
          </div>
          <div className="relative order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-3xl shadow-[0_28px_60px_rgba(15,23,42,0.12)]">
              <div className="relative h-[320px] sm:h-[420px] lg:h-[520px]">
                {slides.map((slide, index) => {
                  const isActive = index === activeIndex
                  return (
                    <div
                      key={`${slide.image}-${index}`}
                      className={`absolute inset-0 transition-opacity duration-700 ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <div
                        className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
                        style={{ backgroundImage: `url(${slide.image})` }}
                        aria-hidden="true"
                      />
                      <img
                        src={slide.image}
                        alt={slide.alt}
                        className="relative h-full w-full object-contain"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              {slides.map((_, index) => (
                <span
                  key={`slide-dot-${index}`}
                  className={`h-1.5 rounded-full transition-all duration-700 ${
                    index === activeIndex ? "w-10 bg-slate-900/80" : "w-4 bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Stats }
