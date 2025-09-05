'use client';

import { motion, useScroll, useSpring } from 'framer-motion';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const { prefersReducedMotion } = useReducedMotionSafe();

  // Smooth spring animation for the progress bar
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Disable animation if user prefers reduced motion
  if (prefersReducedMotion) {
    return (
      <div className="fixed top-0 left-0 right-0 z-sticky h-0.5 bg-accent/20">
        <div
          className="h-full bg-accent transition-all duration-300 ease-linear"
          style={{
            width: `${scrollYProgress.get() * 100}%`,
          }}
        />
      </div>
    );
  }

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-sticky h-0.5 bg-accent/20 origin-left"
      style={{
        scaleX,
      }}
    >
      {/* Animated gradient overlay for premium feel */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-accent via-accent to-accent/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      />
    </motion.div>
  );
}
