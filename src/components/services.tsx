"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { PawPrint, Recycle, SprayCan } from "lucide-react";
import Reveal from "@/components/Reveal";
import { useTheme } from "./theme/ThemeProvider";

const packages = [
  {
    title: "Clean yard + recap link",
    copy: "Full-yard sweep, tidy bagging, gate photo, and a simple recap link with stool health notes you can skim when you want.",
    highlights: ["Clean yard, handled", "Recap link + wellness notes", "Gate photo confirmation"],
    icon: PawPrint,
  },
  {
    title: "Deodorizing add-on",
    copy: "Plant-based deodorizing for turf + patios to keep things fresh between visits.",
    highlights: ["Targets turf, patios, rock beds", "Kid + pet safe, dries fast", "Great before guests"],
    icon: SprayCan,
  },
  {
    title: "Disposal options (optional)",
    copy: "Standard (included), haul-away, or compost routing via our small in-house composter when capacity allows.",
    highlights: ["Standard (included): tidy in your bin", "Haul-away: nothing sitting curbside", "Compost: in-house when capacity allows"],
    icon: Recycle,
  },
];

const extras = [
  {
    label: "Same-day rush",
    detail: "Need a rush clean before guests arrive? Text dispatch before noon and we'll try to fit you in.",
  },
  {
    label: "Vacation pauses",
    detail: "Tap once in your service thread to pause, resume, or change cadences. No fees, no contracts.",
  },
  {
    label: "Add-on scans",
    detail: "Request a focused sweep of patios, decks, or courtyards - perfect for short-term rentals and condo greenspace.",
  },
];

export default function Services() {
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
        ? { desktop: "/hero_backgrounds/weiner_gold_left_dark.jpeg", mobile: "/hero_backgrounds/weiner_gold_left_dark.jpeg" }
        : { desktop: "/hero_backgrounds/weiner_gold_left_light.jpeg", mobile: "/hero_backgrounds/weiner_gold_left_light.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(145deg, rgba(8,16,12,0.5) 0%, rgba(8,18,12,0.42) 55%, rgba(6,12,9,0.36) 100%)";
    }
    return "linear-gradient(145deg, rgba(8,16,12,0.1) 0%, rgba(8,18,12,0.09) 55%, rgba(6,12,9,0.08) 100%)";
  }, [theme]);

  // Dark fallback ensures white text is always readable if image fails to load
  const fallbackBackground = "linear-gradient(135deg, #1a2820 0%, #0d1a14 50%, #0a100c 100%)";

  return (
    <section
      id="services"
      className="relative overflow-hidden text-white"
      style={{ background: fallbackBackground }}
    >
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Service friendly yard"
          fill
          priority
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "45% center" }}
          unoptimized
        />
        <div className="absolute inset-0" style={{ background: overlayStyle }} />
      </div>
      <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at top, rgba(255,193,77,0.15), transparent 55%)" }} />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em]">
            Services
          </div>
          <h2 className="mt-6 font-serif text-[clamp(2.8rem,5vw,4.5rem)] leading-tight">
            Build the ritual your yard deserves.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/80">
            Start with a clean yard, then add deodorizing or eco options when you’re ready. Everything is pauseable, textable, and built to keep your outdoor space feeling polished.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {packages.map((pkg, index) => (
            <Reveal key={pkg.title} delay={index * 0.1}>
              <div className="relative flex h-full flex-col gap-4 overflow-hidden rounded-[32px] border border-white/14 bg-[rgba(8,18,14,0.5)] p-6 shadow-[0_30px_70px_rgba(5,8,7,0.48)] backdrop-blur-md">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/16 via-black/8 to-transparent" />
                <div className="relative z-10 flex h-full flex-col gap-4">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  <pkg.icon className="h-5 w-5 text-brand-gold" />
                  {pkg.title}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-white/80">{pkg.copy}</p>
                <ul className="space-y-2 text-sm text-white/75">
                  {pkg.highlights.map((highlight) => (
                    <li key={highlight} className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
                      {highlight}
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative min-h-[260px] overflow-hidden rounded-[32px] border border-white/15 bg-black/30 shadow-[0_28px_64px_rgba(5,8,7,0.5)]">
              <Image
                src="/employee/car_magnet_scooper.png"
                alt="Scooper vehicle with InsightScoop magnet"
                fill
                className="object-cover"
                sizes="(min-width: 768px) 45vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85">
                Easy to spot
              </div>
            </div>

            <div className="relative min-h-[260px] overflow-hidden rounded-[32px] border border-white/15 bg-black/30 shadow-[0_28px_64px_rgba(5,8,7,0.5)]">
              <Image
                src="/employee/truck_wrapped_scooper.png"
                alt="InsightScoop truck ready for route"
                fill
                className="object-cover"
                sizes="(min-width: 768px) 45vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute bottom-5 left-5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85">
                Local scoopers
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal>
            <div className="rounded-[32px] border border-white/15 bg-white/5 p-8 shadow-[0_32px_68px_rgba(3,7,6,0.55)]">
              <h3 className="text-2xl font-serif font-semibold">On-demand extras</h3>
              <p className="mt-2 text-sm text-white/75">
                Everything lives inside a single service thread. Need to skip a week, add deodorizing, or change disposal options? Reply once — done.
              </p>
              <div className="mt-6 space-y-4">
                {extras.map((extra) => (
                  <div key={extra.label} className="rounded-2xl border border-white/12 bg-black/30 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-gold">{extra.label}</p>
                    <p className="mt-2 text-sm text-white/75">{extra.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="rounded-[32px] border border-white/15 bg-gradient-to-br from-[rgba(143,244,195,0.12)] via-[rgba(12,24,18,0.85)] to-transparent p-8 shadow-[0_32px_68px_rgba(3,7,6,0.55)]">
              <h3 className="text-2xl font-serif font-semibold">How scheduling works</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li>• Routes run Mon–Sat with weather-aware rerouting.</li>
                <li>• We enter/exit through your preferred gate + snap confirmation.</li>
                <li>• Billing only after completed visits - no contracts, no prepay.</li>
                <li>• Need help? Dispatch texts back in under 12 business hours.</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
