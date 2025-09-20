import { useEffect, useState } from "react";

export function useReducedMotionSafe() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const motionProps = (motionConfig: any, reducedConfig: any) => {
    return prefersReducedMotion ? reducedConfig : motionConfig;
  };

  return {
    prefersReducedMotion,
    motionProps,
  };
}
