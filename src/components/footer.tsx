"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPublicCities } from "@/lib/cityData";
import { ArrowRight } from "lucide-react";
import { brandColors } from "@/shared/brand";
import { useTheme } from "./theme/ThemeProvider";
import AppStoreButtons from "@/components/wellness/AppStoreButtons";

export default function Footer() {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname() ?? "/";
  const showWellnessCta = pathname === "/";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const backgroundSrc = useMemo(() => {
    const mode = theme === "dark" ? "dark" : "light";
    const base =
      mode === "dark"
        ? { desktop: "/hero_backgrounds/dalmatian_white_left_dark.jpeg", mobile: "/hero_backgrounds/dalmatian_white_left_dark.jpeg" }
        : { desktop: "/hero_backgrounds/dalmatian_white_left_light.jpeg", mobile: "/hero_backgrounds/dalmatian_white_left_light.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(155deg, rgba(6,12,9,0.55) 0%, rgba(8,16,12,0.46) 50%, rgba(10,18,14,0.38) 100%)";
    }
    return "linear-gradient(155deg, rgba(7,11,8,0.3) 0%, rgba(10,16,12,0.26) 50%, rgba(12,18,14,0.22) 100%)";
  }, [theme]);

  const backgroundColor = theme === "dark" ? "#050b08" : "#f8f5ee";
  const cities = getPublicCities();
  return (
    <footer
      className="mt-24 relative overflow-hidden"
      style={{ backgroundColor }}
    >
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="InsightScoop service area"
          fill
          loading="eager"
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "right center" }}
        />
        <div className="absolute inset-0" style={{ background: overlayStyle }} />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at top left, rgba(255,193,77,0.14), transparent 55%)" }}
        />
      </div>

      <div className="container relative py-20 text-white">
        <div className="mb-12 rounded-[40px] border border-white/20 bg-gradient-to-br from-[rgba(143,244,195,0.12)] via-[rgba(12,24,18,0.85)] to-transparent p-8 shadow-[0_32px_72px_rgba(3,7,6,0.6)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-white/70">Ready when you are</p>
              <h3 className="mt-2 text-3xl font-serif leading-tight">
                Keep the yard clean—without thinking about it.
              </h3>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href="/quote?businessId=yardura"
                className="btn-cta-primary px-6 py-3 text-base"
              >
                Get my quote
              </a>
              <a
                href="tel:+18774179273"
                className="rounded-2xl border border-white/25 bg-white/10 px-6 py-3 text-base font-semibold"
              >
                Call (877) 417-9273
              </a>
            </div>
          </div>
        </div>

        {showWellnessCta && (
          <div className="mb-12 rounded-[32px] border border-white/20 bg-white/10 p-6 shadow-[0_28px_60px_rgba(3,7,6,0.5)] backdrop-blur">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">Free wellness app</p>
                <h3 className="mt-2 text-2xl font-serif leading-tight">
                  Track daily symptoms between visits.
                </h3>
                <p className="mt-2 text-sm text-white/75">
                  Capture stool, log check ins, and export vet ready summaries in the InsightScoop app.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3">
                <AppStoreButtons compact />
                <Link
                  href="/wellness"
                  className="text-xs font-semibold uppercase tracking-[0.32em] text-white/75 hover:text-white"
                >
                  See wellness app details
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-4">
              <img
                src="/brand/insightscoop-logo-horizontal.png"
                alt="InsightScoop logo"
                className="h-16 w-auto md:h-20 object-contain"
              />
            </div>
            <p className="text-white/80 leading-relaxed max-w-xl">
              A clean yard every visit, plus a simple recap link with stool health notes. Low-noise, fast, and built for real life.
            </p>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/10 border border-white/20 text-xs font-semibold uppercase tracking-[0.28em]">
              <span className="text-white/70">Clean Yards</span>
              <span className="text-white/50">•</span>
              <span className="text-white/70">Recap Link</span>
              <span className="text-white/50">•</span>
              <span className="text-white/70">Eco Options</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-white/18 bg-white/10">
              <div className="w-3 h-3 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: brandColors.coral }} />
              <span className="font-medium text-white/85">
                Dispatch replies in under 12hrs • Routes Mon–Sat
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-serif font-semibold">
              Twin Cities <span className="heading-underline text-brand-gold">Coverage</span>
            </h4>
            <div className="space-y-3">
              {cities.slice(0, 5).map((city) => (
                <p key={city.name}>
                  <a
                    href={`/city/${city.name}`}
                    className="text-white/70 hover:text-white transition-all duration-300 inline-flex items-center gap-2 hover:translate-x-1"
                  >
                    <span className="inline-block size-1.5 rounded-full bg-white/30" />
                    {city.displayName}
                  </a>
                </p>
              ))}
            </div>
            <a
              href="/city"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-gold hover:text-white transition-all duration-300"
            >
              View All Cities
              <ArrowRight className="size-4" />
            </a>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-serif font-semibold">
              <span className="heading-underline">Services</span>
            </h4>
            <div className="space-y-3">
              {[
                { label: "Dog Waste Removal", href: "#services" },
                { label: "Pricing Plans", href: "#pricing" },
                { label: "Recap Link + Wellness Notes", href: "#insights" },
                { label: "Eco Options", href: "#eco" },
                { label: "Our Story", href: "/our-story" },
              ].map((link) => (
                <p key={link.href}>
                  <a
                    href={link.href}
                    className="text-white/70 hover:text-white transition-all duration-300 inline-flex items-center gap-2 hover:translate-x-1"
                  >
                    <ArrowRight className="size-3" />
                    {link.label}
                  </a>
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/15 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-white/70 text-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <span className="font-medium text-white/85">
                © {new Date().getFullYear()} Yardura. All rights reserved.
              </span>
              <div className="flex items-center gap-4">
                <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="/cookies" className="hover:text-white transition-colors">Cookie Policy</a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="tel:+18774179273"
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 bg-brand-accent text-white shadow-[0_18px_46px_rgba(243,100,91,0.35)]"
              >
                📞 1-877-417-YARD
              </a>
              <a
                href="/quote"
                className="px-6 py-3 rounded-2xl font-semibold border border-white/25 bg-white/10 text-white hover:bg-white/15 transition-all duration-300 hover:scale-105"
              >
                Get Quote
              </a>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/15">
            <p className="text-xs text-white/60 text-center max-w-2xl mx-auto leading-relaxed">
              Wellness insights are informational only—not veterinary advice.
            </p>
            <p className="text-xs text-white/50 text-center mt-2">
              Powered by Yardura
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
