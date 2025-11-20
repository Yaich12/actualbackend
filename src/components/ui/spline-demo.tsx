'use client'

import { SplineScene } from 'components/ui/splite'
import { Card } from 'components/ui/card'
import { Spotlight } from 'components/ui/spotlight'

export function SplineSceneBasic() {
  return (
    <Card className="relative flex h-[500px] w-full items-center justify-center overflow-hidden bg-black/[0.96]">
      <Spotlight className="-top-40 left-0 md:left-32" fill="white" />
      <SplineScene
        scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
        className="h-full w-full"
      />
    </Card>
  )
}

