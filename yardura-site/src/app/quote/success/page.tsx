import QuoteSuccessClient from '@/components/QuoteSuccessClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quote Confirmed – Welcome to Yardura! | Minneapolis Dog Waste Removal',
  description:
    'Your dog waste removal quote is confirmed! Check your email for secure login details and schedule your first eco-friendly service visit.',
  keywords: [
    'dog waste removal quote confirmed',
    'yardura account created',
    'dog poop service scheduled',
  ],
  openGraph: {
    title: 'Quote Confirmed – Welcome to Yardura!',
    description:
      'Your eco-friendly dog waste removal service is ready. Check your email for login details.',
    type: 'website',
    url: 'https://www.yardura.com/quote/success',
  },
  alternates: {
    canonical: 'https://www.yardura.com/quote/success',
  },
  robots: {
    index: false, // Don't index success pages
    follow: true,
  },
};

export default function QuoteSuccessPage() {
  return <QuoteSuccessClient />;
}
