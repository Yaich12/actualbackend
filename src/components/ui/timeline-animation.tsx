"use client";

import { cn } from "lib/utils";
import { motion, useInView, type Variants } from "framer-motion";
import type { ElementType, ReactNode, RefObject } from "react";
import { useMemo, useRef } from "react";

type TimelineContentProps = {
  as?: ElementType;
  animationNum?: number;
  timelineRef?: RefObject<HTMLElement>;
  customVariants?: Variants;
  className?: string;
  children: ReactNode;
};

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: 0.4,
    },
  }),
};

export const TimelineContent = ({
  as = "div",
  animationNum = 0,
  timelineRef,
  customVariants = defaultVariants,
  className,
  children,
}: TimelineContentProps) => {
  const localRef = useRef<HTMLElement | null>(null);
  const refToUse = timelineRef ?? localRef;
  const isInView = useInView(refToUse, { once: true, margin: "-10% 0px" });
  const MotionComponent = useMemo(() => motion(as as any), [as]);

  return (
    <MotionComponent
      ref={timelineRef ? undefined : (localRef as any)}
      className={cn(className)}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      custom={animationNum}
      variants={customVariants}
    >
      {children}
    </MotionComponent>
  );
};
