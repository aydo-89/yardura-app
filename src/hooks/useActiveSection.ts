"use client";

import { useEffect, useState } from "react";

export function useActiveSection(sectionIds: string[], rootMargin = "-40% 0px -50% 0px") {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const handler: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("id");
          if (id) setActiveId(id);
        }
      });
    };

    const options: IntersectionObserverInit = { root: null, rootMargin, threshold: [0, 0.25, 0.5, 1] };

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(handler, options);
      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [sectionIds, rootMargin]);

  return activeId;
}
