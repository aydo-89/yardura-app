"use client";

import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "@/lib/framermotion";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Brain,
  TrendingUp,
  Activity,
  Droplet,
  Heart,
  Shield,
  Eye,
  CheckCircle,
  Target,
} from "lucide-react";
import { useInViewCountUp } from "@/hooks/useInViewCountUp";
import { useState, useEffect, useMemo } from "react";
import Reveal from "@/components/Reveal";
import AppStoreButtons from "@/components/wellness/AppStoreButtons";
import { liftHover, spring } from "@/lib/motion/presets";
import { track } from "@/lib/analytics";
import { WellnessHeader } from "./dashboard/tabs/WellnessTab/components/WellnessHeader";
import { useWellnessData } from "./dashboard/tabs/WellnessTab/hooks/useWellnessData";
import type { DataReading, ServiceVisit } from "@/shared/wellness";
import { brandColors, withAlpha } from "@/shared/brand";
import { COLOR_HEX } from "@/shared/wellness";
import { useTheme } from "./theme/ThemeProvider";

interface InsightsProps {
  dataReadings?: DataReading[];
  serviceVisits?: ServiceVisit[];
}

export default function Insights({
  dataReadings = [],
  serviceVisits = [],
}: InsightsProps = {}) {
  const [activeMetric, setActiveMetric] = useState("color");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        ? { desktop: "/hero_backgrounds/pug_mint_left_dark.jpeg", mobile: "/hero_backgrounds/pug_mint_left_dark.jpeg" }
        : { desktop: "/hero_backgrounds/pug_mint_left_light.jpeg", mobile: "/hero_backgrounds/pug_mint_left_light.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(150deg, rgba(8,16,12,0.5) 0%, rgba(8,18,14,0.42) 45%, rgba(12,26,18,0.34) 100%)";
    }
    return "linear-gradient(150deg, rgba(8,16,12,0.1) 0%, rgba(8,18,14,0.09) 45%, rgba(12,22,16,0.08) 100%)";
  }, [theme]);

  // Dark fallback ensures white text is always readable if image fails to load
  const fallbackBackground = "linear-gradient(135deg, #1a2820 0%, #0d1a14 50%, #0a100c 100%)";

  // Get wellness data if available, otherwise use sample data for demo
  const sampleDataReadings: DataReading[] = [
    // Sample data for demonstration - use static timestamps to avoid hydration mismatch
    {
      id: "sample-1",
      timestamp: new Date("2024-08-15T10:00:00Z").toISOString(),
      colors: { normal: 15, yellow: 2, red: 0, black: 1, total: 18 },
      consistency: { normal: 12, soft: 4, dry: 2, total: 18 },
      issues: [],
      color: "brown",
      weight: 45,
    },
    {
      id: "sample-2",
      timestamp: new Date("2024-08-22T10:00:00Z").toISOString(),
      colors: { normal: 16, yellow: 1, red: 1, black: 0, total: 18 },
      consistency: { normal: 14, soft: 3, dry: 1, total: 18 },
      issues: ["Yellow stool detected"],
      color: "brown",
      weight: 42,
    },
    {
      id: "sample-3",
      timestamp: new Date("2024-08-29T10:00:00Z").toISOString(),
      colors: { normal: 13, yellow: 3, red: 1, black: 1, total: 18 },
      consistency: { normal: 13, soft: 4, dry: 1, total: 18 },
      issues: [],
      color: "brown",
      weight: 48,
    },
  ];

  const wellnessData = useWellnessData(
    dataReadings.length > 0 ? dataReadings : sampleDataReadings,
    serviceVisits.length > 0 ? serviceVisits : [],
  );

  const { ref: insightsRef, count: insightsCount } = useInViewCountUp({
    end: 24,
    duration: 2000,
  });
  const { ref: alertsRef, count: alertsCount } = useInViewCountUp({
    end: 3,
    duration: 2000,
  });
  const { ref: accuracyRef, count: accuracyCount } = useInViewCountUp({
    end: 95,
    duration: 2000,
  });

  const handleExport = () => {
    // Navigate to reports page
    window.location.href = "/reports";
  };

const healthyStoolColor = COLOR_HEX.normal;
const evergreenAccent = brandColors.mint;
const dehydrationAccent = brandColors.sunset;

const metricPalettes = {
  healthy: {
    base: healthyStoolColor,
    tint: withAlpha(healthyStoolColor, 0.16),
    highlight: withAlpha(healthyStoolColor, 0.32),
    border: withAlpha(healthyStoolColor, 0.44),
    iconTint: withAlpha(healthyStoolColor, 0.22),
  },
  mint: {
    base: brandColors.mint,
    tint: withAlpha(brandColors.mint, 0.16),
    highlight: withAlpha(brandColors.mint, 0.3),
    border: withAlpha(brandColors.mint, 0.5),
    iconTint: withAlpha(brandColors.mint, 0.24),
  },
  gold: {
    base: brandColors.gold,
    tint: withAlpha(brandColors.gold, 0.12),
    highlight: withAlpha(brandColors.gold, 0.24),
    border: withAlpha(brandColors.gold, 0.45),
    iconTint: withAlpha(brandColors.gold, 0.22),
  },
  coral: {
    base: brandColors.coral,
    tint: withAlpha(brandColors.coral, 0.12),
    highlight: withAlpha(brandColors.coral, 0.24),
    border: withAlpha(brandColors.coral, 0.45),
    iconTint: withAlpha(brandColors.coral, 0.2),
  },
} as const;

type MetricPaletteKey = keyof typeof metricPalettes;

const metrics = [
  {
    id: "color",
    label: "Color Analysis",
    icon: Droplet,
    color: "healthy" as MetricPaletteKey,
    status: "96% Normal",
    details: { normal: 96, yellow: 3, red: 1 },
  },
  {
    id: "consistency",
    label: "Consistency",
    icon: Activity,
    color: "healthy" as MetricPaletteKey,
    status: "Mostly Normal",
    details: { normal: 70, soft: 20, hard: 10 },
  },
  {
    id: "content",
    label: "Content Signals",
    icon: Target,
    color: "mint" as MetricPaletteKey,
    status: "No Issues",
    details: { mucous: 0, greasy: 0, parasites: 0 },
  },
  {
    id: "frequency",
    label: "Deposit Frequency",
    icon: TrendingUp,
    color: "mint" as MetricPaletteKey,
    status: "12-16 per week",
    details: { avg: 14, min: 12, max: 16 },
  },
];

const alerts = [
  {
    severity: "critical" as const,
    title: "Red color detected",
    message:
      "Red color noted. If it persists or you’re concerned, consider checking in with your vet.",
    time: "1 day ago",
  },
  {
    severity: "watch" as const,
    title: "Softer than usual",
    message:
      "Softer consistency noted compared to recent visits.",
    time: "2 days ago",
  },
  {
    severity: "watch" as const,
    title: "Color change detected",
    message:
      "Color shift noted this week—worth keeping an eye on.",
    time: "3 days ago",
  },
  {
    severity: "positive" as const,
    title: "Frequency normal",
    message:
      "Deposit frequency is within normal range for your yard based on dog count and size.",
    time: "5 days ago",
  },
  {
    severity: "info" as const,
    title: "Mild dehydration signs",
    message:
      "Stool consistency suggests mild dehydration. Ensure fresh water is always available.",
    time: "1 week ago",
  },
  {
    severity: "positive" as const,
    title: "Baseline established",
    message:
      "Great! We've analyzed 4 weeks of data and established your yard's normal patterns.",
    time: "1 week ago",
  },
];

const insightStats = [
  { value: "Stool check", label: "color • consistency • content" },
  { value: "Gate photo", label: "proof your visit happened" },
  { value: "Dashboard", label: "wellness trends (2026)" },
];

  return (
    <section
      id="insights"
      className="landing-section section-modern relative overflow-hidden"
      style={{ background: fallbackBackground }}
    >
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Pet wellness monitoring visuals"
          fill
          priority
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "45% center" }}
          unoptimized
        />
        <motion.div
          className="absolute inset-0"
          style={{ background: overlayStyle }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        />
      </div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 -top-12 h-16 z-[1]"
        initial={{ opacity: 0, y: -28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="w-full h-full bg-gradient-to-b from-[rgba(var(--vanilla-rgb-commas),0.9)] via-[rgba(var(--mint-rgb-commas),0.38)] to-transparent" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 -bottom-12 h-16 z-[1]"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <div className="w-full h-full bg-gradient-to-t from-[rgba(var(--vanilla-rgb-commas),0.82)] via-[rgba(var(--gold-rgb-commas),0.3)] to-transparent" />
      </motion.div>

      <div className="container relative z-10 py-20">
        {/* Modern Section Header */}
        <Reveal>
          <div className="text-center mb-16 text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
              <Brain className="size-4 text-brand-mint" />
              Pet wellness insights
            </div>
            <div className="relative">
              <h2 className="text-5xl md:text-6xl font-serif leading-tight">
                Wellness insights you'll actually use.
              </h2>
              <p className="mt-4 text-lg text-white/85 max-w-3xl mx-auto">
                A simple recap link with stool health notes and an export-ready summary for your vet—plus a dashboard and trends view coming in 2026.
              </p>
              <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
                {insightStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
                    <p className="text-3xl font-black text-white">{stat.value}</p>
                    <p className="mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-3xl border border-white/20 bg-white/10 p-6 text-white/85">
                <div className="flex flex-col items-center gap-4 text-center">
                  <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/75">
                    Free wellness app
                  </span>
                  <p className="max-w-2xl text-sm text-white/80">
                    Track symptoms between visits with daily check ins, stool capture,
                    and a guided AI chat built for pet owners.
                  </p>
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <Link
                      href="/wellness"
                      className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85 hover:bg-white/20"
                    >
                      Explore the app
                    </Link>
                    <AppStoreButtons compact className="items-center justify-center" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Toggle to collapse/expand full Insights */}
        <div className="text-center mb-6">
          <p className="mb-3 text-lg font-semibold text-white/85">
            👇 Preview the wellness dashboard experience (coming 2026)
          </p>
          <motion.button
            type="button"
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-[0_18px_40px_rgba(3,7,6,0.5)] border border-white/25 ${
              isOpen ? "bg-[#0D3A32] text-[#9CF8D5]" : "bg-transparent text-white"
            }`}
            aria-expanded={isOpen}
            onClick={() => {
              setIsOpen((v) => !v);
              track("insights_toggle", { open: !isOpen });
            }}
            animate={
              isOpen
                ? { scale: 1, boxShadow: "0 18px 40px rgba(3,7,6,0.5)" }
                : {
                    scale: [1, 1.03, 1],
                    boxShadow: [
                      "0 18px 40px rgba(3,7,6,0.45)",
                      "0 24px 48px rgba(3,7,6,0.55)",
                      "0 18px 40px rgba(3,7,6,0.45)",
                    ],
                  }
            }
            transition={
              isOpen
                ? { duration: 0.3 }
                : { duration: 1.6, repeat: Infinity, repeatType: "mirror" }
            }
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Eye className="size-5" />
            {isOpen ? "Hide preview" : "View preview"}
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="insights-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - How It Works & Example highlights */}
          <div className="lg:col-span-1 space-y-6">
            <Reveal delay={0.4}>
              <motion.div
                className="rounded-3xl p-8 border bg-[rgba(8,18,14,0.6)] text-white shadow-[0_36px_72px_rgba(3,7,6,0.55)]"
                whileHover={liftHover.hover}
                whileTap={liftHover.tap}
                transition={spring.snappy}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-2xl shadow-[0_20px_40px_rgba(3,7,6,0.5)] bg-[rgba(143,244,195,0.25)] text-[#9CF8D5]">
                    <Brain className="size-6" />
                  </div>
                  <h3 className="text-xl font-serif font-semibold drop-shadow-[0_16px_32px_rgba(3,7,6,0.5)]">
                    How It Works
                  </h3>
                </div>
                <div className="space-y-5 text-white/85">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl mt-0.5 bg-white/12 border border-white/20">
                      <CheckCircle className="size-5 text-[#9CF8D5]" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-base">
                        Field capture
                      </div>
                      <div className="text-sm leading-relaxed">
                        Stool health notes captured during pickup
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl mt-0.5 bg-white/12 border border-white/20">
                      <CheckCircle className="size-5 text-[#9CF8D5]" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-base">
                        Clear recaps
                      </div>
                      <div className="text-sm leading-relaxed">
                        Color • consistency • content, kept simple
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl mt-0.5 bg-white/12 border border-white/20">
                      <CheckCircle className="size-5 text-[#FFC24D]" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-base">
                        Low-noise highlights
                      </div>
                      <div className="text-sm leading-relaxed">
                        Marks when something looks different
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Reveal>

            {/* Example highlights */}
            <Reveal delay={0.5}>
              <motion.div
                className="rounded-3xl p-8 border bg-[rgba(8,18,14,0.6)] text-white shadow-[0_36px_72px_rgba(3,7,6,0.55)]"
                whileHover={liftHover.hover}
                whileTap={liftHover.tap}
                transition={spring.snappy}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-2xl shadow-[0_20px_40px_rgba(3,7,6,0.5)] bg-[rgba(255,194,77,0.24)] text-[#FFC24D]">
                    <AlertTriangle className="size-6" />
                  </div>
                  <h3 className="text-xl font-serif font-semibold drop-shadow-[0_16px_32px_rgba(3,7,6,0.5)]">
                    Example highlights
                  </h3>
                </div>
                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    (() => {
                      const severityThemes = {
                        critical: {
                          container: {
                            backgroundColor: withAlpha(brandColors.coral, 0.18),
                            border: withAlpha(brandColors.coralInk, 0.55),
                          },
                          dot: brandColors.coralInk,
                          title: brandColors.coralInk,
                        },
                        watch: {
                          container: {
                            backgroundColor: withAlpha(brandColors.gold, 0.2),
                            border: withAlpha(brandColors.gold, 0.5),
                          },
                          dot: brandColors.gold,
                          title: brandColors.gold,
                        },
                        info: {
                          container: {
                            backgroundColor: withAlpha(dehydrationAccent, 0.18),
                            border: withAlpha(dehydrationAccent, 0.5),
                          },
                          dot: dehydrationAccent,
                          title: dehydrationAccent,
                        },
                        positive: {
                          container: {
                            backgroundColor: withAlpha(evergreenAccent, 0.2),
                            border: withAlpha(evergreenAccent, 0.5),
                          },
                          dot: evergreenAccent,
                          title: evergreenAccent,
                        },
                      } as const;
                      const theme = severityThemes[alert.severity];
                      return (
                        <motion.div
                          key={index}
                          className="p-4 rounded-xl backdrop-blur-sm transition-all duration-200 hover:shadow-[0_18px_32px_rgba(3,7,6,0.4)] border-l-4 text-white/90"
                          style={{
                            backgroundColor: theme.container.backgroundColor,
                            borderColor: "transparent",
                            borderLeftColor: theme.container.border,
                          }}
                          whileHover={{ scale: 1.02, x: 2 }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="size-3 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: theme.dot }}
                            ></div>
                            <div className="flex-1">
                              <div
                                className="text-sm font-semibold"
                                style={{ color: theme.title }}
                              >
                                {alert.title}
                              </div>
                              <p className="text-sm text-white/80 leading-relaxed mt-1">
                                {alert.message}
                              </p>
                              <div className="text-xs text-white/70 mt-2 font-medium">
                                {alert.time}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()
                  ))}
                </div>
              </motion.div>
            </Reveal>
          </div>

          {/* Right Column - Interactive Dashboard */}
          <div className="lg:col-span-2">
            {/* Wellness Header - Show alerts and export functionality */}
            <Reveal delay={0.3}>
              <div className="mb-8">
                <WellnessHeader
                  wellnessData={wellnessData}
                  onExport={handleExport}
                />
              </div>
            </Reveal>

            <Reveal delay={0.4}>
              <motion.div
                className="rounded-3xl p-10 border bg-[rgba(8,18,14,0.82)] text-white shadow-[0_40px_80px_rgba(3,7,6,0.6)]"
                whileHover={liftHover.hover}
                whileTap={liftHover.tap}
                transition={spring.snappy}
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-serif font-semibold text-white mb-1 drop-shadow-[0_16px_32px_rgba(3,7,6,0.55)]">
                      Pet Wellness Dashboard
                    </h3>
                    <p className="text-white/75 text-sm">
                      Preview data • Example view
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl border bg-[rgba(25,180,163,0.22)] shadow-[0_20px_40px_rgba(3,7,6,0.45)]"
                    style={{
                      borderColor: withAlpha(brandColors.mint, 0.5),
                    }}
                  >
                    <span className="flex size-2 rounded-full bg-[rgba(var(--mint-rgb-commas),1)]" />
                    <span className="text-sm font-semibold" style={{ color: brandColors.mint }}>
                      Preview • Coming 2026
                    </span>
                  </div>
                </div>

                {/* Interactive Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                  {metrics.map((metric) => {
                    const Icon = metric.icon;
                    const theme = metricPalettes[metric.color] ?? metricPalettes.mint;
                    const isActive = activeMetric === metric.id;
                    return (
                      <motion.div
                        key={metric.id}
                        onClick={() => setActiveMetric(metric.id)}
                        className="p-6 rounded-2xl cursor-pointer transition-all duration-300 border backdrop-blur-sm text-white"
                        style={
                          isActive
                            ? {
                                background: `linear-gradient(135deg, ${withAlpha(theme.base, 0.75)}, ${withAlpha(theme.base, 0.45)})`,
                                borderColor: withAlpha(theme.base, 0.55),
                                boxShadow: "0 24px 48px rgba(6,14,10,0.45)",
                                transform: "scale(1.04)",
                              }
                            : {
                                background: `linear-gradient(135deg, ${theme.tint}, rgba(8,18,14,0.78))`,
                                borderColor: theme.border,
                                boxShadow: "0 16px 32px rgba(3,7,6,0.38)",
                              }
                        }
                        whileHover={{ scale: isActive ? 1.04 : 1.02, y: isActive ? -2 : -1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div
                            className="p-3 rounded-xl shadow-[0_18px_32px_rgba(3,7,6,0.45)]"
                            style={{
                              backgroundColor: theme.iconTint,
                              color: theme.base,
                            }}
                          >
                            <Icon className="size-5" />
                          </div>
                          <div className="flex-1">
                            <div className="text-base font-semibold text-white">
                              {metric.label}
                            </div>
                            <div
                              className="text-sm font-semibold"
                              style={{ color: withAlpha(theme.base, 0.85) }}
                            >
                              {metric.status}
                            </div>
                          </div>
                        </div>

                        {/* Metric-specific visualizations */}
                        {metric.id === "color" && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/70">Normal</span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: theme.base }}
                              >
                                {metric.details.normal}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/70">Alerts</span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: brandColors.gold }}
                              >
                                {(metric.details.yellow || 0) +
                                  (metric.details.red || 0)}
                                %
                              </span>
                            </div>
                          </div>
                        )}

                        {metric.id === "consistency" && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/70">Normal</span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: theme.base }}
                              >
                                {metric.details.normal}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/70">Soft</span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: brandColors.gold }}
                              >
                                {metric.details.soft}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/70">Dry</span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: dehydrationAccent }}
                              >
                                {metric.details.hard}%
                              </span>
                            </div>
                          </div>
                        )}

                        {metric.id === "content" && (
                          <div className="space-y-2">
                            {(() => {
                              const flagEntries = [
                                {
                                  label: "Mucous",
                                  value: metric.details.mucous ?? 0,
                                  style: {
                                    backgroundColor: withAlpha(evergreenAccent, 0.24),
                                    borderColor: withAlpha(evergreenAccent, 0.52),
                                    color: evergreenAccent,
                                  },
                                },
                                {
                                  label: "Greasy",
                                  value: metric.details.greasy ?? 0,
                                  style: {
                                    backgroundColor: withAlpha(brandColors.gold, 0.16),
                                    borderColor: withAlpha(brandColors.gold, 0.3),
                                    color: brandColors.gold,
                                  },
                                },
                                {
                                  label: "Parasites",
                                  value: metric.details.parasites ?? 0,
                                  style: {
                                    backgroundColor: withAlpha(dehydrationAccent, 0.18),
                                    borderColor: withAlpha(dehydrationAccent, 0.32),
                                    color: dehydrationAccent,
                                  },
                                },
                              ].filter((flag) => flag.value && flag.value > 0);

                              if (flagEntries.length === 0) {
                                return (
                                  <div className="text-center text-xs text-white/70">
                                    All clear this week
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap justify-center gap-2">
                                    {flagEntries.map((flag) => (
                                      <div
                                        key={flag.label}
                                        className="px-2 py-1 text-xs rounded-full border"
                                        style={flag.style}
                                      >
                                        {flag.label}: {flag.value}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-center text-xs text-white/70">
                                    We’ll keep watching these signals closely
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {metric.id === "frequency" && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/70">Average</span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: evergreenAccent }}
                              >
                                {metric.details.avg}/week
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/70">Range</span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: brandColors.gold }}
                              >
                                {metric.details.min}-{metric.details.max}
                              </span>
                            </div>
                            {/* Mini deposit pattern */}
                            <div className="flex items-end justify-center gap-1 h-6 mt-2">
                              {[13, 15, 12, 16, 14, 13].map((count, i) => (
                                <div
                                  key={i}
                                  className="w-2 rounded-sm"
                                  style={{
                                    height: `${(count / 16) * 100}%`,
                                    backgroundColor: withAlpha(evergreenAccent, 0.75),
                                  }}
                                  title={`${count} deposits`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Weekly Timeline Chart (like wellness tab) */}
                <div className="rounded-2xl p-8 border border-white/14 bg-[rgba(8,18,14,0.82)] shadow-[0_28px_60px_rgba(5,12,9,0.48)]">
                  <div className="flex items-center gap-3 mb-6 text-white">
                    <div
                      className="p-2 rounded-xl border"
                      style={{
                        backgroundColor: withAlpha(evergreenAccent, 0.22),
                        borderColor: withAlpha(evergreenAccent, 0.48),
                        color: evergreenAccent,
                      }}
                    >
                      <TrendingUp className="size-5" />
                    </div>
                    <span className="font-semibold text-lg">
                      Weekly Timeline
                    </span>
                  </div>
                  <div className="h-32 overflow-x-auto">
                    {!mounted ? (
                      <div className="w-full h-full min-w-[300px] flex items-center justify-center">
                        <div className="animate-pulse bg-white/10 rounded w-full h-full"></div>
                      </div>
                    ) : (
                      <svg
                        viewBox="0 0 400 120"
                        className="w-full h-full min-w-[300px]"
                      >
                        {/* Weekly data points - realistic deposit counts */}
                        {[
                          { week: "Aug 4", deposits: 14, status: "normal" },
                          { week: "Aug 11", deposits: 13, status: "monitor" },
                          { week: "Aug 18", deposits: 15, status: "normal" },
                          { week: "Aug 25", deposits: 12, status: "attention" },
                          { week: "Sep 1", deposits: 16, status: "normal" },
                          { week: "Sep 8", deposits: 14, status: "normal" },
                        ].map((point, index) => {
                          const x = 50 + index * 55;
                          const maxDeposits = 16;
                          const y = 90 - (point.deposits / maxDeposits) * 60;

                          let color: string = evergreenAccent; // normal
                          if (point.status === "monitor") color = brandColors.gold;
                          if (point.status === "attention") color = brandColors.coral;

                          return (
                            <g key={index}>
                              {/* Line to next point */}
                              {index < 5 && (
                                <line
                                  x1={x}
                                  y1={y}
                                  x2={50 + (index + 1) * 55}
                                  y2={
                                    90 -
                                    ([
                                      { deposits: 14 },
                                      { deposits: 13 },
                                      { deposits: 15 },
                                      { deposits: 12 },
                                      { deposits: 16 },
                                      { deposits: 14 },
                                    ][index + 1].deposits /
                                      maxDeposits) *
                                      60
                                  }
                                  stroke={withAlpha(evergreenAccent, 0.6)}
                                  strokeWidth="2"
                                  opacity="0.8"
                                />
                              )}

                              {/* Data point */}
                              <circle
                                cx={x}
                                cy={y}
                                r="5"
                                fill={color}
                                className="drop-shadow-sm"
                              />

                              {/* Week label */}
                              <text
                                x={x}
                                y="110"
                                textAnchor="middle"
                                className="fill-[rgba(255,255,255,0.55)]"
                                fontSize="10"
                              >
                                {point.week}
                              </text>
                            </g>
                          );
                        })}

                        {/* Y-axis labels */}
                        <text
                          x="15"
                          y="30"
                          textAnchor="middle"
                          className="fill-[rgba(255,255,255,0.45)]"
                          fontSize="9"
                        >
                          16
                        </text>
                        <text
                          x="15"
                          y="50"
                          textAnchor="middle"
                          className="fill-[rgba(255,255,255,0.45)]"
                          fontSize="9"
                        >
                          8
                        </text>
                        <text
                          x="15"
                          y="70"
                          textAnchor="middle"
                          className="fill-[rgba(255,255,255,0.45)]"
                          fontSize="9"
                        >
                          0
                        </text>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Dashboard-matched mini visuals: Color tile + Consistency strip */}
                <div className="mt-8 grid sm:grid-cols-2 gap-8">
                  {/* Color Analysis (matches wellness tab exactly) */}
                  <motion.div
                    className="p-6 rounded-2xl border border-white/14 bg-[rgba(8,18,14,0.78)] backdrop-blur-sm shadow-[0_24px_56px_rgba(5,12,9,0.46)] text-white"
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={spring.snappy}
                  >
                    <div className="text-base font-semibold mb-4 text-white">
                      Color Analysis
                    </div>

                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    <div
                      className="text-center p-2 rounded border backdrop-blur-sm"
                      style={{
                        backgroundColor: withAlpha(healthyStoolColor, 0.24),
                        borderColor: withAlpha(healthyStoolColor, 0.48),
                      }}
                      >
                        <div
                          className="text-lg font-bold"
                          style={{ color: healthyStoolColor }}
                        >
                          96%
                        </div>
                        <div
                          className="text-xs font-medium"
                          style={{ color: healthyStoolColor }}
                        >
                          Normal
                        </div>
                      </div>
                      <div
                        className="text-center p-2 rounded border backdrop-blur-sm"
                        style={{
                          backgroundColor: withAlpha(brandColors.gold, 0.2),
                          borderColor: withAlpha(brandColors.gold, 0.38),
                        }}
                      >
                        <div
                          className="text-lg font-bold"
                          style={{ color: brandColors.gold }}
                        >
                          3%
                        </div>
                        <div
                          className="text-xs font-medium"
                          style={{ color: brandColors.gold }}
                        >
                          Yellow
                        </div>
                      </div>
                      <div
                        className="text-center p-2 rounded border backdrop-blur-sm"
                        style={{
                          backgroundColor: withAlpha(brandColors.coral, 0.22),
                          borderColor: withAlpha(brandColors.coral, 0.4),
                        }}
                      >
                        <div
                          className="text-lg font-bold"
                          style={{ color: brandColors.coralInk }}
                        >
                          1%
                        </div>
                        <div
                          className="text-xs font-medium"
                          style={{ color: brandColors.coralInk }}
                        >
                          Red
                        </div>
                      </div>
                    </div>

                    {/* Donut Chart - Rebuilt from scratch */}
                    <div className="flex justify-center mb-3">
                      <svg viewBox="0 0 120 120" className="w-28 h-28">
                        {(() => {
                          const radius = 45;
                          const circumference = 2 * Math.PI * radius;
                          const center = 60;

                          // Percentages: Normal 96%, Yellow 3%, Red 1%
                          const normalPercent = 96;
                          const yellowPercent = 3;
                          const redPercent = 1;

                          // Calculate dash lengths
                          const normalLength =
                            (normalPercent / 100) * circumference;
                          const yellowLength =
                            (yellowPercent / 100) * circumference;
                          const redLength = (redPercent / 100) * circumference;

                          return (
                            <>
                              {/* Background circle for reference */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth="12"
                              />

                              {/* Normal segment (96%) - Green */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke={healthyStoolColor}
                                strokeWidth="12"
                                strokeDasharray={`${normalLength} ${circumference - normalLength}`}
                                strokeLinecap="round"
                              />

                              {/* Yellow segment (3%) */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                  stroke={brandColors.gold}
                                strokeWidth="12"
                                strokeDasharray={`${yellowLength} ${circumference - yellowLength}`}
                                strokeLinecap="round"
                                transform={`rotate(${(normalPercent / 100) * 360} ${center} ${center})`}
                              />

                              {/* Red segment (1%) */}
                              <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                  stroke={brandColors.coral}
                                strokeWidth="12"
                                strokeDasharray={`${redLength} ${circumference - redLength}`}
                                strokeLinecap="round"
                                transform={`rotate(${((normalPercent + yellowPercent) / 100) * 360} ${center} ${center})`}
                              />

                              {/* Center circle */}
                              <circle
                                cx={center}
                                cy={center}
                                r="28"
                                fill="rgba(12,24,18,0.9)"
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="1"
                              />
                              <text
                                x={center}
                                y="52"
                                textAnchor="middle"
                                className="text-xl font-bold"
                                fill={healthyStoolColor}
                              >
                                96%
                              </text>
                              <text
                                x={center}
                                y="68"
                                textAnchor="middle"
                                className="text-sm font-medium"
                                fill={withAlpha(healthyStoolColor, 0.88)}
                              >
                                Normal
                              </text>
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-white/70">
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: healthyStoolColor }}
                      ></div>
                      <span>Normal</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: brandColors.gold }}
                        ></div>
                        <span>Yellow/Gray</span>
                      </div>
                      <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: brandColors.coral }}
                      ></div>
                      <span>Red</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COLOR_HEX.black }}
                      ></div>
                      <span>Black/Tarry</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-white/65 text-center">
                    Occasional green stool can stem from leafy diets or rapid digestion. We flag it separately if we notice it across multiple visits.
                  </div>
                </motion.div>

                  {/* Consistency Analysis (like wellness tab) */}
                  <motion.div
                    className="p-6 rounded-2xl border border-white/14 bg-[rgba(8,18,14,0.78)] backdrop-blur-sm shadow-[0_24px_56px_rgba(5,12,9,0.46)] text-white"
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={spring.snappy}
                  >
                    <div className="text-base font-semibold mb-4">
                      Consistency Analysis
                    </div>

                    {/* Bristol Scale Visual */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs text-white/75">
                        <span>Hard</span>
                        <span>Normal</span>
                        <span>Soft</span>
                      </div>
                      <div className="relative h-3 rounded-full overflow-hidden bg-white/10 border border-white/20">
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{ width: "33.33%", backgroundColor: withAlpha(dehydrationAccent, 0.35) }}
                        ></div>
                        <div
                          className="absolute inset-y-0 left-1/3"
                          style={{ width: "33.33%", backgroundColor: withAlpha(evergreenAccent, 0.52) }}
                        ></div>
                        <div
                          className="absolute inset-y-0 right-0"
                          style={{ width: "33.33%", backgroundColor: withAlpha(brandColors.gold, 0.4) }}
                        ></div>
                        <div className="absolute inset-y-0 left-1/3 w-px bg-white/80"></div>
                        <div className="absolute inset-y-0 left-2/3 w-px bg-white/70"></div>
                      </div>
                      <div className="text-center text-xs text-white/75">
                        Mostly Normal
                      </div>
                    </div>

                    {/* Consistency Distribution */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div
                        className="text-center p-2 rounded border backdrop-blur-sm"
                        style={{
                          backgroundColor: withAlpha(evergreenAccent, 0.26),
                          borderColor: withAlpha(evergreenAccent, 0.46),
                        }}
                      >
                        <div className="text-lg font-bold" style={{ color: evergreenAccent }}>
                          70%
                        </div>
                        <div className="text-xs" style={{ color: evergreenAccent }}>
                          Normal
                        </div>
                      </div>
                      <div
                        className="text-center p-2 rounded border backdrop-blur-sm"
                        style={{
                          backgroundColor: withAlpha(healthyStoolColor, 0.24),
                          borderColor: withAlpha(healthyStoolColor, 0.42),
                        }}
                      >
                        <div className="text-lg font-bold" style={{ color: healthyStoolColor }}>
                          20%
                        </div>
                        <div className="text-xs" style={{ color: healthyStoolColor }}>
                          Soft
                        </div>
                      </div>
                      <div
                        className="text-center p-2 rounded border backdrop-blur-sm"
                        style={{
                          backgroundColor: withAlpha(brandColors.coral, 0.22),
                          borderColor: withAlpha(brandColors.coral, 0.4),
                        }}
                      >
                        <div className="text-lg font-bold" style={{ color: dehydrationAccent }}>
                          10%
                        </div>
                        <div className="text-xs" style={{ color: dehydrationAccent }}>
                          Dry
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Insights Legend */}
                <div className="mt-8 p-6 rounded-2xl border border-white/14 bg-[rgba(8,18,14,0.82)] shadow-[0_24px_56px_rgba(5,12,9,0.46)] text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="p-2 rounded-xl border"
                      style={{
                        backgroundColor: withAlpha(evergreenAccent, 0.22),
                        borderColor: withAlpha(evergreenAccent, 0.4),
                        color: evergreenAccent,
                      }}
                    >
                      <Shield className="size-5" />
                    </div>
                    <span className="text-lg font-semibold">
                      What We Monitor
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-white/75">
                    <span>• Color shifts</span>
                    <span>• Consistency shifts</span>
                    <span>• Mucus</span>
                    <span>• Parasite cues</span>
                    <span>• Foreign objects</span>
                    <span>• Frequency changes</span>
                  </div>
                  <div className="mt-3 text-xs text-white/70">
                    📊 Preview visualization. Recap links are available today; dashboard + trends view coming in 2026.
                  </div>
                </div>
              </motion.div>
            </Reveal>
          </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    </div>
  </section>
  );
}
