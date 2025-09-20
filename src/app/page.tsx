import AnimatedHeader from '@/components/site/AnimatedHeader';
import Hero from '@/components/hero';
import Differentiators from '@/components/Differentiators';
import WhyItMatters from '@/components/WhyItMatters';
import Insights from '@/components/insights';
import Testimonials from '@/components/testimonials';
import HowItWorks from '@/components/services';
import Pricing from '@/components/pricing';
import Eco from '@/components/eco';
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
        {/* What makes us different */}
        <Differentiators />
        {/* Core value proposition after hero */}
        <WhyItMatters />
        {/* Advanced technology differentiation */}
        <Insights />
        {/* Environmental benefits and service areas */}
        <Eco />
        {/* Social proof before pricing */}
        <Testimonials />
        {/* Pricing for conversion focus */}
        <Pricing />
        {/* How it works - process explanation */}
        <HowItWorks />
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
                  window.location.href = '/quote?businessId=yarddog';
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
