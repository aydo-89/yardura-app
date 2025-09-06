'use client';

import { useReducedMotion } from 'framer-motion';
import { reducedMotionReveal, reducedMotionHover } from '@/lib/motion/presets';

// ==========================================
// REDUCED MOTION HOOK
// ==========================================

/**
 * Enhanced reduced motion hook with convenience methods
 * Respects user's prefers-reduced-motion setting
 */
export function useReducedMotionSafe() {
  const shouldReduceMotion = useReducedMotion();

  return {
    // Raw boolean value
    prefersReducedMotion: shouldReduceMotion,

    // Convenience methods for conditional variants
    getRevealVariant: () => (shouldReduceMotion ? reducedMotionReveal : undefined),

    getHoverVariant: () => (shouldReduceMotion ? reducedMotionHover : undefined),

    // Helper to conditionally return animation props
    motionProps: (normalProps: any, reducedProps: any = {}) => {
      if (shouldReduceMotion) {
        return {
          ...normalProps,
          ...reducedProps,
          transition: {
            duration: 0.3,
            ease: 'linear',
          },
        };
      }
      return normalProps;
    },

    // Disable continuous animations when reduced motion is preferred
    shouldDisableContinuous: shouldReduceMotion,

    // Safe transition for static elements
    safeTransition: shouldReduceMotion ? { duration: 0.3, ease: 'linear' } : undefined,
  };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Safely apply animation variants based on reduced motion preference
 */
export function getSafeVariants(
  normalVariants: any,
  reducedVariants: any,
  prefersReducedMotion: boolean
) {
  return prefersReducedMotion ? reducedVariants : normalVariants;
}

/**
 * Create a motion-safe transition object
 */
export function createSafeTransition(normalTransition: any, prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return {
      duration: 0.3,
      ease: 'linear',
    };
  }
  return normalTransition;
}

/**
 * Hook for conditional animation values
 */
export function useConditionalAnimation<T>(normalValue: T, reducedValue: T): T {
  const { prefersReducedMotion } = useReducedMotionSafe();
  return prefersReducedMotion ? reducedValue : normalValue;
}

