"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function sendGaPageView(url: string) {
  if (typeof window === "undefined") return;
  const gaId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  if (!gaId) return;
  if (typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_path: url,
  });
}

export function AnalyticsListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    sendGaPageView(url);
  }, [pathname, searchParams]);

  return null;
}

export default AnalyticsListener;
