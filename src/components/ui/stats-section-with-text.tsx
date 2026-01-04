import { MoveUpRight } from "lucide-react"

function Stats() {
  const stats = [
    { label: "EU Average", value: "13%", flag: "🇪🇺", note: "Rising trend" },
    { label: "Denmark", value: "7.4%", flag: "🇩🇰", note: "High potential" },
    { label: "Norway", value: "3.9%", flag: "🇳🇴", note: "Untapped market" },
    { label: "Sweden", value: "8.5%", flag: "🇸🇪", note: "Growing" },
  ]

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-left text-2xl font-semibold tracking-tight md:text-3xl lg:text-5xl">
                Freedom is closer than you think.
              </h2>
              <p className="text-left text-base leading-relaxed text-slate-600 md:text-lg">
                Today only a small percentage of Nordic clinicians work independently. Why? Because administration has
                been a roadblock. We built Selma+ to remove that barrier, so you can focus on what you do best.
              </p>
              <a
                href="/signup"
                className="mt-4 inline-flex items-center text-sm font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Be part of the future →
              </a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-2 lg:grid-cols-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="absolute -right-8 -bottom-8 h-24 w-40 rounded-full bg-gradient-to-tr from-emerald-200/40 via-transparent to-blue-200/20" />
                  <svg
                    viewBox="0 0 120 60"
                    className="absolute -right-6 -bottom-4 h-20 w-32 text-emerald-400/60"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 54 C 20 40, 40 20, 68 28 S 112 22, 118 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="relative">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
                      <span>{stat.label}</span>
                      <span className="text-2xl">{stat.flag}</span>
                    </div>
                    <div className="mt-4 text-4xl font-bold text-slate-900">{stat.value}</div>
                    <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
                      <MoveUpRight className="h-4 w-4" />
                      {stat.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Stats }
