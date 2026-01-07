"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { brandColors } from "@/shared/brand";
import { useTheme } from "@/components/theme/ThemeProvider";
import AppStoreButtons from "@/components/wellness/AppStoreButtons";

export default function WellnessFooter() {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

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
        ? {
            desktop: "/hero_backgrounds/fall_retriever_dark.jpeg",
            mobile: "/hero_backgrounds/fall_retriever_mobile_dark.jpeg",
          }
        : {
            desktop: "/hero_backgrounds/fall_retriever.jpeg",
            mobile: "/hero_backgrounds/fall_retriever_mobile.jpeg",
          };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(155deg, rgba(6,12,9,0.62) 0%, rgba(8,16,12,0.52) 50%, rgba(10,18,14,0.44) 100%)";
    }
    return "linear-gradient(155deg, rgba(7,11,8,0.4) 0%, rgba(10,16,12,0.36) 50%, rgba(12,18,14,0.3) 100%)";
  }, [theme]);

  return (
    <footer className="mt-24 relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Healthy dog enjoying a calm yard"
          fill
          loading="eager"
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0" style={{ background: overlayStyle }} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(255,193,77,0.16), transparent 55%)",
          }}
        />
      </div>

      <div className="container relative py-20 text-white">
        <div className="mb-12 rounded-[40px] border border-white/20 bg-white/10 p-8 shadow-[0_32px_72px_rgba(3,7,6,0.6)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-white/70">
                Start free today
              </p>
              <h3 className="mt-2 text-3xl font-serif leading-tight">
                Download the InsightScoop Wellness App.
              </h3>
              <p className="mt-3 max-w-xl text-sm text-white/75">
                Daily check ins, stool capture, and AI support in your pocket.
                Add scooping service anytime for pro assisted capture and a
                cleaner yard.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <AppStoreButtons />
              <Link
                href="/quote?businessId=yardura"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Add scooping service
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/brand/insightscoop-logo-horizontal.png"
                alt="InsightScoop logo"
                className="h-14 w-auto object-contain"
              />
            </div>
            <p className="text-white/75 text-sm leading-relaxed">
              A freemium wellness app for pet owners that turns stool, symptoms,
              and routines into clear daily guidance.
            </p>
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-white/20 bg-white/10">
              <div
                className="h-3 w-3 rounded-full animate-pulse shadow-sm"
                style={{ backgroundColor: brandColors.coral }}
              />
              <span className="text-xs uppercase tracking-[0.28em] text-white/70">
                Free core features
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-serif font-semibold">Wellness</h4>
            <div className="space-y-3 text-sm text-white/75">
              {[
                { label: "Stool capture and AI insights", href: "#features" },
                { label: "Daily check ins and reminders", href: "#features" },
                { label: "Food and med log", href: "#toolkit" },
                { label: "Vet ready reports", href: "#reports" },
                { label: "Our Story", href: "/our-story" },
              ].map((link) => (
                <p key={link.label}>
                  <a
                    href={link.href}
                    className="inline-flex items-center gap-2 hover:text-white"
                  >
                    <ArrowRight className="size-3" />
                    {link.label}
                  </a>
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-serif font-semibold">Premium and Pro</h4>
            <div className="space-y-3 text-sm text-white/75">
              {[
                { label: "Premium analytics and trends", href: "#plans" },
                { label: "Walk tracking and wellness score", href: "#plans" },
                { label: "Pro assisted scooping plans", href: "#pro" },
                { label: "Shareable email reports", href: "#reports" },
              ].map((link) => (
                <p key={link.label}>
                  <a
                    href={link.href}
                    className="inline-flex items-center gap-2 hover:text-white"
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
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between text-white/70 text-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <span className="font-medium text-white/85">
                (c) {new Date().getFullYear()} Yardura. All rights reserved.
              </span>
              <div className="flex items-center gap-4">
                <a href="/privacy" className="hover:text-white">
                  Privacy Policy
                </a>
                <a href="/terms" className="hover:text-white">
                  Terms of Service
                </a>
                <a href="/cookies" className="hover:text-white">
                  Cookie Policy
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="mailto:hello@insightscoop.ai"
                className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Contact wellness team
              </a>
              <a
                href="/signin"
                className="rounded-2xl bg-brand-accent px-5 py-3 text-sm font-semibold text-white shadow-lg"
              >
                Log in
              </a>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/15">
            <p className="text-xs text-white/60 text-center max-w-2xl mx-auto leading-relaxed">
              Wellness insights are informational only. They do not replace
              veterinary care or diagnosis.
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
