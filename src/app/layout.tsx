import type { Metadata } from "next";
import "./globals.css";
import "./styles/tokens.css";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { Toaster } from "sonner";

import AnalyticsListener from "@/components/analytics/AnalyticsListener";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import Providers from "@/components/providers";
import ScrollProgress from "@/components/site/ScrollProgress";
import StructuredData from "@/components/seo/StructuredData";
import { TrackingConsentProvider } from "@/components/tracking/TrackingConsentProvider";
import TrackingScriptLoader from "@/components/tracking/TrackingScriptLoader";
import {
  BRAND,
  CORE_KEYWORDS,
  DEFAULT_ICON,
  DEFAULT_IMAGE,
  DEFAULT_LOGO,
  DEFAULT_SERVICE_AREAS,
  SITE_DOMAIN,
} from "@/lib/seo/config";
import { cn } from "@/lib/utils";
import type { ThemeName } from "@/components/theme/ThemeProvider";
import { authOptions, safeGetServerSession } from "@/lib/auth";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_DOMAIN),
  title: `${BRAND.name} — Clean yards. Smarter pet wellness insights.`,
  description:
    "InsightScoop is Minnesota's most advanced dog poop scooping service with AI-powered stool analysis, eco-friendly disposal, and proactive pet wellness alerts.",
  icons: {
    icon: DEFAULT_ICON,
    shortcut: DEFAULT_ICON,
    apple: DEFAULT_ICON,
  },
  keywords: [
    ...CORE_KEYWORDS,
    "InsightScoop Twin Cities",
    "AI dog waste removal",
    "pet stool monitoring",
    "dog poop pickup services Minnesota",
    "Eagan dog waste removal",
    "St. Cloud pooper scooper",
  ],
  authors: [{ name: BRAND.name }],
  openGraph: {
    title: `${BRAND.name} — Clean yards. Smarter pet wellness insights.`,
    description:
      "Trusted field techs, AI stool monitoring, and actionable pet wellness reporting for dog parents across Minneapolis, St. Paul, and Central Minnesota.",
    type: "website",
    url: SITE_DOMAIN,
    locale: "en_US",
    siteName: BRAND.name,
    images: [
      {
        url: "/api/og?type=homepage",
        width: 1200,
        height: 630,
        alt: `${BRAND.name} pet waste removal and AI stool insights`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — Clean yards. Smarter pet wellness insights.`,
    description:
      "Weekly poop pickup with AI stool health alerts, eco-friendly disposal, and 3C wellness dashboards for Twin Cities dog parents.",
    creator: "@insightscoop",
    images: ["/api/og?type=homepage"],
  },
  alternates: {
    canonical: SITE_DOMAIN,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    preload: DEFAULT_IMAGE,
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: BRAND.name,
  image: `${SITE_DOMAIN}/api/og?type=homepage`,
  url: SITE_DOMAIN,
  telephone: BRAND.supportPhone,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Minneapolis",
    addressRegion: "MN",
    postalCode: "55417",
    addressCountry: "US",
  },
  areaServed: DEFAULT_SERVICE_AREAS,
  description:
    "InsightScoop blends professional dog poop pickup with AI stool analytics, pet wellness dashboards, and eco-conscious disposal.",
  openingHours: "Mo-Fr 08:00-18:00",
  offers: [
    {
      "@type": "Offer",
      name: "Weekly AI stool-monitored poop pickup",
      priceRange: "$20-$28",
      description:
        "Weekly InsightScoop service with 3C stool analysis, wellness scoring, and text/email recaps.",
    },
    {
      "@type": "Offer",
      name: "One-time deep clean + baseline insights",
      priceRange: "$89-$129",
      description: "Full-yard reset plus an inaugural InsightScoop health scan and recommendations.",
    },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get("host")?.toLowerCase() ?? "";
  const isYarduraHost = host.includes("yardura.com");
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("yardura-theme")?.value;
  const initialTheme: ThemeName = themeCookie === "dark" ? "dark" : "light";
  const session = await safeGetServerSession(authOptions);

  return (
    <html
      lang="en"
      className={cn(initialTheme === "dark" ? "dark" : "", "h-full")}
      data-theme={initialTheme}
    >
      <head>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* Preload LCP image for better performance */}
        <link
          rel="preload"
          href={DEFAULT_LOGO}
          as="image"
          type="image/png"
          fetchPriority="high"
        />

      </head>
      <body
        className={cn(
          "min-h-screen font-sans antialiased transition-colors",
          "bg-slate-50 text-graphite",
          "dark:bg-slate-950 dark:text-slate-50",
        )}
        suppressHydrationWarning
      >
        {/* Skip to main content link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-accent text-white px-4 py-2 rounded-md z-50 focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Skip to main content
        </a>

        <Providers initialTheme={initialTheme} session={session ?? undefined}>
          <TrackingConsentProvider>
            <Suspense fallback={null}>
              <TrackingScriptLoader />
              <AnalyticsListener />
            </Suspense>
            {!isYarduraHost && <HeaderWrapper />}
            {!isYarduraHost && <ScrollProgress />}
            {children}
            <Toaster richColors position="top-right" />
            {/* Removed left-side quick nav and sticky CTA */}
            <StructuredData data={{ brandHost: host }} />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
          </TrackingConsentProvider>
        </Providers>
      </body>
    </html>
  );
}
