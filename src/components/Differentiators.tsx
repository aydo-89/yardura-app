"use client";

import Image from "next/image";
import { Shield, Truck, LucideIcon, HeartPulse, Sparkles } from "lucide-react";
import { motion } from "@/lib/framermotion";
import Reveal from "./Reveal";
import { brandColors, withAlpha } from "@/shared/brand";
import { useTheme } from "./theme/ThemeProvider";
import { useEffect, useMemo, useState } from "react";

interface DifferentiatorProps {
  icon: LucideIcon;
  title: string;
  description: string;
  comingSoon?: boolean;
  accent?: "evergreen" | "gold" | "coral";
}

const differentiators: DifferentiatorProps[] = [
  {
    icon: Shield,
    title: "Proof-led cleanup",
    description:
      "Arrival text, gate secured, full-yard sweep, and a latched-gate photo before we leave. It’s the consistent, accountable scoop service you can trust.",
    accent: "evergreen",
  },
  {
    icon: HeartPulse,
    title: "Pet wellness insights",
    description:
      "You get a recap link with color, consistency, and content notes, plus a free wellness app for daily check ins between visits.",
    accent: "gold",
  },
  {
    icon: Truck,
    title: "Add-ons that fit your routine",
    description:
      "Deodorizing, haul-away, and compost routing (where available). Choose what you want—keep it simple, or go greener.",
    accent: "coral",
  },
];

const proofPoints = [
  { value: "Gate photo", label: "proof after each visit" },
  { value: "Wellness recap", label: "stool health notes in a simple link" },
  { value: "Eco add-ons", label: "haul-away + compost routing when available" },
];

function DifferentiatorCard({
  icon: Icon,
  title,
  description,
  comingSoon,
  accent = "evergreen",
}: DifferentiatorProps) {
  const accentPalettes = {
    evergreen: {
      base: brandColors.evergreen,
    },
    gold: {
      base: brandColors.gold,
    },
    coral: {
      base: brandColors.coral,
    },
  } as const;

  const palette = accentPalettes[accent as keyof typeof accentPalettes] ?? accentPalettes.evergreen;

  return (
    <div className="group relative h-full">
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-[32px] border bg-[rgba(12,24,18,0.82)] p-8 shadow-[0_45px_85px_rgba(3,7,6,0.65)] transition-transform duration-300 group-hover:-translate-y-2"
        style={{
          borderColor: withAlpha(palette.base, 0.4),
          boxShadow: `0 45px 90px ${withAlpha(palette.base, 0.32)}`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${withAlpha(palette.base, 0.38)} 0%, rgba(6,14,10,0.25) 45%, rgba(5,12,9,0.6) 100%)`,
          }}
        />
        <div className="absolute inset-px rounded-[30px] bg-gradient-to-br from-white/15 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {comingSoon && (
          <div
            className="relative mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]"
            style={{
              borderColor: withAlpha(brandColors.gold, 0.65),
              backgroundColor: withAlpha(brandColors.gold, 0.16),
            }}
          >
            <Sparkles className="size-4 text-brand-gold" />
            Coming 2026
          </div>
        )}

        <div className="relative flex flex-1 flex-col gap-6">
          <div className="flex items-start gap-4">
            <div
              className="rounded-2xl p-4 text-white shadow-[0_25px_45px_rgba(4,12,9,0.6)]"
              style={{ backgroundColor: withAlpha(palette.base, 0.4) }}
            >
              <Icon className="size-8" />
            </div>
            <div>
            <h3 className="text-2xl font-serif font-semibold text-white drop-shadow-[0_12px_28px_rgba(4,10,8,0.55)]">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/85">{description}</p>
            </div>
          </div>

          <div className="mt-auto inline-flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/75">
            <span>Clean</span>
            <span className="text-white/40">•</span>
            <span>Proof</span>
            <span className="text-white/40">•</span>
            <span>Wellness</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Differentiators() {
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
            desktop: "/hero_backgrounds/bordercollie_coral_right_dark.jpeg",
            mobile: "/hero_backgrounds/bordercollie_coral_right_dark.jpeg",
          }
        : {
            desktop: "/hero_backgrounds/bordercollie_coral_right_light.jpeg",
            mobile: "/hero_backgrounds/bordercollie_coral_right_light.jpeg",
          };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(160deg, rgba(8,16,12,0.5) 0%, rgba(8,18,12,0.42) 45%, rgba(7,14,10,0.36) 100%)";
    }
    return "linear-gradient(160deg, rgba(8,16,12,0.1) 0%, rgba(8,18,12,0.09) 45%, rgba(10,18,12,0.08) 100%)";
  }, [theme]);

  // Dark fallback ensures white text is always readable if image fails to load
  const fallbackBackground = "linear-gradient(135deg, #1a2820 0%, #0d1a14 50%, #0a100c 100%)";

  return (
    <section
      className="landing-section section-modern relative overflow-hidden"
      style={{ background: fallbackBackground }}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-0 -top-12 h-16 z-[1]"
        initial={{ opacity: 0, y: -32 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-10%" }}
      >
        <div className="h-full w-full bg-gradient-to-b from-[rgba(var(--vanilla-rgb-commas),0.9)] via-[rgba(var(--vanilla-rgb-commas),0.7)] to-transparent" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 -bottom-12 z-[1] h-16"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        viewport={{ once: true, margin: "-15%" }}
      >
        <div className="h-full w-full bg-gradient-to-t from-[rgba(var(--mint-rgb-commas),0.32)] via-[rgba(var(--vanilla-rgb-commas),0.48)] to-transparent" />
      </motion.div>

      <div className="absolute inset-0 z-0">
        <Image
          src={backgroundSrc}
          alt="Dog owners enjoying a clean outdoor space"
          fill
          priority
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "40% center" }}
          unoptimized
        />
        <motion.div
          className="absolute inset-0"
          style={{ background: overlayStyle }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        />
      </div>

      <div className="container relative py-20 text-white">
        <Reveal>
          <div className="mx-auto mb-16 mt-6 max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
              <Sparkles className="size-4 text-brand-gold" /> Scoop service • Wellness insights • Add-ons
            </div>
            <h2 className="mt-6 text-5xl md:text-6xl font-serif leading-[1.05]">
              The scoop service that sends a recap.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/90 text-balance">
              Reliable poop pickup is the core. The difference is what you get after: a recap link with gate proof and pet wellness insights—plus upgrades like deodorizing, haul-away, and compost routing where available.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3">
          {differentiators.map((diff, index) => (
            <Reveal key={diff.title} delay={index * 0.1}>
              <DifferentiatorCard {...diff} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {proofPoints.map((point) => (
              <div key={point.label} className="rounded-[28px] border border-white/15 bg-white/5 p-6 text-center shadow-[0_25px_50px_rgba(3,7,6,0.55)]">
                <div className="text-4xl font-black text-white">{point.value}</div>
                <p className="mt-2 text-sm text-white/70">{point.label}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.45}>
          <div className="mt-16 text-center">
            <div className="mx-auto max-w-4xl rounded-3xl border border-white/25 bg-gradient-to-br from-[rgba(143,244,195,0.12)] via-[rgba(12,24,18,0.9)] to-[rgba(255,194,77,0.08)] p-10 shadow-[0_36px_78px_rgba(4,10,8,0.65)]">
              <div className="mb-4 flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
                <div className="h-2 w-2 rounded-full bg-brand-mint animate-pulse" />
                Gate photo • Clean sweep • Wellness insights
              </div>
              <p className="text-2xl md:text-3xl font-semibold leading-tight text-white text-balance">
                Get a cleaner yard—and clearer peace of mind.
              </p>
              <p className="mt-4 text-base text-white/85">
                Get a quote in under a minute. Add deodorizing, haul-away, or compost routing where available.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/wellness"
                  className="rounded-full border border-white/25 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85 hover:bg-white/20"
                >
                  Download the wellness app
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
