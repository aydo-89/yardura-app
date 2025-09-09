import type { Metadata } from 'next';
import './globals.css';
import './styles/tokens.css';
import { Toaster } from 'sonner';
import StickyCTA from '@/components/sticky-cta';
import ProgressIndicator from '@/components/progress-indicator';
import ScrollProgress from '@/components/site/ScrollProgress';
import StructuredData from '@/components/seo/StructuredData';
import Providers from '@/components/providers';

export const metadata: Metadata = {
  title: 'Yardura | Tech-Enabled, Eco-Friendly Dog Waste Removal – Twin Cities',
  description:
    'Premium dog waste removal service in Minneapolis, Richfield, Edina & Bloomington. Weekly eco-friendly poop scooping with health insights & smart composting.',
  keywords: [
    'dog waste removal Minneapolis',
    'pooper scooper service Twin Cities',
    'eco dog waste disposal',
    'weekly poop pickup Minneapolis',
    'dog poop health insights',
    'eco-friendly pet waste management',
  ],
  authors: [{ name: 'Yardura' }],
  openGraph: {
    title: 'Yardura | Tech-Enabled Dog Waste Removal – Minneapolis, MN',
    description:
      'Clean yard. Health insights. Less landfill. More wag. Serving Minneapolis, Richfield, Edina & Bloomington.',
    type: 'website',
    url: 'https://www.yardura.com',
    locale: 'en_US',
    siteName: 'Yardura',
    images: [
      {
        url: '/api/og?type=homepage',
        width: 1200,
        height: 630,
        alt: 'Yardura - Clean yard, smarter insights. Tech-enabled dog waste removal with health monitoring.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yardura | Tech-Enabled Dog Waste Removal – Minneapolis',
    description:
      'Clean yard. Health insights. Less landfill. More wag. Serving Minneapolis, Richfield, Edina & Bloomington.',
    creator: '@yardura',
    images: ['/api/og?type=homepage'],
  },
  alternates: {
    canonical: 'https://www.yardura.com',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: { icon: '/icon' },
  other: {
    // Preload LCP image for better performance
    preload: '/modern_yard.png',
  },
};

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Yardura',
  image: 'https://www.yardura.com/og-image.jpg',
  url: 'https://www.yardura.com',
  telephone: '+16125819812',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Minneapolis',
    addressRegion: 'MN',
    postalCode: '55417',
    addressCountry: 'US',
  },
  areaServed: ['South Minneapolis', 'Richfield', 'Edina', 'Bloomington'],
  description: 'Tech-enabled, eco-friendly dog waste removal with smart health insights.',
  openingHours: 'Mo-Fr 08:00-18:00',
  offers: [
    {
      '@type': 'Offer',
      name: 'Weekly Dog Waste Removal',
      priceRange: '$20-$24',
      description: 'Weekly scooping service with optional health insights',
    },
    {
      '@type': 'Offer',
      name: 'One-Time Clean',
      priceRange: '$89',
      description: 'Complete yard cleanup service',
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-white">
      <head>
        {/* Preload LCP image for better performance */}
        <link
          rel="preload"
          href="/modern_yard.png"
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
