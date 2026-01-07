"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "@/lib/framermotion";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  ScanLine,
  Brain,
  TrendingUp,
  Bell,
  FileText,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import Reveal from "./Reveal";
import { brandColors, withAlpha } from "@/shared/brand";
import { useTheme } from "./theme/ThemeProvider";

const MotionDiv = motion.div;

const steps = [
  {
    icon: Search,
    number: "1",
    title: "Arrival text + gate secured",
    description:
      "You get an on-the-way text. We secure the gate and start a consistent sweep so everything stays predictable (and safe).",
    color: "mint",
  },
  {
    icon: ScanLine,
    number: "2",
    title: "Sweep + capture wellness notes",
    description:
      "We clean each zone and capture stool health notes (color, consistency, content) using our patent-pending capture device - no guesswork, no manual logging.",
    color: "gold",
  },
  {
    icon: Brain,
    number: "3",
    title: "Recap link delivered",
    description:
      "After we wrap, you get a simple recap link with gate photo proof and your stool health notes—easy to skim, easy to save.",
    color: "coral",
  },
  {
    icon: Bell,
    number: "4",
    title: "If something looks off",
    description:
      "If we notice something unusual in the yard or in the health notes, we flag it in your recap so you can decide what to do next.",
    color: "mint",
  },
  {
    icon: FileText,
    number: "5",
    title: "Upgrades when you want them",
    description:
      "Add deodorizing, haul-away, or compost routing (where available). Keep it simple, or tailor the visit to your routine.",
    color: "gold",
  },
  {
    icon: CheckCircle2,
    number: "6",
    title: "Dashboard (coming 2026)",
    description:
      "Recap links work today. The wellness dashboard and trends view are coming in 2026.",
    color: "coral",
  },
];

export default function HowItWorks() {
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
        ? { desktop: "/hero_backgrounds/husky_snow_right_dark.jpeg", mobile: "/hero_backgrounds/husky_snow_right_dark.jpeg" }
        : { desktop: "/hero_backgrounds/husky_snow_right_light.jpeg", mobile: "/hero_backgrounds/husky_snow_right_light.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlay = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(155deg, rgba(8,16,12,0.5) 0%, rgba(10,20,15,0.42) 50%, rgba(12,24,18,0.34) 100%)";
    }
    return "linear-gradient(155deg, rgba(7,11,8,0.1) 0%, rgba(10,16,12,0.09) 50%, rgba(12,18,14,0.08) 100%)";
  }, [theme]);

  const backgroundColor = theme === "dark" ? "#0a100c" : "#f8f5ee";

  return (
    <section
      id="how-it-works"
      className="landing-section section-modern relative overflow-hidden"
      style={{ backgroundColor }}
    >
      <MotionDiv
        className="pointer-events-none absolute inset-x-0 -top-12 h-16 z-[1]"
        initial={{ opacity: 0, y: -32 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-10%" }}
      >
        <div className="w-full h-full bg-gradient-to-b from-[rgba(var(--vanilla-rgb-commas),0.9)] via-[rgba(var(--gold-rgb-commas),0.3)] to-transparent" />
      </MotionDiv>
      <MotionDiv
        className="pointer-events-none absolute inset-x-0 -bottom-12 h-16 z-[1]"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        viewport={{ once: true, margin: "-12%" }}
      >
        <div className="w-full h-full bg-gradient-to-t from-[rgba(var(--vanilla-rgb-commas),0.85)] via-[rgba(var(--mint-rgb-commas),0.25)] to-transparent" />
      </MotionDiv>

      <div className="absolute inset-0 z-0">
        <Image
          src={backgroundSrc}
          alt="How it works background"
          fill
          priority
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "60% center" }}
        />
        <MotionDiv
          className="absolute inset-0"
          style={{ background: overlay }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>

      <div className="container relative z-10 py-20">
        <Reveal>
          <div className="text-center max-w-4xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
              <Sparkles className="size-4 text-brand-gold" />
              Field ritual + AI
            </div>
            <h2 className="mt-6 text-5xl font-serif leading-tight text-white md:text-6xl">
              Exactly what happens every time we visit.
            </h2>
            <p className="mt-4 text-lg text-white/85">
              A six-step choreography keeps yards spotless, logs health data, and surfaces hazards before they become a problem.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const colorMap = {
              mint: {
                bg: "rgba(143,244,195,0.15)",
                border: "rgba(143,244,195,0.35)",
                iconBg: "rgba(143,244,195,0.3)",
                iconColor: "#0a100c",
                accent: brandColors.mint,
              },
              gold: {
                bg: "rgba(255,194,77,0.12)",
                border: "rgba(255,194,77,0.32)",
                iconBg: "rgba(255,194,77,0.35)",
                iconColor: "#0a100c",
                accent: brandColors.gold,
              },
              coral: {
                bg: "rgba(243,100,91,0.12)",
                border: "rgba(243,100,91,0.3)",
                iconBg: "rgba(243,100,91,0.35)",
                iconColor: "white",
                accent: brandColors.coralInk,
              },
            };

            const colors = colorMap[step.color as keyof typeof colorMap];

            return (
              <Reveal key={step.number} delay={index * 0.1}>
                <MotionDiv
                  whileHover={{ scale: 1.03, y: -6 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="relative rounded-3xl p-8 border-2 text-white shadow-[0_34px_72px_rgba(3,7,6,0.6)] h-full"
                  style={{
                    background: `linear-gradient(135deg, ${colors.bg} 0%, rgba(8,18,14,0.88) 100%)`,
                    borderColor: colors.border,
                  }}
                >
                  {step.number === "2" && (
                    <div className="absolute top-6 right-6 z-20 h-40 w-40 cursor-zoom-in select-none hover:z-30">
                      <div className="group relative h-full w-full origin-top-right transition-transform duration-300 ease-out hover:scale-[1.9]">
                        <div className="absolute inset-0 rounded-full border border-white/15 bg-white/10 backdrop-blur-sm shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition-shadow duration-300 group-hover:shadow-[0_26px_70px_rgba(0,0,0,0.55)]" />
                        <Image
                          src="/hero_backgrounds/device_new_transparent.png"
                          alt=""
                          fill
                          className="object-contain p-3 drop-shadow-[0_18px_42px_rgba(0,0,0,0.55)]"
                          sizes="160px"
                        />
                        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/90 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                          Patent-pending device
                        </div>
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
                          Tech-enabled scooper
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`relative z-10 ${step.number === "2" ? "pr-24" : ""}`}>
                    <div className="flex items-start gap-4 mb-6">
                      <div
                        className="p-3 rounded-2xl shadow-[0_20px_40px_rgba(3,7,6,0.5)] flex-shrink-0"
                        style={{
                          backgroundColor: colors.iconBg,
                          color: colors.iconColor,
                        }}
                      >
                        <Icon className="size-7" />
                      </div>
                      <div
                        className="text-5xl font-black drop-shadow-[0_18px_32px_rgba(0,0,0,0.6)]"
                        style={{ color: withAlpha(colors.accent, 0.95) }}
                      >
                        {step.number}
                      </div>
                    </div>

                    <h3 className="text-2xl font-serif font-semibold mb-4 drop-shadow-[0_16px_32px_rgba(3,7,6,0.5)]">
                      {step.title}
                    </h3>

                    <p className="text-white/85 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </MotionDiv>
              </Reveal>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <Reveal delay={0.6}>
          <div className="text-center mt-20">
            <div className="bg-gradient-to-br from-[rgba(143,244,195,0.12)] via-[rgba(12,24,18,0.85)] to-[rgba(255,194,77,0.08)] border-2 border-white/25 rounded-3xl p-10 shadow-[0_36px_72px_rgba(4,10,8,0.6)] max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-mint animate-pulse"></div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                  Digital Health Log Included
                </span>
              </div>
              <h3 className="text-3xl md:text-4xl text-white font-serif font-semibold max-w-3xl mx-auto leading-tight mb-6 drop-shadow-[0_16px_36px_rgba(2,6,4,0.65)]">
                Get your quote. We’ll handle the rest.
              </h3>
              <p className="text-lg text-white/90 max-w-2xl mx-auto leading-relaxed mb-8">
                A clean yard plus pet wellness insights in a simple recap link. Dashboard + trends view coming in 2026.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/quote"
                  className="btn-cta-primary inline-flex w-full items-center justify-center whitespace-nowrap text-lg px-8 py-4 sm:w-auto"
                >
                  Get my quote
                </Link>
                <div className="text-sm text-white/70 text-center">
                  First week free for daily & twice-weekly • Initial clean included for weekly + bi-weekly • No contracts
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
