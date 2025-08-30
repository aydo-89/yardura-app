"use client";

import SiteHeader from "./site-header";
import Hero from "./hero";
import Differentiators from "./Differentiators";
import HowItWorks from "./services";
import WhyItMatters from "./WhyItMatters";
import Insights from "./insights";
import QuoteTeaser from "./QuoteTeaser";
import Eco from "./eco";
import Testimonials from "./testimonials";
import FAQ from "./faq";
import Footer from "./footer";
import StickyCTA from "./sticky-cta";

export default function LayoutVariantB() {
  return (
    <>
      <header role="banner">
        <SiteHeader />
      </header>

      <main id="main-content">
        <Hero />
        <Differentiators />
        <HowItWorks />
        <WhyItMatters />
        <Insights />
        <QuoteTeaser />
        <Eco />
        <Testimonials />
        <FAQ />
      </main>

      <footer role="contentinfo">
        <Footer />
      </footer>

      <StickyCTA />
    </>
  );
}
