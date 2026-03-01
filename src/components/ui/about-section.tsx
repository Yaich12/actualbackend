"use client";

import { TimelineContent } from "components/ui/timeline-animation";
import { VerticalCutReveal } from "components/ui/vertical-cut-reveal";
import { ChevronDown, Linkedin } from "lucide-react";
import { useRef } from "react";
import { useLanguage } from "../../unAuth/language/LanguageProvider";

export default function AboutSection3() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { t, language } = useLanguage();
  const aboutImageSrc = "/hero-2/pexels-yankrukov-5793904.jpg";
  const isEnglish = language === "en";
  const rightHeadlineLines = t("landing.aboutSection.rightHeadline")
    .split("\n")
    .filter(Boolean);

  const getNextSectionElement = (
    currentElement: HTMLElement | null
  ): HTMLElement | null => {
    let node: HTMLElement | null = currentElement;
    while (node) {
      const sibling = node.nextElementSibling;
      if (sibling instanceof HTMLElement) return sibling;
      node = node.parentElement;
    }
    return null;
  };

  const handleScrollToNextSection = () => {
    const currentSection = heroRef.current;
    if (!currentSection || typeof window === "undefined") return;

    const nextSection = getNextSectionElement(currentSection);
    if (!nextSection) return;

    const targetTop =
      window.scrollY + nextSection.getBoundingClientRect().top - 24;
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const scaleVariants = {
    visible: (i: number) => ({
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      opacity: 0,
    },
  };

  return (
    <section
      className="bg-[radial-gradient(circle_at_20%_20%,#f8fafc_0,#eef2ff_35%,#f8fafc_70%)] px-4 py-8"
      ref={heroRef}
    >
      <div className="mx-auto max-w-6xl">
        <div className="relative">
          <div className="absolute -top-3 z-10 mb-8 flex w-[85%] items-center justify-end sm:-top-2 md:top-0 lg:top-4">
            <div className="flex items-center gap-3">
              <TimelineContent
                as="span"
                animationNum={0}
                timelineRef={heroRef}
                customVariants={revealVariants}
                className="text-xs font-medium text-gray-600 sm:text-sm"
              >
                {t("landing.aboutSection.statsLine")}
              </TimelineContent>
              <TimelineContent
                as="a"
                animationNum={1}
                timelineRef={heroRef}
                customVariants={revealVariants}
                href="https://www.linkedin.com/company/selmaplus/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-gray-100 sm:h-6 sm:w-6 md:h-8 md:w-8"
              >
                <Linkedin className="h-4 w-4" />
              </TimelineContent>
            </div>
          </div>

          <TimelineContent
            as="figure"
            animationNum={4}
            timelineRef={heroRef}
            customVariants={scaleVariants}
            className="relative group"
          >
            <svg
              className="w-full"
              width="100%"
              height="100%"
              viewBox="0 0 100 40"
            >
              <defs>
                <clipPath id="clip-inverted" clipPathUnits="objectBoundingBox">
                  <path
                    d="M0.0998072 1H0.422076H0.749756C0.767072 1 0.774207 0.961783 0.77561 0.942675V0.807325C0.777053 0.743631 0.791844 0.731953 0.799059 0.734076H0.969813C0.996268 0.730255 1.00088 0.693206 0.999875 0.675159V0.0700637C0.999875 0.0254777 0.985045 0.00477707 0.977629 0H0.902473C0.854975 0 0.890448 0.138535 0.850165 0.138535H0.0204424C0.00408849 0.142357 0 0.180467 0 0.199045V0.410828C0 0.449045 0.0136283 0.46603 0.0204424 0.469745H0.0523086C0.0696245 0.471019 0.0735527 0.497877 0.0733523 0.511146V0.915605C0.0723903 0.983121 0.090588 1 0.0998072 1Z"
                    fill="#D9D9D9"
                  />
                </clipPath>
              </defs>
              <image
                clipPath="url(#clip-inverted)"
                preserveAspectRatio="xMidYMid slice"
                width="100%"
                height="100%"
                href={aboutImageSrc}
              />
            </svg>
          </TimelineContent>

          <div className="flex flex-wrap items-center justify-between py-3 text-sm lg:justify-start">
            <div
              className={`mt-10 ml-auto w-full sm:mt-12 lg:absolute lg:right-0 lg:bottom-4 ${
                isEnglish
                  ? "max-w-[22rem] lg:max-w-[23rem]"
                  : "max-w-[21rem] lg:max-w-[24rem]"
              }`}
            >
              <TimelineContent
                as="div"
                animationNum={6}
                timelineRef={heroRef}
                customVariants={revealVariants}
                className={`mb-1 text-left font-semibold tracking-tight text-gray-700 lg:text-right ${
                  isEnglish
                    ? "leading-[1.18] text-[1.9rem] sm:text-[2.1rem] lg:text-[3.25rem]"
                    : "leading-[1.05] text-2xl sm:text-[2.15rem] lg:text-5xl"
                }`}
              >
                {rightHeadlineLines.map((line, index) => (
                  <span
                    key={`${line}-${index}`}
                    className={`block ${index === 0 ? "" : "mt-1"}`}
                  >
                    {line}
                  </span>
                ))}
              </TimelineContent>
              <TimelineContent
                as="div"
                animationNum={7}
                timelineRef={heroRef}
                customVariants={revealVariants}
                className="text-left text-xs leading-tight text-gray-600 sm:text-sm lg:text-right lg:text-lg"
              >
                {t("landing.aboutSection.rightSubline")}
              </TimelineContent>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <h1 className="mb-8 text-2xl font-semibold !leading-[110%] text-gray-900 sm:text-4xl md:text-5xl">
              <VerticalCutReveal
                splitBy="words"
                staggerDuration={0.1}
                staggerFrom="first"
                reverse
                transition={{
                  type: "spring",
                  stiffness: 250,
                  damping: 30,
                  delay: 3,
                }}
              >
                {t("landing.aboutSection.title")}
              </VerticalCutReveal>
            </h1>

            <TimelineContent
              as="div"
              animationNum={9}
              timelineRef={heroRef}
              customVariants={revealVariants}
              className="grid gap-8 text-gray-600 md:grid-cols-2"
            >
              <TimelineContent
                as="div"
                animationNum={10}
                timelineRef={heroRef}
                customVariants={revealVariants}
                className="text-xs sm:text-base"
              >
                <p className="text-justify leading-relaxed">
                  {t("landing.aboutSection.paragraphOne")}
                </p>
              </TimelineContent>
              <TimelineContent
                as="div"
                animationNum={11}
                timelineRef={heroRef}
                customVariants={revealVariants}
                className="text-xs sm:text-base"
              >
                <p className="text-justify leading-relaxed">
                  {t("landing.aboutSection.paragraphTwo")}
                </p>
              </TimelineContent>
            </TimelineContent>
          </div>

          <div className="md:col-span-1">
            <div className="flex h-full flex-col text-right">
              <TimelineContent
                as="div"
                animationNum={12}
                timelineRef={heroRef}
                customVariants={revealVariants}
                className="mb-2 text-2xl font-bold text-gray-700"
              >
                {t("landing.aboutSection.foundersName")}
              </TimelineContent>
              <TimelineContent
                as="div"
                animationNum={13}
                timelineRef={heroRef}
                customVariants={revealVariants}
                className="mb-8 text-sm text-gray-600"
              >
                {t("landing.aboutSection.foundersRole")}
              </TimelineContent>

              <TimelineContent
                as="button"
                animationNum={14}
                timelineRef={heroRef}
                customVariants={revealVariants}
                type="button"
                onClick={handleScrollToNextSection}
                className="mt-auto ml-auto inline-flex w-auto items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-base font-semibold text-white shadow-lg shadow-neutral-900 transition-all duration-300 ease-in-out hover:gap-3 hover:bg-neutral-950"
              >
                {t("landing.aboutSection.ctaButton")} <ChevronDown className="h-4 w-4" />
              </TimelineContent>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
