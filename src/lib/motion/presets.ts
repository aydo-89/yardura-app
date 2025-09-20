// Motion System Presets - Premium, High-Performance Animation Library
// Designed for 60fps performance, accessibility, and modern UX

// ==========================================
// EASE FUNCTIONS
// ==========================================

export const ease = {
  // Material Design emphasized easing - smooth entry, bouncy exit
  emphasized: [0.2, 0, 0, 1],
  // Standard easing for most transitions
  standard: [0.4, 0, 0.2, 1],
  // Decelerate for entering elements
  decelerate: [0, 0, 0.2, 1],
  // Accelerate for exiting elements
  accelerate: [0.4, 0, 1, 1],
  // Linear for predictable, mechanical motion
  linear: "linear",
  // Custom bounce for playful interactions
  bounce: [0.68, -0.55, 0.265, 1.55],
} as const;

// ==========================================
// SPRING CONFIGURATIONS
// ==========================================

export const spring = {
  // Soft, gentle spring for hover states and subtle interactions
  soft: {
    type: "spring" as const,
    stiffness: 220,
    damping: 28,
    mass: 1,
  },
  // Snappy spring for quick, responsive interactions
  snappy: {
    type: "spring" as const,
    stiffness: 320,
    damping: 26,
    mass: 0.8,
  },
  // Bouncy spring for playful, attention-grabbing effects
  bouncy: {
    type: "spring" as const,
    stiffness: 180,
    damping: 20,
    mass: 1.2,
  },
  // Slow, deliberate spring for important transitions
  deliberate: {
    type: "spring" as const,
    stiffness: 120,
    damping: 25,
    mass: 1.5,
  },
} as const;

// ==========================================
// DURATION PRESETS
// ==========================================

export const dur = {
  // Instant feedback (button press, focus states)
  instant: 0.08,
  // Fast transitions (hover states, micro-interactions)
  fast: 0.18,
  // Base duration for most UI transitions
  base: 0.26,
  // Slow transitions for important state changes
  slow: 0.38,
  // Very slow for dramatic reveals
  verySlow: 0.6,
} as const;

// ==========================================
// MOTION VARIANTS
// ==========================================

// Basic reveal animation for elements entering viewport
export const reveal = {
  initial: {
    y: 8,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: dur.base,
      ease: ease.emphasized,
    },
  },
  exit: {
    y: -8,
    opacity: 0,
    transition: {
      duration: dur.fast,
      ease: ease.standard,
    },
  },
};

// Slide up from below
export const slideUp = {
  initial: {
    y: 20,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: dur.base,
      ease: ease.emphasized,
    },
  },
};

// Scale in from smaller size
export const scaleIn = {
  initial: {
    scale: 0.98,
    opacity: 0,
  },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: dur.base,
      ease: ease.emphasized,
    },
  },
};

// Fade in only (no transform)
export const fadeIn = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: dur.base,
      ease: ease.standard,
    },
  },
};

// Lift on hover - premium card interaction
export const liftHover = {
  hover: {
    y: -2,
    scale: 1.01,
    transition: spring.soft,
  },
  tap: {
    scale: 0.995,
    transition: {
      duration: dur.instant,
      ease: ease.standard,
    },
  },
};

// Button press state
export const buttonPress = {
  tap: {
    scale: 0.99,
    transition: {
      duration: dur.instant,
      ease: ease.standard,
    },
  },
};

// ==========================================
// STAGGER UTILITIES
// ==========================================

// Create staggered variants for parent containers
export const createStaggerContainer = (staggerDelay: number = 0.04) => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: staggerDelay,
    },
  },
});

// Create staggered variants for child elements
export const createStaggerItem = (delay: number = 0) => ({
  initial: {
    y: 8,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: dur.base,
      ease: ease.emphasized,
      delay,
    },
  },
});

// ==========================================
// LAYOUT TRANSITIONS
// ==========================================

// Smooth layout changes (like height morphing)
export const layoutTransition = {
  layout: {
    duration: dur.base,
    ease: ease.emphasized,
  },
};

// ==========================================
// ACCESSIBILITY VARIANTS
// ==========================================

// Reduced motion alternatives
export const reducedMotionReveal = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: dur.slow,
      ease: ease.linear,
    },
  },
};

export const reducedMotionHover = {
  hover: {
    opacity: 0.9,
    transition: {
      duration: dur.fast,
      ease: ease.linear,
    },
  },
};

// ==========================================
// ADVANCED ANIMATIONS
// ==========================================

// Split headline reveal for hero sections
export const splitHeadline = {
  container: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
  line: {
    initial: {
      y: 20,
      opacity: 0,
      clipPath: "inset(0 100% 0 0)",
    },
    animate: {
      y: 0,
      opacity: 1,
      clipPath: "inset(0 0% 0 0)",
      transition: {
        duration: dur.slow,
        ease: ease.emphasized,
      },
    },
  },
};

// Shimmer effect for premium buttons
export const shimmer = {
  initial: {
    backgroundPosition: "-200% 0",
  },
  animate: {
    backgroundPosition: "200% 0",
    transition: {
      duration: 1.2,
      ease: ease.linear,
      repeat: Infinity,
      repeatType: "loop" as const,
    },
  },
};

// Magnetic hover effect
export const magneticHover = {
  hover: {
    transition: {
      duration: dur.fast,
      ease: ease.standard,
    },
  },
};

// 3D card tilt effect
export const cardTilt = {
  hover: {
    rotateX: 5,
    rotateY: 5,
    transition: spring.soft,
  },
};

// ==========================================
// PERFORMANCE OPTIMIZATIONS
// ==========================================

// Will-change hints for common animations
export const willChange = {
  transform: "will-change: transform;",
  opacity: "will-change: opacity;",
  transformOpacity: "will-change: transform, opacity;",
} as const;

// CSS classes for performance optimization
export const performanceClasses = {
  // Use transform and opacity for 60fps animations
  animateTransform: "will-change-transform",
  animateOpacity: "will-change-opacity",
  // Hardware acceleration for complex animations
  hardwareAccelerate: "transform: translateZ(0);",
  // Backface visibility for 3D transforms
  backfaceVisible: "backface-visibility: hidden;",
} as const;
