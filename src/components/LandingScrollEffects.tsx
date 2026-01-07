"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Applies subtle scroll-snap behaviour and section transitions on the landing page only.
 * Adds a class to the document body so we can scope global styles without impacting app shell pages.
 */
export default function LandingScrollEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    document.body.classList.add("landing-scroll-snap");
    return () => {
      document.body.classList.remove("landing-scroll-snap");
    };
  }, [pathname]);

  return null;
}
