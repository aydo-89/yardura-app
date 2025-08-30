"use client";

import { useState, useEffect } from 'react';
import { useInView } from 'framer-motion';

interface UseInViewCountUpOptions {
  end: number;
  duration?: number;
  start?: number;
}

export function useInViewCountUp(
  ref: React.RefObject<HTMLElement>,
  { end, duration = 2000, start = 0 }: UseInViewCountUpOptions
) {
  const [count, setCount] = useState(start);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(start + (end - start) * easeOutQuart);

      setCount(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isInView, end, duration, start]);

  return count;
}
