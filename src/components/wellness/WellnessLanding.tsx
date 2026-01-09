"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HeartPulse,
  MapPin,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  ThermometerSun,
  TrendingUp,
  Utensils,
  Bug,
  Route,
  Users,
} from "lucide-react";

import Reveal from "@/components/Reveal";
import { Badge } from "@/components/ui/badge";
import AppStoreButtons from "@/components/wellness/AppStoreButtons";
import { brandColors, withAlpha } from "@/shared/brand";
import { useTheme } from "@/components/theme/ThemeProvider";

type Accent = "mint" | "coral" | "gold" | "evergreen";

const ACCENT_STYLES: Record<
  Accent,
  { base: string; glow: string; border: string }
> = {
  mint: {
    base: brandColors.mint,
    glow: withAlpha(brandColors.mint, 0.16),
    border: withAlpha(brandColors.mint, 0.35),
  },
  coral: {
    base: brandColors.coral,
    glow: withAlpha(brandColors.coral, 0.16),
    border: withAlpha(brandColors.coral, 0.35),
  },
  gold: {
    base: brandColors.gold,
    glow: withAlpha(brandColors.gold, 0.18),
    border: withAlpha(brandColors.gold, 0.4),
  },
  evergreen: {
    base: brandColors.evergreen,
    glow: withAlpha(brandColors.evergreen, 0.18),
    border: withAlpha(brandColors.evergreen, 0.35),
  },
};

const CORE_FEATURES = [
  {
    icon: Camera,
    title: "1 tap stool capture",
    copy: "Instant AI analysis for color, consistency, and content with a watch, monitor, or vet now indicator.",
    accent: "coral",
  },
  {
    icon: Sparkles,
    title: "Holistic AI summary",
    copy: "Links stool, symptoms, food, meds, walks, weight, weather, and parasite risk into plain language insights.",
    accent: "mint",
  },
  {
    icon: ClipboardCheck,
    title: "Weekly 10-second check-ins",
    copy: "Quick taps for appetite, energy, water intake, stool frequency, vomiting, diarrhea, and meds.",
    accent: "gold",
  },
  {
    icon: Bot,
    title: "Context-aware AI chat",
    copy: "Ask about any dog, log, or trend. Replies pull from the full wellness timeline.",
    accent: "evergreen",
  },
  {
    icon: PawPrint,
    title: "Dog profile hub",
    copy: "Breed, age, weight trends, allergies, meds, diet, vet contact, and photos.",
    accent: "coral",
  },
  {
    icon: Bell,
    title: "Reminders that stick",
    copy: "Meds, deworming, flea and tick, vaccines, food transitions, and vet visits.",
    accent: "mint",
  },
  {
    icon: FileText,
    title: "Vet ready report",
    copy: "Export a clean one-page PDF with symptoms, stool images, notes, and logs.",
    accent: "gold",
  },
] as const;

const TOOLKIT_FEATURES = [
  {
    icon: Utensils,
    title: "Food, treat, supplement, and med log",
    copy: "Scan labels, save to inventory, and set auto-log routines. Highlights key ingredients and sensitivities.",
    accent: "mint",
  },
  {
    icon: BookOpen,
    title: "Is this normal? library",
    copy: "Quick visual comparisons so you know when to watch or call the vet.",
    accent: "gold",
  },
  {
    icon: ThermometerSun,
    title: "Weather safety alerts",
    copy: "Heat and cold warnings based on local conditions. Quiet until it matters.",
    accent: "coral",
  },
  {
    icon: Bug,
    title: "Parasite risk calendar",
    copy: "Regional seasonal risk, with reminder prompts for heartworm and flea/tick.",
    accent: "evergreen",
  },
  {
    icon: MapPin,
    title: "Poop map",
    copy: "Heatmap and pin views to spot yard hot spots and frequency shifts.",
    accent: "mint",
  },
  {
    icon: ShieldCheck,
    title: "Privacy first storage",
    copy: "Auto blur backgrounds with full control over sharing and exports.",
    accent: "gold",
  },
] as const;

const FLOW_STEPS = [
  {
    icon: Camera,
    title: "Scan + check in",
    copy: "1-tap stool scan plus a 10-second symptom check-in.",
    accent: "coral",
  },
  {
    icon: Utensils,
    title: "Log nutrition + routines",
    copy: "Scan ingredients, add to inventory, and auto-log daily or weekly items.",
    accent: "mint",
  },
  {
    icon: Bot,
    title: "Ask with full context",
    copy: "AI chat uses stool, food, meds, walks, weight, weather, and reports.",
    accent: "gold",
  },
] as const;

const HOLISTIC_SIGNALS = [
  {
    icon: Utensils,
    title: "Nutrition + ingredients",
    copy: "Scan food, treats, supplements, and meds for ingredient highlights.",
    accent: "gold",
  },
  {
    icon: Camera,
    title: "Stool + symptoms",
    copy: "3C scans paired with quick check-ins for clean GI tracking.",
    accent: "coral",
  },
  {
    icon: HeartPulse,
    title: "Meds + supplements",
    copy: "Track doses, notes, and reminders by dog profile.",
    accent: "mint",
  },
  {
    icon: Route,
    title: "Walks + activity",
    copy: "Distance, pace, and optional passive tracking build baselines.",
    accent: "evergreen",
  },
  {
    icon: TrendingUp,
    title: "Weight + trends",
    copy: "See weight changes alongside food and stool history.",
    accent: "gold",
  },
  {
    icon: ThermometerSun,
    title: "Weather + parasite risk",
    copy: "Heat, cold, and seasonal risk alerts keep care proactive.",
    accent: "coral",
  },
] as const;

const DASHBOARD_HIGHLIGHTS = [
  { icon: Utensils, label: "Ingredient highlights" },
  { icon: Route, label: "Activity baselines" },
  { icon: TrendingUp, label: "Weight trends" },
  { icon: FileText, label: "Vet-ready reports" },
  { icon: Bug, label: "Parasite season alerts" },
  { icon: ThermometerSun, label: "Weather safety" },
] as const;

const PREMIUM_FEATURES = [
  "Unlimited stool scans + AI chat",
  "Long-term trends and early warnings",
  "Wellness Risk Score with proactive nudges",
  "GPS walk tracking with distance, route, pace, and passive mode",
  "Multi-dog households, family sharing, cross-device sync",
  "Vet-ready reporting with food and symptom context",
];

const PRO_ASSISTED_FEATURES = [
  "Auto capture by a pro scooper for consistent data quality",
  "Higher accuracy from standard capture distance and lighting",
  "Reliable pickup schedule improves frequency tracking",
  "Pro verified wellness timeline with shareable notes",
  "Clean yard results plus actionable wellness insights",
];

const PREMIUM_HIGHLIGHTS = [
  {
    icon: Route,
    title: "Walk tracking",
    copy: "GPS route, distance, pace, and passive walk nudges.",
    accent: "coral",
  },
  {
    icon: TrendingUp,
    title: "Long term trends",
    copy: "Week-over-week changes with early warning signals.",
    accent: "gold",
  },
  {
    icon: Sparkles,
    title: "Wellness Risk Score",
    copy: "Proactive nudges when patterns shift.",
    accent: "mint",
  },
  {
    icon: Users,
    title: "Multi dog + sharing",
    copy: "Family access, cross-device sync, and multi-dog insights.",
    accent: "evergreen",
  },
] as const;

const REPORT_FEATURES = [
  {
    icon: FileText,
    title: "1 page PDF export",
    copy: "Recent symptoms, stool images, and note highlights in a single shareable page.",
  },
  {
    icon: HeartPulse,
    title: "Weekly + monthly wellness recap",
    copy: "Email reports with trends, red flags, and progress you can show a vet.",
  },
  {
    icon: Users,
    title: "Family sharing and vet access",
    copy: "Invite family, share specific dogs, and choose what to include.",
  },
] as const;


function FeatureCard({
  icon: Icon,
  title,
  copy,
  accent,
}: {
  icon: typeof Camera;
  title: string;
  copy: string;
  accent: Accent;
}) {
  const palette = ACCENT_STYLES[accent];

  return (
    <div
      className="group relative h-full overflow-hidden rounded-3xl border bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 dark:bg-slate-900/80"
      style={{ borderColor: palette.border }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${palette.glow} 0%, transparent 65%)`,
        }}
      />
      <div className="relative flex items-start gap-4">
        <div
          className="rounded-2xl p-3 shadow-sm"
          style={{ backgroundColor: palette.glow }}
        >
          <Icon className="size-5" style={{ color: palette.base }} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {copy}
          </p>
        </div>
      </div>
    </div>
  );
}

function SignalCard({
  icon: Icon,
  title,
  copy,
  accent,
}: {
  icon: typeof Camera;
  title: string;
  copy: string;
  accent: Accent;
}) {
  const palette = ACCENT_STYLES[accent];

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border bg-white/90 p-4 shadow-sm dark:bg-slate-900/80"
      style={{ borderColor: palette.border }}
    >
      <div
        className="rounded-xl p-2"
        style={{ backgroundColor: palette.glow }}
      >
        <Icon className="size-4" style={{ color: palette.base }} />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {copy}
        </p>
      </div>
    </div>
  );
}

export default function WellnessLanding() {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const heroBackground = useMemo(() => {
    const mode = theme === "dark" ? "dark" : "light";
    const base =
      mode === "dark"
        ? {
            desktop: "/hero_backgrounds/retriever_teal_right_dark.jpeg",
            mobile: "/hero_backgrounds/retriever_teal_right_dark.jpeg",
          }
        : {
            desktop: "/hero_backgrounds/retriever_teal_right_light.jpeg",
            mobile: "/hero_backgrounds/retriever_teal_right_light.jpeg",
          };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const heroOverlay = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(150deg, rgba(7,13,10,0.7) 0%, rgba(8,18,13,0.62) 50%, rgba(11,26,18,0.55) 100%)";
    }
    return "linear-gradient(150deg, rgba(6,12,9,0.32) 0%, rgba(9,18,13,0.28) 50%, rgba(12,22,16,0.24) 100%)";
  }, [theme]);

  return (
    <main className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={heroBackground}
            alt="Dog enjoying a calm, healthy yard"
            fill
            priority
            className="object-cover"
            sizes="100vw"
            style={{ objectPosition: "72% center" }}
          />
          <div className="absolute inset-0" style={{ background: heroOverlay }} />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(circle at 15% 20%, rgba(255,194,77,0.25), transparent 55%)",
            }}
          />
        </div>

        <div className="container relative z-10 grid items-center gap-12 py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal variant="slideUp">
            <div className="space-y-6 text-white">
              <Badge
                variant="outline"
                className="border-white/30 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.32em] text-white"
              >
                Holistic wellness tracking
              </Badge>
              <h1 className="text-4xl font-black leading-tight md:text-5xl">
                Every health signal, one timeline.
              </h1>
              <p className="text-base text-white/85 md:text-lg">
                Stool scans, symptoms, food, treats, meds, supplements, walks,
                weight, weather, and parasite risk live together. The AI
                connects the dots so you can spot changes early and share clean
                vet-ready reports.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/85">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold" />
                  Ingredient scan + auto-log routines
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold" />
                  Stool + symptom tracking
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold" />
                  Walks, weight, and trends
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold" />
                  Weekly + monthly email reports
                </span>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href="#download"
                  className="btn-cta-primary px-6 py-3 text-base"
                >
                  Download the app
                </a>
                <a
                  href="#plans"
                  className="btn-cta-secondary px-6 py-3 text-base"
                >
                  Compare plans
                </a>
              </div>
              <AppStoreButtons compact />
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-xs uppercase tracking-[0.28em] text-white/80">
                Not a diagnosis. Seek a vet for urgent symptoms.
              </div>
            </div>
          </Reveal>

          <Reveal variant="scaleIn">
            <div className="relative lg:mr-auto lg:max-w-[460px]">
              <div className="relative overflow-hidden rounded-[38px] border border-white/30 bg-slate-950/70 p-6 shadow-[0_40px_110px_rgba(4,12,10,0.65)] backdrop-blur-2xl">
                <div className="absolute inset-0 opacity-90">
                  <div className="absolute -left-20 top-10 h-44 w-44 rounded-full bg-brand-mint/25 blur-3xl" />
                  <div className="absolute -right-16 bottom-10 h-48 w-48 rounded-full bg-[rgba(var(--gold-rgb-commas),0.22)] blur-3xl" />
                </div>
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.32em] text-white/60">
                        InsightScoop Wellness
                      </p>
                      <p className="text-base font-semibold text-white">
                        Stool scan summary
                      </p>
                    </div>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                      Today
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white/90">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-white/60">
                      <span>Capture</span>
                      <span>9:12 AM</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
                        <Camera className="size-6 text-white/70" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-semibold text-white">
                          Normal range
                        </div>
                        <div className="text-xs text-white/70">
                          Color: Brown | Consistency: 4/7
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                          Indicator: watch
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        label: "Color",
                        value: "Brown",
                        note: "Normal range",
                        accent: "bg-brand-mint/35 text-white",
                      },
                      {
                        label: "Firmness",
                        value: "4 / 7",
                        note: "Normal range",
                        accent: "bg-[rgba(var(--gold-rgb-commas),0.35)] text-white",
                      },
                      {
                        label: "Content",
                        value: "Typical",
                        note: "No issues",
                        accent: "bg-brand-coral/35 text-white",
                      },
                      {
                        label: "Indicator",
                        value: "Watch",
                        note: "Recheck tomorrow",
                        accent: "bg-white/15 text-white",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-2xl border border-white/20 bg-white/12 p-4 text-white/90 shadow-sm"
                      >
                        <div className="text-[10px] uppercase tracking-[0.28em] text-white/65">
                          {card.label}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-2xl font-semibold text-white">
                            {card.value}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${card.accent}`}
                          >
                            {card.note}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white/80">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-white/60">
                      What this could mean
                    </div>
                    <p className="mt-2 text-sm text-white/85">
                      Stool looks steady. Food log shows salmon kibble + probiotic,
                      2.1 mi walk today, no symptoms logged.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white/80">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-white/60">
                      Context used
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                      {[
                        "Stool scans",
                        "Food log",
                        "Walks",
                        "Symptoms",
                        "Weather",
                      ].map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-4 hidden rounded-3xl border border-white/20 bg-white/10 p-4 text-xs text-white/80 shadow-lg backdrop-blur lg:block">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand-gold" />
                  Built for owners, no device required
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="flow" className="relative overflow-hidden py-20">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-brand-mint/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[rgba(var(--gold-rgb-commas),0.16)] blur-3xl" />
        </div>
        <div className="container relative z-10 grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-10">
            <div className="space-y-4 text-center lg:text-left">
              <span className="text-xs uppercase tracking-[0.32em] text-brand-mint">
                Holistic wellness loop
              </span>
              <h2 className="text-3xl font-black md:text-4xl">
                One timeline that connects every signal.
              </h2>
              <p className="mx-auto max-w-3xl text-base text-slate-600 dark:text-slate-300 lg:mx-0">
                Stool scans, symptoms, nutrition, meds, walks, weight, weather,
                and parasite risk live together so patterns are clear and easy
                to share.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {HOLISTIC_SIGNALS.map((signal, index) => (
                <Reveal key={signal.title} delay={index * 0.03}>
                  <SignalCard {...signal} />
                </Reveal>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {[
                "Scan once, auto-log routines",
                "Optional passive walk tracking",
                "Weekly + monthly email recaps",
              ].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-3 py-1 dark:border-white/10 dark:bg-slate-900/60"
                >
                  <CheckCircle2 className="size-3.5 text-brand-mint" />
                  {label}
                </span>
              ))}
            </div>

            <div className="space-y-4">
              <div className="text-center text-xs uppercase tracking-[0.32em] text-brand-mint lg:text-left">
                Simple workflow
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {FLOW_STEPS.map((step, index) => {
                  const palette = ACCENT_STYLES[step.accent];
                  return (
                    <Reveal key={step.title} delay={index * 0.05}>
                      <div
                        className="relative h-full rounded-3xl border bg-white/90 p-6 shadow-lg dark:bg-slate-900/80"
                        style={{ borderColor: palette.border }}
                      >
                        <div
                          className="mb-4 inline-flex items-center gap-3 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.28em]"
                          style={{
                            borderColor: palette.border,
                            color: palette.base,
                            backgroundColor: palette.glow,
                          }}
                        >
                          Step {index + 1}
                        </div>
                        <div className="flex items-start gap-4">
                          <div
                            className="rounded-2xl p-3"
                            style={{ backgroundColor: palette.glow }}
                          >
                            <step.icon
                              className="size-5"
                              style={{ color: palette.base }}
                            />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                              {step.title}
                            </h3>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {step.copy}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>

          <Reveal variant="scaleIn">
            <div className="relative mx-auto flex w-full max-w-lg flex-col gap-6">
              <div className="relative">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[32px] border border-white/25 bg-white/90 shadow-[0_28px_80px_rgba(10,18,14,0.25)] dark:border-white/10 dark:bg-slate-900/80">
                  <Image
                    src="/sections/tech_insights.png"
                    alt="Wellness dashboard in the app"
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 420px, 90vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
                </div>
                <div className="absolute -right-6 top-8 hidden w-24 rounded-3xl border border-white/20 bg-white/90 p-3 shadow-lg dark:border-white/10 dark:bg-slate-900/80 lg:block">
                  <Image
                    src="/hero_backgrounds/gate_notification.png"
                    alt=""
                    width={120}
                    height={200}
                    className="h-auto w-full object-contain"
                  />
                  <div className="mt-2 text-[9px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">
                    Walk logged
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-6 w-60 rounded-[26px] border border-white/30 bg-white/95 p-4 shadow-[0_24px_60px_rgba(10,18,14,0.25)] dark:border-white/10 dark:bg-slate-900/90">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-slate-500 dark:text-slate-300">
                    Holistic snapshot
                  </div>
                  <div className="mt-3 space-y-2 text-xs font-semibold text-slate-900 dark:text-white">
                    {[
                      { label: "Stool", value: "Brown 4/7" },
                      { label: "Food", value: "Salmon kibble" },
                      { label: "Walk", value: "2.1 mi" },
                      { label: "Weight", value: "57.2 lb" },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between rounded-full border border-slate-200/60 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <span>{row.label}</span>
                        <span className="text-slate-700 dark:text-slate-200">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-full border border-brand-mint/25 bg-brand-mint/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-mint">
                    Auto-log: probiotic daily
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-slate-950/90 shadow-[0_22px_60px_rgba(6,12,10,0.35)]">
                <video
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                >
                  <source src="/hero-video-health-app.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
                  Passive walks + yard context
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="features" className="relative overflow-hidden py-24">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-0 top-10 h-72 w-72 rounded-full bg-brand-coral/10 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-brand-mint/15 blur-3xl" />
        </div>
        <div className="container relative space-y-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5 text-center lg:text-left">
              <span className="text-xs uppercase tracking-[0.32em] text-brand-coral">
                Holistic wellness hub
              </span>
              <h2 className="text-3xl font-black md:text-4xl">
                See the full story, not single events.
              </h2>
              <p className="mx-auto max-w-3xl text-base text-slate-600 dark:text-slate-300 lg:mx-0">
                Everything lives in one timeline so patterns show up early. The
                AI chat and your reports pull from the same data, so nothing
                gets lost between logs.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DASHBOARD_HIGHLIGHTS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
                  >
                    <div className="rounded-xl bg-brand-mint/15 p-2 text-brand-mint">
                      <item.icon className="size-4" />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg">
              <div className="relative overflow-hidden rounded-[32px] border border-white/25 bg-white/90 shadow-[0_28px_80px_rgba(10,18,14,0.25)] dark:border-white/10 dark:bg-slate-900/80">
                <Image
                  src="/sections/peaceofmind.png"
                  alt="Owner using the wellness app with a dog"
                  width={960}
                  height={640}
                  className="h-auto w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-5 left-6 rounded-full border border-white/30 bg-white/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-600 shadow-lg dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-200">
                Weekly + monthly recaps
              </div>
              <div className="absolute -top-6 right-6 hidden rounded-3xl border border-white/20 bg-white/90 p-3 shadow-lg dark:border-white/10 dark:bg-slate-900/80 lg:block">
                <Image
                  src="/hero_backgrounds/gate_notification.png"
                  alt=""
                  width={96}
                  height={160}
                  className="h-auto w-16 object-contain"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 text-center">
            <span className="text-xs uppercase tracking-[0.32em] text-brand-coral">
              Freemium core value
            </span>
            <h3 className="text-3xl font-black md:text-4xl">
              Everything you need for everyday wellness, free.
            </h3>
            <p className="mx-auto max-w-3xl text-base text-slate-600 dark:text-slate-300">
              Designed for owners, not clinicians. Capture, check in, chat, and
              share results without searching for answers on your own.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {CORE_FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.05}>
                <FeatureCard {...feature} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section
        id="toolkit"
        className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50 py-24 dark:from-slate-950 dark:to-slate-900"
      >
        <div className="absolute inset-0 opacity-60">
          <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-brand-mint/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[rgba(var(--gold-rgb-commas),0.2)] blur-3xl" />
        </div>
        <div className="container relative space-y-12">
          <div className="flex flex-col gap-4 text-center">
            <span className="text-xs uppercase tracking-[0.32em] text-brand-mint">
              Wellness toolkit
            </span>
            <h2 className="text-3xl font-black md:text-4xl">
              Tools that remove manual work.
            </h2>
            <p className="mx-auto max-w-3xl text-base text-slate-600 dark:text-slate-300">
              Scan once, auto-log routines, and keep food, meds, environment,
              and education in one place with privacy controls built in.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {TOOLKIT_FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.05}>
                <FeatureCard {...feature} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="py-24">
        <div className="container space-y-12">
          <div className="text-center space-y-4">
            <span className="text-xs uppercase tracking-[0.32em] text-brand-coral">
              Choose your path
            </span>
            <h2 className="text-3xl font-black md:text-4xl">
              Free, premium, or pro-assisted wellness.
            </h2>
            <p className="mx-auto max-w-3xl text-base text-slate-600 dark:text-slate-300">
              Start free with one dog. Upgrade anytime for deeper insights,
              multi dog households, and hands off data capture.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.32em] text-brand-gold">
            Premium highlights
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {PREMIUM_HIGHLIGHTS.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.05}>
                <FeatureCard {...feature} />
              </Reveal>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-brand-coral/20 bg-white/90 p-8 shadow-lg dark:border-white/10 dark:bg-slate-900/80">
              <div className="flex items-center justify-between">
                <Badge className="bg-brand-coral/10 text-brand-coral">
                  Free
                </Badge>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  1 dog included
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold">Core wellness</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Capture, check-ins, chat, reminders, and reports for weekly
                peace of mind.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                {[
                  "5 stool scans + 12 chats per month",
                  "Weekly check-ins in 10 seconds",
                  "AI stool analysis with 3C recap + watch/monitor/vet now",
                  "Context-aware AI chat",
                  "Food log, meds, and stool library tools",
                  "Poop map, parasite risk, and weather safety alerts",
                  "PDF vet report",
                  "Privacy-first storage with auto-blur",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-brand-mint" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#download"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-brand-coral/30 bg-brand-coral/10 px-5 py-3 text-sm font-semibold text-brand-coral hover:bg-brand-coral/20"
              >
                Start free
              </a>
            </div>

            <div className="rounded-3xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 to-white/90 p-8 shadow-xl dark:border-brand-gold/30 dark:from-brand-gold/15 dark:to-slate-900/80">
              <div className="flex items-center justify-between">
                <Badge className="bg-[rgba(var(--gold-rgb-commas),0.2)] text-slate-900">
                  Premium
                </Badge>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  19.99 per month
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold">
                Long term insights
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Unlimited scans, long term trends, and family sharing for
                multi dog homes.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                {PREMIUM_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-brand-gold" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#download"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-slate-900 hover:brightness-95"
              >
                Unlock premium
              </a>
            </div>

            <div className="rounded-3xl border border-brand-mint/25 bg-white/90 p-8 shadow-lg dark:border-white/10 dark:bg-slate-900/80">
              <div className="flex items-center justify-between">
                <Badge className="bg-brand-mint/15 text-brand-mint">
                  Pro-assisted
                </Badge>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Scooping add-on
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold">
                Clean yard plus pro data
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Let a pro handle the capture and cleanup while you get a
                verified wellness timeline.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                {PRO_ASSISTED_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-brand-mint" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/quote?businessId=yardura"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-brand-mint/40 bg-brand-mint/10 px-5 py-3 text-sm font-semibold text-brand-mint hover:bg-brand-mint/20"
              >
                Add scooping service
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="pro"
        className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white py-24 dark:from-slate-950 dark:to-slate-900"
      >
        <div className="container grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <div className="space-y-6">
              <span className="text-xs uppercase tracking-[0.32em] text-brand-mint">
                Pro-assisted wellness
              </span>
              <h2 className="text-3xl font-black md:text-4xl">
                The easiest way to build a reliable health timeline.
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-300">
                Scooping is optional, but it makes the data better. Consistent
                capture distance and angle means cleaner AI reads, and a clean
                yard means you never miss a change.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: Camera,
                    title: "Auto capture",
                    copy: "Pro scoopers capture every visit without you lifting a finger.",
                  },
                  {
                    icon: MapPin,
                    title: "Reliable frequency",
                    copy: "Regular pickups build a steady dataset for early signals.",
                  },
                  {
                    icon: Sparkles,
                    title: "Pro verified timeline",
                    copy: "Optional sample collection and verified notes for vets.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Clean yard benefits",
                    copy: "Less odor, fewer hazards, and more time back in your day.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-brand-mint/20 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center gap-3 text-sm font-semibold">
                      <div className="rounded-xl bg-brand-mint/15 p-2 text-brand-mint">
                        <item.icon className="size-4" />
                      </div>
                      {item.title}
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      {item.copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className="relative overflow-hidden rounded-[36px] border border-brand-mint/30 bg-slate-900/90 p-8 text-white shadow-[0_32px_70px_rgba(10,28,20,0.5)]">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-mint/20 blur-3xl" />
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-white/80">
                  DIY vs Pro-assisted
                </div>
                <h3 className="text-2xl font-semibold">
                  Cleaner yard, smarter data.
                </h3>
                <p className="text-sm text-white/75">
                  Pro-assisted wellness combines hands off capture with
                  consistent cleanup so every scan counts. It is the easiest
                  way to build a long term baseline.
                </p>
                <div className="grid gap-3 text-xs text-white/75">
                  {[
                    "DIY wellness: capture when you remember.",
                    "Pro-assisted: capture at every visit, same distance and lighting.",
                    "DIY wellness: on demand insights.",
                    "Pro-assisted: verified timeline plus clean yard benefits.",
                  ].map((line) => (
                    <div key={line} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-[var(--gold)]" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/quote?businessId=yardura"
                  className="inline-flex items-center justify-center rounded-full bg-brand-mint px-5 py-3 text-sm font-semibold text-white hover:brightness-95"
                >
                  View scooping plans
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="reports" className="py-24">
        <div className="container space-y-10">
          <div className="text-center space-y-4">
            <span className="text-xs uppercase tracking-[0.32em] text-brand-coral">
              Reports and sharing
            </span>
            <h2 className="text-3xl font-black md:text-4xl">
              Share updates that vets actually use.
            </h2>
            <p className="mx-auto max-w-3xl text-base text-slate-600 dark:text-slate-300">
              Export, email, or share only the data you want. Weekly and
              monthly reports highlight trends, symptoms, stool images, and key
              notes in plain language.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {REPORT_FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.05}>
                <div className="rounded-3xl border border-brand-coral/20 bg-white/90 p-6 shadow-lg dark:border-white/10 dark:bg-slate-900/80">
                  <div className="flex items-center gap-3 text-sm font-semibold">
                    <div className="rounded-xl bg-brand-coral/15 p-2 text-brand-coral">
                      <feature.icon className="size-4" />
                    </div>
                    {feature.title}
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {feature.copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="rounded-3xl border border-brand-coral/20 bg-brand-coral/5 p-6 text-center shadow-lg dark:border-white/10 dark:bg-slate-900/60">
            <div className="flex flex-col items-center gap-3 text-sm font-semibold text-brand-coral dark:text-brand-mint">
              <AlertTriangle className="size-5" />
              Wellness insights are informational only and never a diagnosis.
            </div>
          </div>
        </div>
      </section>

      <section id="download" className="relative overflow-hidden py-24">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-brand-coral/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-brand-mint/20 blur-3xl" />
        </div>
        <div className="container relative grid gap-10 rounded-[40px] border border-brand-coral/20 bg-white/95 p-12 shadow-xl dark:border-white/10 dark:bg-slate-900/80 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.32em] text-brand-coral">
              Start free today
            </span>
            <h2 className="text-3xl font-black md:text-4xl">
              Download InsightScoop Wellness.
            </h2>
            <p className="max-w-xl text-base text-slate-600 dark:text-slate-300">
              Get immediate value with stool scans, ingredient logging,
              check-ins, and a context-aware AI chat. Upgrade when you are
              ready for long-term trends and passive walk insights.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-4 text-brand-mint" />
                Weekly check-ins
              </div>
              <div className="flex items-center gap-2">
                <Route className="size-4 text-brand-coral" />
                Walk tracking
              </div>
              <div className="flex items-center gap-2">
                <Stethoscope className="size-4 text-brand-gold" />
                Vet ready reports
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-4">
            <AppStoreButtons />
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-brand-coral dark:text-white"
            >
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
