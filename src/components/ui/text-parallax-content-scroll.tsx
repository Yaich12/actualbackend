'use client'

import { useRef, useState, type ReactNode } from 'react'

import { motion, useScroll, useTransform } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'

import Preview from '../../unAuth/components/preview'
import { getPublicAssetUrl } from '../../utils/publicAssets'
import { useLanguage } from '../../unAuth/language/LanguageProvider'

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
  const { t } = useLanguage()

  return (
    <div className="bg-white">
      <TextParallaxContent
        imgUrl={getPublicAssetUrl('hero-2/pexels-yankrukov-5793904.jpg')}
        subheading={t('landing.parallax.sections.collaborate.subheading')}
        heading={t('landing.parallax.sections.collaborate.heading')}
      />

      <div className="landing-section landing-section-full" id="preview">
        <Preview />
      </div>

      <TextParallaxContent
        imgUrl={getPublicAssetUrl('hero-2/pexels-shkrabaanthony-5217852.jpg')}
        subheading={t('landing.parallax.sections.quality.subheading')}
        heading={t('landing.parallax.sections.quality.heading')}
      />
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
