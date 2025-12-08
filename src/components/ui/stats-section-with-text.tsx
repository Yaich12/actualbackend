import { MoveDownLeft, MoveUpRight } from "lucide-react"

function Stats() {
  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-left text-xl font-normal tracking-tighter md:text-3xl lg:text-5xl">
                This is the start of something new
              </h2>
              <p className="text-left text-lg leading-relaxed tracking-tight text-muted-foreground">
                Self-employment is rising across Europe – but for many health
                professionals, the path still feels unclear.
              </p>
              <p className="text-left text-lg leading-relaxed tracking-tight text-muted-foreground">
                Our platform turns complex data and regulations into simple,
                practical steps toward your own practice.
              </p>
              <p className="text-left text-lg leading-relaxed tracking-tight text-muted-foreground">
                See how many in each country already work for themselves – and be
                part of increasing that percentage in your own.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-2 lg:grid-cols-2">
              {/* EU – 13% */}
              <div className="flex flex-col justify-between gap-0 rounded-md border p-6">
                <MoveUpRight className="mb-10 h-4 w-4 text-primary" />
                <h2 className="flex flex-row items-center justify-between text-left text-4xl font-normal tracking-tighter">
                  <span>13 %</span>
                  <span className="text-3xl">🇪🇺</span>
                </h2>
              </div>

              {/* Danmark – 7.4% */}
              <div className="flex flex-col justify-between gap-0 rounded-md border p-6">
                <MoveDownLeft className="mb-10 h-4 w-4 text-destructive" />
                <h2 className="flex flex-row items-center justify-between text-left text-4xl font-normal tracking-tighter">
                  <span>7.4 %</span>
                  <span className="text-3xl">🇩🇰</span>
                </h2>
              </div>

              {/* Norge – 3.9% */}
              <div className="flex flex-col justify-between gap-0 rounded-md border p-6">
                <MoveDownLeft className="mb-10 h-4 w-4 text-destructive" />
                <h2 className="flex flex-row items-center justify-between text-left text-4xl font-normal tracking-tighter">
                  <span>3.9 %</span>
                  <span className="text-3xl">🇳🇴</span>
                </h2>
              </div>

              {/* Sverige – 8.5% */}
              <div className="flex flex-col justify-between gap-0 rounded-md border p-6">
                <MoveDownLeft className="mb-10 h-4 w-4 text-destructive" />
                <h2 className="flex flex-row items-center justify-between text-left text-4xl font-normal tracking-tighter">
                  <span>8.5 %</span>
                  <span className="text-3xl">🇸🇪</span>
                </h2>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Stats }
