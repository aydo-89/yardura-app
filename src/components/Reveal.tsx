"use client";

import { PropsWithChildren, ElementType } from "react";
import { motion } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { reveal, createStaggerItem, dur, ease } from "@/lib/motion/presets";

type RevealProps = PropsWithChildren<{
  // Animation control
  delay?: number;
  staggerDelay?: number;
  once?: boolean;

  // Animation type
  variant?: "reveal" | "slideUp" | "scaleIn" | "fadeIn";

  // Viewport settings
  margin?: string;

  // Component customization
  as?: ElementType;
  className?: string;

  // Additional motion props
  whileHover?: any;
  whileTap?: any;
}>;

export default function Reveal({
  children,
  delay = 0,
  staggerDelay,
  once = true,
  variant = "reveal",
  margin = "-50px",
  as: Component = motion.div,
  className,
  whileHover,
  whileTap,
  ...props
}: RevealProps) {
  const { prefersReducedMotion, motionProps } = useReducedMotionSafe();

  // Select animation variant
  const getVariant = () => {
    switch (variant) {
      case "slideUp":
        return {
          initial: { y: 20, opacity: 0 },
          animate: { y: 0, opacity: 1 },
        };
      case "scaleIn":
        return {
          initial: { scale: 0.98, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
        };
      case "fadeIn":
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
        };
      default:
        return reveal;
    }
  };

  const selectedVariant = getVariant();

  // Create stagger item if staggerDelay is provided
  const staggerVariant = staggerDelay
    ? createStaggerItem(delay)
    : selectedVariant;

  // Motion configuration
  const motionConfig = {
    initial: staggerVariant.initial,
    whileInView: staggerVariant.animate,
    viewport: {
      once,
      margin,
    },
    transition: {
      duration: dur.base,
      ease: ease.emphasized,
      delay: staggerDelay ? 0 : delay,
    },
    className,
    whileHover,
    whileTap,
    ...props,
  };

  // Apply reduced motion preferences
  const safeMotionConfig = motionProps(motionConfig, {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    transition: {
      duration: dur.slow,
      ease: "linear",
      delay: staggerDelay ? 0 : delay,
    },
  });

  return <Component {...safeMotionConfig}>{children}</Component>;
}
