import type { Metadata } from "next";

import WellnessLanding from "@/components/wellness/WellnessLanding";
import WellnessFooter from "@/components/wellness/WellnessFooter";
import { DEFAULT_IMAGE, SITE_DOMAIN } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "InsightScoop Wellness App - Free daily dog health insights",
  description:
    "Download the free InsightScoop Wellness App to capture stool, log daily symptoms, and get AI supported gut health insights. Upgrade for premium trends or add pro assisted scooping for cleaner, verified data.",
  alternates: {
    canonical: `${SITE_DOMAIN}/wellness`,
  },
  openGraph: {
    title: "InsightScoop Wellness App - Free daily dog health insights",
    description:
      "Capture stool, log symptoms, and get hydration, firmness, and watch or vet now guidance in minutes. Premium and pro assisted options available.",
    url: `${SITE_DOMAIN}/wellness`,
    type: "website",
    siteName: "InsightScoop",
    images: [
      {
        url: DEFAULT_IMAGE,
        width: 1200,
        height: 630,
        alt: "InsightScoop Wellness App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InsightScoop Wellness App - Free daily dog health insights",
    description:
      "A freemium wellness app that turns stool and symptoms into clear daily guidance for pet owners.",
    images: [DEFAULT_IMAGE],
  },
};

export default function WellnessPage() {
  return (
    <>
      <WellnessLanding />
      <WellnessFooter />
    </>
  );
}
