import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

interface UseInViewCountUpOptions {
  end: number;
  duration?: number;
  start?: number;
  decimals?: number;
}

export function useInViewCountUp({
  end,
  duration = 2000,
  start = 0,
  decimals = 0,
}: UseInViewCountUpOptions) {
  const [count, setCount] = useState(start);
  const { ref, inView } = useInView({
    threshold: 0.3,
    triggerOnce: true,
  });

  useEffect(() => {
    if (!inView) return;

    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      const currentCount = start + (end - start) * progress;
      setCount(decimals === 0 ? Math.floor(currentCount) : Number(currentCount.toFixed(decimals)));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [inView, start, end, duration, decimals]);

  return { ref, count };
}

