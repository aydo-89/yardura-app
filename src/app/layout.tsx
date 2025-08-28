import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import StickyCTA from "@/components/sticky-cta";
import ProgressIndicator from "@/components/progress-indicator";

export const metadata: Metadata = {
  title: "Yardura | Tech-Enabled, Eco-Friendly Dog Waste Removal – Twin Cities",
  description:
    "Premium poop-scooping with smart health insights and eco composting. Serving South Minneapolis, Richfield, Edina, Bloomington.",
  openGraph: {
    title: "Yardura | Tech-Enabled, Eco-Friendly Dog Waste Removal",
    description: "Clean yard. Health insights. Less landfill. More wag.",
    type: "website",
    url: "https://www.yardura.com",
    locale: "en_US",
  },
  icons: { icon: "/icon" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-white">
      <body className="min-h-screen text-slate-800">
        {children}
        <Toaster richColors position="top-right" />
        <StickyCTA />
        <ProgressIndicator />
      </body>
    </html>
  );
}
