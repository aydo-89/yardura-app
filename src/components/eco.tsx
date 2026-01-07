"use client";

import Image from "next/image";
import { motion } from "@/lib/framermotion";
import { Leaf, Recycle, Wind, TrendingUp } from "lucide-react";
import { brandColors, withAlpha } from "@/shared/brand";
import { useTheme } from "./theme/ThemeProvider";
import { useEffect, useMemo, useState } from "react";

const scheduleOptions = [
  {
    label: "Daily",
    detail: "Mon–Fri sweeps for multi-dog homes",
  },
  {
    label: "Twice Weekly",
    detail: "Keeps high-traffic yards under control",
  },
  {
    label: "Weekly",
    detail: "Most popular rhythm — clean yard + recap link",
  },
  {
    label: "Biweekly",
    detail: "Budget-friendly refresh every other week",
  },
  {
    label: "Monthly",
    detail: "Seasonal tune-ups & patio prep",
  },
  {
    label: "One-Time",
    detail: "One-time deep clean & yard reset",
  },
];

const impactStats = [
  {
    icon: Leaf,
    label: "Quarterly",
    detail: "eco impact estimate (opt-in)",
    accent: brandColors.mint,
  },
  {
    icon: Wind,
    label: "Haul-away",
    detail: "nothing sitting curbside",
    accent: brandColors.gold,
  },
  {
    icon: TrendingUp,
    label: "Compost routing",
    detail: "when partner capacity allows",
    accent: brandColors.coral,
  },
];

const diversionLevels = [
  {
    label: "Standard (included)",
    description: "Sealed bagging + tidy placement in your bin. Clean yard, handled.",
  },
  {
    label: "Haul-away",
    description: "We remove every sealed bag offsite so nothing sits curbside.",
  },
  {
    label: "Compost routing",
    description: "We route bags through our small in-house composter when capacity allows and track an estimated impact either way.",
  },
];

export default function Eco() {
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
        ? { desktop: "/hero_backgrounds/red_poodle_dark.jpeg", mobile: "/hero_backgrounds/red_poodle_dark.jpeg" }
        : { desktop: "/hero_backgrounds/red_poodle.jpeg", mobile: "/hero_backgrounds/red_poodle.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(150deg, rgba(8,16,12,0.6) 0%, rgba(8,22,14,0.5) 45%, rgba(12,28,18,0.42) 100%)";
    }
    return "linear-gradient(150deg, rgba(8,16,12,0.26) 0%, rgba(8,22,14,0.24) 45%, rgba(12,26,18,0.22) 100%)";
  }, [theme]);

  return (
    <section
      id="eco"
      className="landing-section section-modern relative overflow-hidden"
      style={{ backgroundColor: theme === "dark" ? "#0a100c" : "#f8f5ee" }}
    >
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Eco-friendly landscape with greenery"
          fill
          loading="eager"
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "45% center" }}
        />
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ amount: 0.2 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: overlayStyle }}
        />
      </div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 -top-12 h-16 z-[1]"
        initial={{ opacity: 0, y: -28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="h-full w-full bg-gradient-to-b from-[rgba(var(--vanilla-rgb-commas),0.9)] via-[rgba(var(--mint-rgb-commas),0.38)] to-transparent" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 -bottom-12 h-16 z-[1]"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <div className="h-full w-full bg-gradient-to-t from-[rgba(var(--vanilla-rgb-commas),0.82)] via-[rgba(var(--gold-rgb-commas),0.32)] to-transparent" />
      </motion.div>

      <div className="container relative z-10 py-20 text-white">
        <div className="text-center mb-16 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
            <Leaf className="size-4 text-brand-mint" />
            Eco upgrades (optional)
          </div>
          <h2 className="mt-6 text-5xl font-serif leading-tight md:text-6xl">
            Cleaner yard, cleaner routine.
          </h2>
          <p className="mt-4 text-lg text-white/85">
            We keep things tidy by default. If you want to go greener—or keep bags out of your bin—we offer haul-away and compost routing where available.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-8">
            <div className="rounded-[32px] border border-white/15 bg-white/5 p-8 shadow-[0_32px_64px_rgba(3,7,6,0.55)]">
              <p className="text-lg leading-relaxed text-white/90">
                Standard service is simple: sealed bagging, full-yard sweep, and tidy finish. Choose eco upgrades if you want less waste sitting in your bin—or to divert when possible.
              </p>
              <p className="mt-4 text-sm text-white/70">
                Add-on: deodorizing for turf + patios. Dries fast, stays pet/kid safe, and keeps the yard guest-ready.
              </p>
            </div>

            <div className="rounded-[32px] border border-white/12 bg-white/5 p-8 shadow-[0_28px_60px_rgba(3,7,6,0.5)]">
              <div className="flex items-center gap-3 mb-6">
                <Recycle className="size-6 text-brand-mint" />
                <h3 className="text-2xl font-serif font-semibold">Pick your cadence</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {scheduleOptions.map((option) => (
                  <div
                    key={option.label}
                    className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm font-medium text-white/80 shadow-[0_18px_32px_rgba(3,7,6,0.45)]"
                  >
                    <div className="text-base font-semibold text-white">{option.label}</div>
                    <p className="mt-1 text-white/70">{option.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-white/12 bg-white/5 p-8 shadow-[0_28px_60px_rgba(3,7,6,0.5)]">
              <div className="flex items-center gap-3 mb-6">
                <Leaf className="size-6 text-brand-gold" />
                <h3 className="text-2xl font-serif font-semibold">Choose your disposal option</h3>
              </div>
              <div className="space-y-4">
                {diversionLevels.map((tier) => (
                  <div key={tier.label} className="rounded-2xl border border-white/12 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-brand-gold uppercase tracking-[0.3em]">{tier.label}</p>
                    <p className="mt-2 text-sm text-white/75">{tier.description}</p>
                  </div>
                ))}
                <p className="text-[0.75rem] text-white/60">
                  *Compost routing capacity can vary. We divert as much as our in-house capacity allows and still track your estimated impact.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-white/15 bg-gradient-to-br from-[rgba(143,244,195,0.18)] via-[rgba(12,24,18,0.85)] to-transparent p-8 shadow-[0_40px_80px_rgba(3,7,6,0.55)]">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="size-6 text-brand-mint" />
                <h3 className="text-2xl font-serif font-semibold">Impact scoreboard</h3>
              </div>
              <div className="grid gap-4">
                {impactStats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-white/15 bg-black/20 p-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: withAlpha(stat.accent, 0.18), color: stat.accent }}
                    >
                      <stat.icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{stat.label}</p>
                      <p className="text-sm text-white/75">{stat.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-white/80">
                Impact estimates update quarterly. Dashboard view is coming in 2026.
              </p>
            </div>

            <div className="rounded-[32px] border border-white/15 bg-white/5 p-8 shadow-[0_32px_64px_rgba(3,7,6,0.55)]">
              <div className="flex items-center gap-3 mb-4">
                <Recycle className="size-6 text-brand-mint" />
                <h3 className="text-xl font-serif font-semibold">In-house compost pilot</h3>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                Compost routing runs through our small in-house composter while we scale. When compost capacity is full, we still keep disposal tidy and transparent—and we’ll always show what’s active for your plan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
