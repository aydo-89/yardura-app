import type { Metadata } from "next";
import "./globals.css";
import "./styles/tokens.css";
import { Toaster } from "sonner";
import ScrollProgress from "@/components/site/ScrollProgress";
import StructuredData from "@/components/seo/StructuredData";
import Providers from "@/components/providers";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export const metadata: Metadata = {
  title: "Yeller by Yardura | Lawngevity through Lawngevity – Twin Cities",
  description:
    "Experience Lawngevity through Lawngevity. Premium dog waste removal service in Minneapolis, Richfield, Edina & Bloomington. Weekly eco-friendly poop scooping with health insights & smart composting for cleaner yards and healthier pets. The world's first pet waste monitoring service.",
  // Ensure favicon/logo uses Yeller mark
  icons: {
    icon: "/yardura-logo.png",
    shortcut: "/yardura-logo.png",
    apple: "/yardura-logo.png",
  },
  keywords: [
    "dog waste removal Minneapolis",
    "pooper scooper service Twin Cities",
    "dog poop cleanup Minneapolis",
    "weekly poop pickup Twin Cities",
    "dog waste collection service",
    "pet waste removal Minneapolis",
    "dog poop scooping service",

    "eco-friendly dog waste removal",
    "pet waste monitoring Minneapolis",
    "dog health monitoring Twin Cities",
    "AI pet waste analysis",
    "early health alerts dogs",
    "smart poop monitoring Minneapolis",
    "dog waste health insights",
    "pet wellness monitoring service",
    "dog health tracking",
    "pet waste analysis Minneapolis",
    "dog wellness monitoring",
  ],
  authors: [{ name: "Yeller" }],
  openGraph: {
    title:
      "Yeller by Yardura | Lawngevity through Lawngevity – Minneapolis, MN",
    description:
      "Experience Lawngevity through Lawngevity. Clean yard. Health insights. Less landfill. More wag. Serving Minneapolis, Richfield, Edina & Bloomington. The world's first pet waste monitoring service.",
    type: "website",
    url: "https://www.yardura.com",
    locale: "en_US",
    siteName: "Yeller",
    images: [
      {
        url: "/api/og?type=homepage",
        width: 1200,
        height: 630,
        alt: "Yeller by Yardura - Clean yard, smarter insights. Tech-enabled dog waste removal with health monitoring.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yeller by Yardura | Lawngevity through Lawngevity – Minneapolis",
    description:
      "Clean yard. Health insights. Less landfill. More wag. The world's first pet waste monitoring service.",
    creator: "@yardura",
    images: ["/api/og?type=homepage"],
  },
  alternates: {
    canonical: "https://www.yardura.com",
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
    // Preload LCP image for better performance
    preload: "/modern_yard.png",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Yeller",
  image: "https://www.yeller.com/og-image.jpg",
  url: "https://www.yeller.com",
  telephone: "+16125819812",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Minneapolis",
    addressRegion: "MN",
    postalCode: "55417",
    addressCountry: "US",
  },
  areaServed: ["South Minneapolis", "Richfield", "Edina", "Bloomington"],
  description:
    "Tech-enabled, eco-friendly dog waste removal with smart health insights.",
  openingHours: "Mo-Fr 08:00-18:00",
  offers: [
    {
      "@type": "Offer",
      name: "Weekly Pet Waste Monitoring & Removal",
      priceRange: "$20-$24",
      description:
        "Weekly monitoring service with AI-powered health insights and early alerts",
    },
    {
      "@type": "Offer",
      name: "One-Time Clean",
      priceRange: "$89",
      description: "Complete yard cleanup with initial health assessment",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-white">
      <head>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Preload LCP image for better performance */}
        <link
          rel="preload"
          href="/yardura-logo.png"
          as="image"
          type="image/png"
          fetchPriority="high"
        />
      </head>
      <body className="min-h-screen text-slate-800">
        {/* Skip to main content link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-accent text-white px-4 py-2 rounded-md z-50 focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Skip to main content
        </a>

        <Providers>
          <HeaderWrapper />
          <ScrollProgress />
          {children}
          <Toaster richColors position="top-right" />
          {/* Removed left-side quick nav and sticky CTA */}
          <StructuredData />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </Providers>
      </body>
    </html>
  );
}
