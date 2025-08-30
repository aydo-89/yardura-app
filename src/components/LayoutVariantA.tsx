"use client";

import SiteHeader from "./site-header";
import Hero from "./hero";
import Differentiators from "./Differentiators";
import WhyItMatters from "./WhyItMatters";
import Insights from "./insights";
import HowItWorks from "./services";
import QuoteTeaser from "./QuoteTeaser";
import Eco from "./eco";
import Testimonials from "./testimonials";
import FAQ from "./faq";
import Footer from "./footer";
import StickyCTA from "./sticky-cta";

export default function LayoutVariantA() {
  return (
    <>
      <header role="banner">
        <SiteHeader />
      </header>

      <main id="main-content">
        <Hero />
        <Differentiators />
        <WhyItMatters />
        <Insights />
        <HowItWorks />
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
