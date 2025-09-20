import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import QuoteWizard from '@/components/quote/QuoteWizard';
import type { Metadata } from 'next';

export const metadata = {
  title: 'Get Your Dog Waste Removal Quote – Minneapolis, MN | Yardura',
  description:
    'Get an instant quote for professional dog waste removal in Minneapolis, Richfield, Edina & Bloomington. Weekly eco-friendly service with health insights.',
  keywords: [
    'dog waste removal quote Minneapolis',
    'pooper scooper service cost',
    'dog poop pickup pricing',
    'eco dog waste service quote',
  ],
  openGraph: {
    title: 'Get Your Dog Waste Removal Quote – Minneapolis',
    description:
      'Instant quotes for eco-friendly dog waste removal. Serving Minneapolis, Richfield, Edina & Bloomington.',
    type: 'website',
    url: 'https://www.yardura.com/quote',
    images: [
      {
        url: '/api/og?type=quote',
        width: 1200,
        height: 630,
        alt: 'Get your dog waste removal quote - Weekly service starting at $20/visit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get Your Dog Waste Removal Quote – Minneapolis',
    description:
      'Instant quotes for eco-friendly dog waste removal. Serving Minneapolis, Richfield, Edina & Bloomington.',
    images: ['/api/og?type=quote'],
  },
  alternates: {
    canonical: 'https://www.yardura.com/quote',
  },
};

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const params = await searchParams;
  // Server-side redirect if no businessId
  if (!params.businessId) {
    redirect('/quote?businessId=yardura');
  }

  return (
    <Suspense fallback={<div className="text-center py-8">Loading quote system...</div>}>
      <QuoteWizard />
    </Suspense>
  );
}
