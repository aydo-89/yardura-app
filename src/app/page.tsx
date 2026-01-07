import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions, safeGetServerSession } from "@/lib/auth";
import { getDefaultRedirectForRole } from "@/lib/auth/roles";
import Hero from "@/components/hero";
import Differentiators from "@/components/Differentiators";
import WhyItMatters from "@/components/WhyItMatters";
import HowItWorks from "@/components/HowItWorks";
import Insights from "@/components/insights";
import Testimonials from "@/components/testimonials";
import Services from "@/components/services";
import Pricing from "@/components/pricing";
import Eco from "@/components/eco";
import FAQ from "@/components/faq";
import Footer from "@/components/footer";
import StickyCTA from "@/components/sticky-cta";
import LandingScrollEffects from "@/components/LandingScrollEffects";
import SectionDivider from "@/components/SectionDivider";
import YarduraLanding from "@/components/yardura/YarduraLanding";
import YarduraHeader from "@/components/yardura/YarduraHeader";
import YarduraFooter from "@/components/yardura/YarduraFooter";

const YARDURA_DOMAIN = "https://www.yardura.com";
const INSIGHTS_DOMAIN = "https://www.getinsightscoop.com";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get("host")?.toLowerCase() ?? "";
  const isYardura = host.includes("yardura.com");

  if (isYardura) {
    return {
      title: "Yardura — Building pet-first yard and wellness brands",
      description:
        "Yardura is the parent company behind InsightScoop, Pupplmnt, Supp Dog, and Once Upon a Lawn—accelerating pet-first services with shared operations, AI, and sustainability.",
      alternates: {
        canonical: YARDURA_DOMAIN,
      },
      openGraph: {
        title: "Yardura — Pet-first brand collective",
        description:
          "Explore Yardura's portfolio of yard and pet wellness brands, including InsightScoop, Pupplmnt, Supp Dog, and Once Upon a Lawn.",
        url: YARDURA_DOMAIN,
        type: "website",
        siteName: "Yardura",
      },
      twitter: {
        card: "summary_large_image",
        title: "Yardura — Pet-first brand collective",
        description:
          "We incubate and scale yard and pet wellness brands leveraging shared ops, AI insights, and sustainable practices.",
      },
    };
  }

  return {
    title: "InsightScoop — Poop scooping + optional 3C stool recap",
    description:
      "Reliable poop scooping with a simple 3-point stool recap (Color, Consistency, Content) after each visit. Gate photo proof, AI-flagged irregularities on request, and optional eco add-ons across Minnesota.",
    alternates: {
      canonical: INSIGHTS_DOMAIN,
    },
    openGraph: {
      title: "InsightScoop — Poop scooping + optional 3C stool recap",
      description:
        "Scooping-first service with gate photo proof and a light 3-point stool recap after every visit. Images only on request when AI flags irregularities. Optional deodorizing, haul-away, and compost routing.",
      url: INSIGHTS_DOMAIN,
      type: "website",
      siteName: "InsightScoop",
    },
    twitter: {
      card: "summary_large_image",
      title: "InsightScoop — Poop scooping + optional 3C stool recap",
      description:
        "Clean yard first. Optional 3-point stool recap link after each visit. AI flags irregularities; images only if you ask to see them.",
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isLogout = params.logout !== undefined;
  const headersList = await headers();
  const host = headersList.get("host")?.toLowerCase() ?? "";
  const isYarduraHost = host.includes("yardura.com");
  
  // If this is a logout request, skip session check to prevent redirect loop
  if (!isYarduraHost && !isLogout) {
    const session = await safeGetServerSession(authOptions);

    if (session?.user) {
      const role = (session as any)?.userRole ?? (session.user as any)?.role;
      const redirectPath = getDefaultRedirectForRole(role) ?? "/dashboard";
      redirect(redirectPath);
    }
  }

  if (isYarduraHost) {
    const yarduraJsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Yardura",
      url: YARDURA_DOMAIN,
      description:
        "Yardura is the parent company powering InsightScoop, Pupplmnt, Supp Dog, and Once Upon a Lawn—pet-first brands focused on healthier yards and happier dogs.",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+1-877-417-9273",
        email: "hello@yardura.com",
        contactType: "customer service",
        areaServed: ["US-MN"],
      },
      hasBrand: [
        {
          "@type": "Brand",
          name: "InsightScoop",
          url: INSIGHTS_DOMAIN,
        },
        {
          "@type": "Brand",
          name: "Pupplmnt",
          url: "https://www.pupplmnt.com",
        },
        {
          "@type": "Brand",
          name: "Supp Dog",
          url: "https://www.suppdog.com",
        },
        {
          "@type": "Brand",
          name: "Once Upon a Lawn",
          url: "https://www.onceuponalawn.com",
        },
      ],
    };

    return (
      <>
        <YarduraHeader />
        <YarduraLanding />
        <YarduraFooter />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(yarduraJsonLd) }} />
      </>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "InsightScoop",
    image: `${INSIGHTS_DOMAIN}/api/og?type=homepage`,
    url: INSIGHTS_DOMAIN,
    telephone: "+1-877-417-9273",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Minneapolis",
      addressRegion: "MN",
      postalCode: "55417",
      addressCountry: "US",
    },
    areaServed: [
      "South Minneapolis",
      "Edina",
      "Bloomington",
      "Eagan",
      "Inver Grove Heights",
      "Minnetonka",
      "St. Cloud",
    ],
    description:
      "InsightScoop delivers reliable poop scooping plus a simple 3-point stool recap (Color, Consistency, Content) after each visit. Gate photo proof is included; AI-flagged irregularities are shared only if you want to see them.",
    openingHours: "Mo-Fr 08:00-18:00",
  } as const;

  return (
    <>
      <main>
        <LandingScrollEffects />
        {/* Backward compatibility anchor for old #quote links */}
        <span id="quote" />
        {/* Hero with anchor for nav/scroll tracking */}
        <div id="hero">
          <Hero />
        </div>
        <SectionDivider accent="mint" />
        {/* What makes us different */}
        <Differentiators />
        <SectionDivider accent="mint" />
        {/* Core value proposition after hero */}
        <WhyItMatters />
        <SectionDivider accent="gold" direction="up" />
        {/* How our AI system works - 6-step process */}
        <HowItWorks />
        <SectionDivider accent="mint" />
        {/* Advanced technology differentiation */}
        <Insights />
        <SectionDivider accent="cream" direction="up" />
        {/* Environmental benefits and service areas */}
        <Eco />
        <SectionDivider accent="mint" direction="up" />
        {/* Social proof before pricing */}
        <Testimonials />
        <SectionDivider accent="gold" />
        {/* Pricing for conversion focus */}
        <Pricing />
        <SectionDivider accent="mint" direction="up" />
        {/* Service details and add-ons */}
        <Services />
        <SectionDivider accent="cream" />
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
