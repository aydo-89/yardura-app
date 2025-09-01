import SiteHeader from "@/components/site-header";
import Hero from "@/components/hero";
import Differentiators from "@/components/Differentiators";
import WhyItMatters from "@/components/WhyItMatters";
import Insights from "@/components/insights";
import HowItWorks from "@/components/services";
import Pricing from "@/components/pricing";
import QuoteTeaser from "@/components/QuoteTeaser";
import Eco from "@/components/eco";
import Testimonials from "@/components/testimonials";
import FAQ from "@/components/faq";
import Footer from "@/components/footer";
import StickyCTA from "@/components/sticky-cta";

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Yardura",
    image: "https://www.yardura.com/og-image.jpg",
    url: "https://www.yardura.com",
    telephone: "+16125819812",
    address: { "@type": "PostalAddress", addressLocality: "Minneapolis", addressRegion: "MN", postalCode: "55417", addressCountry: "US" },
    areaServed: ["South Minneapolis","Richfield","Edina","Bloomington"],
    description: "Tech-enabled, eco-friendly dog waste removal with smart health insights.",
    openingHours: "Mo-Fr 08:00-18:00",
  } as const;

  return (
    <>
      <SiteHeader/>
      <main>
        {/* Backward compatibility anchor for old #quote links */}
        <span id="quote" />
        <Hero/>
        <Differentiators/>
        <WhyItMatters/>
        <Insights/>
        <HowItWorks/>
        <Pricing/>
        <QuoteTeaser/>
        <Eco/>
        <Testimonials/>
        <FAQ/>
      </main>
      <Footer/>
      <StickyCTA/>

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
          `
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
