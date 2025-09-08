import AnimatedHeader from '@/components/site/AnimatedHeader';
import Hero from '@/components/hero';
import Differentiators from '@/components/Differentiators';
import WhyItMatters from '@/components/WhyItMatters';
import dynamic from 'next/dynamic';
import HowItWorks from '@/components/services';
import Pricing from '@/components/pricing';
import Eco from '@/components/eco';
import Testimonials from '@/components/testimonials';
import FAQ from '@/components/faq';
import Footer from '@/components/footer';
import StickyCTA from '@/components/sticky-cta';

export default function Page() {
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
    areaServed: ['South Minneapolis', 'Richfield', 'Edina', 'Bloomington', 'St. Cloud'],
    description: 'Tech-enabled, eco-friendly dog waste removal with smart health insights.',
    openingHours: 'Mo-Fr 08:00-18:00',
  } as const;

  return (
    <>
      <AnimatedHeader />
      <main>
        {/* Backward compatibility anchor for old #quote links */}
        <span id="quote" />
        {/* Hero with anchor for nav/scroll tracking */}
        <div id="hero">
          <Hero />
        </div>
        {/* Differentiators + mission framing */}
        <Differentiators />
        <WhyItMatters />
        {/* Proof via original Eco stats + Testimonials */}
        <Eco />
        <Testimonials />
        {/* Pricing before How It Works for conversion focus */}
        <Pricing />
        <HowItWorks />
        {/* Insights preview lazily loaded for performance */}
        {/** Proper dynamic component usage with fallback **/}
        {(() => {
          const Insights = dynamic(() => import('@/components/insights'), {
            loading: () => (
              <div className="container py-16">
                <div className="h-48 rounded-2xl bg-accent-soft/20 border border-accent/10 animate-pulse" />
              </div>
            ),
          });
          return <Insights />;
        })()}
        {/* FAQ at end before footer */}
        <FAQ />
      </main>
      <Footer />
      <StickyCTA />

      {/* Backward compatibility script for #quote hash redirects */}
      {/* Hash fallback for backward compatibility */}
      <div id="quote" />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              if (window.location.hash === '#quote') {
                // Small delay to ensure Next.js routing is ready
                setTimeout(function() {
                  window.location.href = '/quote';
                }, 100);
              }
            })();
          `,
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
