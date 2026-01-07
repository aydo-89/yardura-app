"use client";

import { motion } from "@/lib/framermotion";
import Image from "next/image";
import Link from "next/link";

const MotionDiv = motion.div;
import {
  Activity,
  Droplet,
  Bone,
  Bug,
  Stethoscope,
  Eye,
  Heart,
  Shield,
  TrendingUp,
  Target,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import AppStoreButtons from "@/components/wellness/AppStoreButtons";
import { brandColors, withAlpha } from "@/shared/brand";
import { useTheme } from "./theme/ThemeProvider";
import { useEffect, useMemo, useState } from "react";

type WhyItMattersProps = {
  onGetQuoteClick?: () => void;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const cardHoverVariants = {
  hover: {
    y: -2,
  },
};

export default function WhyItMatters({
  onGetQuoteClick,
}: WhyItMattersProps) {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const background = useMemo(() => {
    const mode = theme === "dark" ? "dark" : "light";
    const base =
      mode === "dark"
        ? {
            desktop: "/hero_backgrounds/droopy_teal_middle_dark.jpeg",
            mobile: "/hero_backgrounds/droopy_teal_middle_dark.jpeg",
          }
        : {
            desktop: "/hero_backgrounds/droopy_teal_middle_light.jpeg",
            mobile: "/hero_backgrounds/droopy_teal_middle_light.jpeg",
          };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlay = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(150deg, rgba(8,16,12,0.5) 0%, rgba(8,20,14,0.42) 50%, rgba(10,24,16,0.34) 100%)";
    }
    return "linear-gradient(150deg, rgba(7,11,8,0.12) 0%, rgba(8,16,12,0.1) 50%, rgba(10,20,14,0.09) 100%)";
  }, [theme]);

  const handleGetQuote = () => {
    if (onGetQuoteClick) {
      onGetQuoteClick();
    } else {
      window.location.href = "/quote?businessId=yardura";
    }
  };

  return (
    <section
      id="why-matters"
      aria-labelledby="why-matters-heading"
      className="landing-section section-modern relative overflow-hidden"
      style={{ backgroundColor: theme === "dark" ? "#0a100c" : "#f8f5ee" }}
    >
      <MotionDiv
        className="pointer-events-none absolute inset-x-0 -top-12 h-16 z-[1]"
        initial={{ opacity: 0, y: -28 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-10%" }}
      >
        <div className="w-full h-full bg-gradient-to-b from-[rgba(var(--vanilla-rgb-commas),0.85)] via-[rgba(var(--mint-rgb-commas),0.22)] to-transparent" />
      </MotionDiv>
      <MotionDiv
        className="pointer-events-none absolute inset-x-0 -bottom-12 h-16 z-[1]"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        viewport={{ once: true, margin: "-12%" }}
      >
        <div className="w-full h-full bg-gradient-to-t from-[rgba(var(--vanilla-rgb-commas),0.85)] via-[rgba(var(--gold-rgb-commas),0.3)] to-transparent" />
      </MotionDiv>

      <div className="absolute inset-0 z-0">
        <Image
          src={background}
          alt="Happy dog enjoying outdoor wellness activities"
          fill
          priority
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "50% center" }}
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
        {/* Modern Section Header */}
        <MotionDiv
          variants={itemVariants}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-16 text-center text-white"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em]">
            <Shield className="size-4 text-brand-mint" />
            Why it matters
          </div>
          <h1 className="mt-6 text-5xl font-serif leading-tight md:text-6xl">
            Clean yards. Wellness insights. Peace of mind.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white/85 md:text-xl">
            Stool changes are often the first clue something is shifting. Since we're already there cleaning, we capture simple notes on color, consistency, and content so you can spot patterns early and act sooner, without inspecting anything.
          </p>

        <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-5 shadow-[0_22px_44px_rgba(3,7,6,0.5)]">
            <p className="text-4xl font-black">0 min</p>
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">of effort from you</p>
            <p className="mt-2 text-sm text-white/70">
              We handle the cleanup and leave the yard guest-ready—without adding another chore to your week.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-5 shadow-[0_22px_44px_rgba(3,7,6,0.5)]">
            <p className="text-4xl font-black">✓</p>
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">wellness notes per visit</p>
            <p className="mt-2 text-sm text-white/70">
              Color, consistency, content—kept simple, consistent, and easy to skim so early shifts stand out.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-5 shadow-[0_22px_44px_rgba(3,7,6,0.5)]">
            <p className="text-4xl font-black">Gate photo</p>
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">proof you can trust</p>
            <p className="mt-2 text-sm text-white/70">
              We secure the gate and send photo proof so you know the visit happened—no wondering.
            </p>
          </div>
        </div>
        </MotionDiv>

        <MotionDiv
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          {/* Left Column - Content */}
          <div className="space-y-8">
            <MotionDiv
              variants={itemVariants}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h2
                id="why-matters-heading"
                className="text-[clamp(2.75rem,5vw,4.5rem)] font-serif font-semibold text-white leading-[1.05] text-balance drop-shadow-[0_22px_48px_rgba(3,8,6,0.6)]"
              >
                Why this matters (beyond a clean yard).
              </h2>

              <div className="mt-8 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-coral bg-brand-coral/20">
                    <AlertTriangle className="size-4 text-brand-coral" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-serif font-semibold text-white">Early changes are easy to miss.</h3>
                    <p className="text-white/80 leading-relaxed">
                      Small shifts in stool, appetite, or energy can be the first clue. We capture simple notes every visit so patterns show up sooner - without you inspecting anything.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-coral bg-brand-coral/20">
                    <AlertTriangle className="size-4 text-brand-coral" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-serif font-semibold text-white">It's gross. Every single time.</h3>
                    <p className="text-white/80 leading-relaxed">
                      Most people don't want to "inspect." That's the point—cleanup is handled, and the health notes arrive in a recap link.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-coral bg-brand-coral/20">
                    <AlertTriangle className="size-4 text-brand-coral" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-serif font-semibold text-white">DIY burnout is real.</h3>
                    <p className="text-white/80 leading-relaxed">
                      Consistency is what makes both the yard and the insights work. We keep the routine steady—even when life isn’t.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-coral bg-brand-coral/20">
                    <AlertTriangle className="size-4 text-brand-coral" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-serif font-semibold text-white">It steals your time.</h3>
                    <p className="text-white/80 leading-relaxed">
                      20 minutes per cleanup equals <strong className="text-brand-gold">20+ hours every year</strong>. We’d rather give those hours back so you’re playing fetch, not filling bags.
                    </p>
                  </div>
                </div>
              </div>

              {/* Enhanced Value Proposition - Made it stand out */}
              <MotionDiv
                variants={itemVariants}
                className="mt-10 rounded-3xl border-2 border-brand-mint/40 bg-gradient-to-br from-[rgba(143,244,195,0.15)] via-[rgba(12,24,18,0.9)] to-[rgba(143,244,195,0.08)] p-8 text-white shadow-[0_36px_72px_rgba(3,7,6,0.6)]"
              >
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-2xl flex-shrink-0 shadow-[0_22px_44px_rgba(3,7,6,0.45)] bg-[rgba(143,244,195,0.35)] text-[#0a100c]">
                      <Heart className="size-6" />
                    </div>
                    <h3 className="text-2xl font-serif font-semibold drop-shadow-[0_18px_36px_rgba(3,7,6,0.55)]">
                      The recap you’ll actually read
                    </h3>
                  </div>
                  <p className="text-white/90 text-lg leading-relaxed">
                    A quick link with gate photo proof and simple stool health notes. If you want deeper trends, the wellness dashboard is coming in 2026.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold">
                    <div className="h-2 w-2 rounded-full bg-brand-mint animate-pulse" />
                    Recap link now • Dashboard + trends view (2026)
                  </div>
                </div>
              </MotionDiv>
            </MotionDiv>
          </div>

          {/* Right Column - Insight Preview Card */}
          <MotionDiv
            variants={itemVariants}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <MotionDiv
              variants={cardHoverVariants}
              whileHover="hover"
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="rounded-3xl border border-white/15 bg-[rgba(8,18,14,0.85)] p-8 text-white shadow-[0_40px_80px_rgba(2,6,5,0.55)]"
            >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-brand-mint" />
                    <span className="text-sm font-medium text-white/85">
                      Recap preview · What you’ll get
                    </span>
                  </div>
                  <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
                    Dashboard (2026)
                  </div>
                </div>

              {/* Weekly Timeline Chart (like wellness tab) */}
              <div className="mb-4 h-24 relative">
                <svg
                  viewBox="0 0 300 80"
                  className="w-full h-full"
                  aria-labelledby="timeline-desc"
                >
                  <defs>
                    <linearGradient
                      id="timelineGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#F3645B" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#FFC24D" stopOpacity="0.12" />
                    </linearGradient>
                  </defs>

                  {/* Weekly data points - Realistic numbers: ~14 per dog (2/day) */}
                  {[
                    { week: "Aug 4", deposits: 14, status: "normal" },
                    { week: "Aug 11", deposits: 13, status: "monitor" },
                    { week: "Aug 18", deposits: 15, status: "normal" },
                    { week: "Aug 25", deposits: 12, status: "attention" },
                    { week: "Sep 1", deposits: 16, status: "normal" },
                    { week: "Sep 8", deposits: 14, status: "normal" },
                  ].map((point, index) => {
                    const x = 40 + index * 45;
                    const maxDeposits = 16; // Realistic for 1 dog: ~14-16 per week
                    const y = 60 - (point.deposits / maxDeposits) * 40;

                    let color: string = withAlpha(brandColors.mint, 0.9); // normal
                    if (point.status === "monitor") color = brandColors.gold;
                    if (point.status === "attention") color = "#EF4444";

                    return (
                      <g key={index}>
                        {/* Line to next point */}
                        {index < 5 && (
                          <line
                            x1={x}
                            y1={y}
                            x2={40 + (index + 1) * 45}
                            y2={
                              60 -
                              ([
                                { deposits: 14 },
                                { deposits: 13 },
                                { deposits: 15 },
                                { deposits: 12 },
                                { deposits: 16 },
                                { deposits: 14 },
                              ][index + 1].deposits /
                                maxDeposits) *
                                40
                            }
                            stroke={
                              point.status === "attention"
                                ? "#EF4444"
                                : point.status === "monitor"
                                  ? brandColors.gold
                                  : brandColors.mint
                            }
                            strokeWidth="2"
                            opacity="0.6"
                          />
                        )}

                        {/* Data point */}
                        <circle
                          cx={x}
                          cy={y}
                          r="4"
                          fill={color}
                          className="drop-shadow-sm"
                        >
                          <title>Weekly deposits data point</title>
                        </circle>

                        {/* Week label */}
                        <text
                          x={x}
                          y="75"
                          textAnchor="middle"
                          className="fill-slate-500"
                          fontSize="9"
                        >
                          {point.week}
                        </text>
                      </g>
                    );
                  })}

                  {/* Y-axis labels */}
                  <text
                    x="10"
                    y="20"
                    textAnchor="middle"
                    className="fill-slate-400"
                    fontSize="9"
                  >
                    16
                  </text>
                  <text
                    x="10"
                    y="35"
                    textAnchor="middle"
                    className="fill-slate-400"
                    fontSize="9"
                  >
                    8
                  </text>
                  <text
                    x="10"
                    y="50"
                    textAnchor="middle"
                    className="fill-slate-400"
                    fontSize="9"
                  >
                    0
                  </text>
                </svg>
              </div>

              {/* Bristol Scale & Consistency (like wellness tab) */}
              <div className="mt-4 space-y-3">
                <div className="text-xs text-white/70 mb-2">
                  Consistency Analysis
                </div>

                {/* Bristol Scale Visual */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Hard</span>
                    <span>Normal</span>
                    <span>Soft</span>
                  </div>
                  <div className="relative h-3 rounded-full overflow-hidden bg-white/10 border border-white/20">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{ width: "33.33%", backgroundColor: "rgba(196, 61, 55, 0.75)" }}
                    />
                    <div
                      className="absolute inset-y-0"
                      style={{
                        left: "33.33%",
                        width: "33.34%",
                        backgroundColor: withAlpha(brandColors.mint, 0.9),
                      }}
                    />
                    <div
                      className="absolute inset-y-0"
                      style={{
                        right: 0,
                        width: "33.33%",
                        backgroundColor: "rgba(255, 194, 77, 0.85)",
                      }}
                    />
                    <div className="absolute inset-y-0 left-1/3 w-px bg-white/80"></div>
                    <div className="absolute inset-y-0 left-2/3 w-px bg-white/70"></div>
                    <div className="absolute inset-y-0 left-1/2 w-1 bg-white/90 shadow" />
                  </div>
                  <div className="text-center text-xs text-white/70">
                    Mostly Normal
                  </div>
                </div>

                {/* Consistency Distribution */}
                <div className="grid grid-cols-3 gap-2">
                  <div
                    className="text-center p-2 rounded bg-white/10 border border-white/20"
                  >
                    <div className="text-lg font-bold" style={{ color: brandColors.mint }}>
                      70%
                    </div>
                    <div className="text-xs text-white/80">
                      Normal
                    </div>
                  </div>
                  <div
                    className="text-center p-2 rounded bg-white/10 border border-white/20"
                  >
                    <div className="text-lg font-bold" style={{ color: brandColors.gold }}>
                      20%
                    </div>
                    <div className="text-xs text-white/80">
                      Soft
                    </div>
                  </div>
                  <div
                    className="text-center p-2 rounded bg-white/10 border border-white/20"
                  >
                    <div className="text-lg font-bold" style={{ color: brandColors.coralInk }}>
                      10%
                    </div>
                    <div className="text-xs text-white/80">
                      Dry
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/18 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">
                  Field note
                </p>
                <p className="mt-2 text-sm text-white/75 leading-relaxed">
                  "Soft stools noted (09·08). Logged in your recap so you can keep an eye on it."
                </p>
              </div>
            </MotionDiv>

            {/* Callout Box - Moved from left column */}
            <MotionDiv
              variants={itemVariants}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="p-6 rounded-2xl bg-[rgba(8,18,14,0.7)] border border-white/18 shadow-[0_24px_52px_rgba(3,7,6,0.5)] mt-6"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/12 border border-white/25 rounded-lg flex-shrink-0 mt-1 text-[#9CF8D5]">
                  <Eye className="size-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-white font-medium">
                    The Hidden Health Signals
                  </p>
                  <p className="text-sm text-white/90 leading-relaxed drop-shadow-[0_12px_28px_rgba(3,7,6,0.45)]">
                    Most pet owners don’t inspect. We capture the small changes you might miss—like blood streaks, parasite cues, mucus, sudden diarrhea swings, unusual frequency changes, or foreign objects—so you get context without the hassle.
                  </p>
                </div>
              </div>
            </MotionDiv>
          </MotionDiv>
        </MotionDiv>

        {/* Three Pillars - Enhanced */}
        <MotionDiv
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="mt-20"
        >
          <MotionDiv
            variants={itemVariants}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-serif font-semibold text-white mb-4 tracking-tight drop-shadow-[0_16px_36px_rgba(3,7,6,0.6)]">
              What You Get With Every Visit
            </h2>
            <p className="text-xl text-white/85 max-w-3xl mx-auto leading-relaxed">
              A cleaner yard plus a simple record you can trust.
            </p>
          </MotionDiv>

          <div className="grid md:grid-cols-3 gap-8">
            <MotionDiv
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="rounded-3xl p-8 border-2 border-brand-mint/30 bg-gradient-to-br from-[rgba(143,244,195,0.1)] via-[rgba(8,18,14,0.85)] to-[rgba(143,244,195,0.05)] text-white shadow-[0_34px_72px_rgba(3,7,6,0.6)]"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl shadow-[0_20px_40px_rgba(3,7,6,0.5)] bg-[rgba(143,244,195,0.3)] text-[#0a100c]">
                  <Target className="size-7" />
                </div>
                <h3 className="text-2xl font-serif font-semibold drop-shadow-[0_16px_32px_rgba(3,7,6,0.5)]">
                  Notice changes sooner
                </h3>
              </div>

              <p className="text-white/90 font-medium text-lg mb-6 leading-relaxed">
                The value of stool health notes is simple: you can spot when "normal" shifts—without playing detective.
              </p>

              <div className="space-y-3 text-white/80">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#9CF8D5]"></div>
                  <span className="text-sm">
                    <strong className="text-white">Color</strong> shifts are easier to notice over time
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#FFC24D]"></div>
                  <span className="text-sm">
                    <strong className="text-white">Consistency</strong> changes are captured consistently
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#F3645B]"></div>
                  <span className="text-sm">
                    <strong className="text-white">Content</strong> notes help you keep context when you need it
                  </span>
                </div>
              </div>
            </MotionDiv>

            <MotionDiv
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="rounded-3xl p-8 border-2 border-brand-gold/30 bg-gradient-to-br from-[rgba(255,194,77,0.1)] via-[rgba(8,18,14,0.85)] to-[rgba(255,194,77,0.05)] text-white shadow-[0_34px_72px_rgba(3,7,6,0.6)]"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl shadow-[0_20px_40px_rgba(3,7,6,0.5)] bg-[rgba(255,194,77,0.35)] text-[#0a100c]">
                  <Stethoscope className="size-7" />
                </div>
                <h3 className="text-2xl font-serif font-semibold drop-shadow-[0_16px_32px_rgba(3,7,6,0.5)]">
                  Bring better context
                </h3>
              </div>

              <p className="text-white/90 font-medium text-lg mb-6 leading-relaxed">
                If you ever need a vet conversation, having a simple history beats trying to remember “when it started.”
              </p>

              <div className="space-y-3 text-white/80">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#FFC24D]"></div>
                  <span className="text-sm">
                    A visit-by-visit record you can reference
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#9CF8D5]"></div>
                  <span className="text-sm">
                    Gate photo proof + recap link
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#F3645B]"></div>
                  <span className="text-sm">
                    Patterns are easier to spot when notes are consistent
                  </span>
                </div>
              </div>
            </MotionDiv>

            <MotionDiv
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="rounded-3xl p-8 border-2 border-brand-coral/30 bg-gradient-to-br from-[rgba(243,100,91,0.1)] via-[rgba(8,18,14,0.85)] to-[rgba(243,100,91,0.05)] text-white shadow-[0_34px_72px_rgba(3,7,6,0.6)]"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl shadow-[0_20px_40px_rgba(3,7,6,0.5)] bg-[rgba(243,100,91,0.35)] text-white">
                  <Heart className="size-7" />
                </div>
                <h3 className="text-2xl font-serif font-semibold drop-shadow-[0_16px_32px_rgba(3,7,6,0.5)]">
                  Peace of mind, built in
                </h3>
              </div>

              <p className="text-white/90 font-medium text-lg mb-6 leading-relaxed">
                Cleanup is handled. The recap is there when you want it. Upgrades are available when you need them.
              </p>

              <div className="space-y-3 text-white/80">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#9CF8D5]"></div>
                  <span className="text-sm">
                    No more bending, bagging, or carrying waste
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#FFC24D]"></div>
                  <span className="text-sm">
                    Simple recap link, not a noisy feed
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-[#F3645B]"></div>
                  <span className="text-sm">
                    Add deodorizing, haul-away, or compost routing where available
                  </span>
                </div>
              </div>
            </MotionDiv>
          </div>
        </MotionDiv>

        {/* CTA - Matching Other Sections */}
        <MotionDiv variants={itemVariants} className="text-center mt-16">
          <div className="rounded-3xl p-8 max-w-2xl mx-auto shadow-[0_36px_72px_rgba(3,7,6,0.55)] border border-white/20 bg-[rgba(8,18,14,0.75)] text-white">
            <h3 className="text-2xl font-serif font-semibold mb-4 drop-shadow-[0_16px_36px_rgba(3,7,6,0.55)]">
              Ready to get your quote?
            </h3>
            <p className="text-white/80 mb-8 text-lg leading-relaxed">
              Get a cleaner yard and wellness insights in a simple recap link.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <button onClick={handleGetQuote} className="btn-cta-primary">
                Get my quote
              </button>
              <Link
                href="/wellness"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white/90 hover:bg-white/20"
              >
                Download free app
              </Link>
            </div>
            <div className="mt-6">
              <AppStoreButtons compact className="justify-center" />
            </div>
          </div>
        </MotionDiv>
      </div>
    </section>
  );
}
