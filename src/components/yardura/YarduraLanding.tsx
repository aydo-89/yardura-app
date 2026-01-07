"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { useMotionValueEvent, useScroll } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Compass, Leaf, MapPinned, Sparkles, Workflow } from "lucide-react";

const BRANDS = [
  {
    name: "InsightScoop",
    description:
      "AI-powered dog waste removal that pairs concierge field service with wellness reporting for Twin Cities pet parents.",
    url: "https://www.getinsightscoop.com",
    status: "Live",
  },
  {
    name: "Pupplmnt",
    description: "Functional canine supplements built to support gut health, recovery, and longevity.",
    url: "https://www.pupplmnt.com",
    status: "In development",
  },
  {
    name: "Supp Dog",
    description: "High-output nutrition and hydration products for sporting and working dogs.",
    url: "https://www.suppdog.com",
    status: "Launching soon",
  },
  {
    name: "Once Upon a Lawn",
    description: "Eco-forward yard renewal and turf deodorizing programs tailored to homes with pets.",
    url: "https://www.onceuponalawn.com",
    status: "Concept",
  },
];

const PILLARS = [
  {
    icon: MapPinned,
    title: "Field-tested operations",
    copy: "We design hardware, workflows, and training for technicians who navigate yards, gates, and real-time customer updates every single day.",
  },
  {
    icon: Sparkles,
    title: "Data-driven wellness",
    copy: "Brands like InsightScoop feed computer vision, AI, and vet partnerships into practical insights families can act on quickly.",
  },
  {
    icon: Leaf,
    title: "Sustainable impact",
    copy: "From compost pilots to stormwater-safe sanitation, Yardura companies focus on pet health without trashing the planet.",
  },
  {
    icon: Workflow,
    title: "Shared infrastructure",
    copy: "Payment rails, messaging, scheduling, and brand playbooks are built once and shared across every portfolio company.",
  },
];

const BACKGROUND_VIDEO_SRC = "/hero-scroll-vibrant.mp4";
const FALLBACK_VIDEO_DURATION = 8; // seconds
const VIDEO_START_OFFSET = 1.5; // Start video 1.5 seconds in

export default function YarduraLanding() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduceMotionRef = useRef(false);
  const lastUpdateRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"], // Video progresses as section scrolls out of view
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof window === "undefined") {
      return undefined;
    }

    // Set initial video position to start offset
    video.currentTime = VIDEO_START_OFFSET;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handlePreference = () => {
      reduceMotionRef.current = mediaQuery.matches;
      if (reduceMotionRef.current) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };

    handlePreference();
    mediaQuery.addEventListener("change", handlePreference);

    return () => {
      mediaQuery.removeEventListener("change", handlePreference);
    };
  }, []);

  // Sync video to scroll progress with throttling for performance
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (reduceMotionRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    // Throttle updates for smooth playback
    const now = Date.now();
    if (now - lastUpdateRef.current < 8) return; // ~120fps for ultra-smooth scrubbing
    lastUpdateRef.current = now;

    const duration = video.duration && !Number.isNaN(video.duration)
      ? video.duration
      : FALLBACK_VIDEO_DURATION;
    
    // Map scroll progress to video time range (starting from offset)
    // 0% scroll = VIDEO_START_OFFSET, 100% scroll = duration
    const playableDuration = duration - VIDEO_START_OFFSET;
    const targetTime = VIDEO_START_OFFSET + (value * playableDuration);
    const clampedTime = Math.max(VIDEO_START_OFFSET, Math.min(duration - 0.03, targetTime));
    
    // Only update if there's a meaningful change (prevents micro-jitters)
    if (Math.abs(video.currentTime - clampedTime) > 0.02) {
      video.currentTime = clampedTime;
    }
  });

  return (
    <main ref={sectionRef} className="relative isolate overflow-hidden bg-slate-950 pb-20 pt-32 text-white">
      <div className="absolute inset-0 -z-10">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src={BACKGROUND_VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          loop
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-slate-950/55 to-slate-950/85" aria-hidden="true" />
      </div>
      <div className="container mx-auto max-w-5xl space-y-16 px-6 text-white">
        <section id="overview" className="space-y-6 text-center">
          <Badge variant="outline" className="mx-auto w-fit rounded-full px-4 py-1 text-xs uppercase tracking-[0.35em]">
            Yardura Collective
          </Badge>
          <h1 className="text-4xl font-black text-white md:text-5xl">
            Building pet-first yard and wellness brands
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-slate-100">
            Yardura is the parent company powering InsightScoop, Pupplmnt, Supp Dog, and Once Upon a Lawn. We combine
            field-tested operations, AI-driven insights, and sustainable practices to give pet households the clean yards,
            healthy companions, and premium experiences they deserve.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:hello@yardura.com"
              className="rounded-2xl bg-white/90 px-7 py-4 text-sm font-semibold text-slate-900 shadow-xl backdrop-blur hover:bg-white"
            >
              Partner with Yardura
            </a>
            <Link
              href="https://www.getinsightscoop.com"
              className="rounded-2xl border-2 border-white/70 px-7 py-4 text-sm font-semibold text-white hover:bg-white/10"
            >
              Visit InsightScoop <ArrowRight className="ml-2 inline h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="operations" className="grid gap-6 md:grid-cols-2">
          {PILLARS.map((pillar) => (
            <Card
              key={pillar.title}
              className="rounded-3xl border border-white/10 bg-[#042033]/80 shadow-xl backdrop-blur-xl"
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <pillar.icon className="h-6 w-6 text-emerald-300" />
                <CardTitle className="text-lg font-semibold text-white">{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-white/70">{pillar.copy}</CardContent>
            </Card>
          ))}
        </section>

        <section id="brands" className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-3xl font-black">Our brand portfolio</h2>
            <p className="max-w-xl text-sm text-white/70">
              Each label launches with shared Yardura infrastructure - field ops, logistics, analytics, and customer messaging - so
              teams can obsess over pet outcomes instead of reinventing utilities.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {BRANDS.map((brand) => (
              <Card
                key={brand.name}
                className="rounded-3xl border border-white/10 bg-[#031525]/80 shadow-xl backdrop-blur-xl"
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-white">{brand.name}</CardTitle>
                    <span className="rounded-full border border-emerald-200/40 bg-emerald-300/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
                      {brand.status}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">{brand.description}</p>
                </CardHeader>
                <CardContent>
                  <Link
                    href={brand.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    Explore {brand.name}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="vision" className="space-y-6 text-center">
          <h2 className="text-3xl font-black md:text-4xl">Pet health starts in the yard</h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-white/80">
            Every Yardura brand believes clean, safe outdoor spaces unlock happier, healthier pets. Whether that means spotless
            lawns, science-backed supplements, or next-gen wellness monitoring, we're obsessed with giving families the tools to
            extend their dog's quality of life - and enjoy more time together outdoors.
          </p>
          <div className="mx-auto grid max-w-4xl gap-6 pt-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-4xl font-black text-emerald-300">50K+</div>
              <p className="text-sm text-white/70">Service visits completed across Minneapolis metro</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-black text-emerald-300">98%</div>
              <p className="text-sm text-white/70">Customer satisfaction from InsightScoop members</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-black text-emerald-300">4</div>
              <p className="text-sm text-white/70">Brands launched or in development since 2023</p>
            </div>
          </div>
        </section>

        <section id="infrastructure" className="space-y-6">
          <h2 className="text-center text-3xl font-black">The Yardura infrastructure advantage</h2>
          <p className="mx-auto max-w-3xl text-center text-sm text-white/70">
            Launch faster, operate smarter, and scale confidently with battle-tested systems built for pet-first field services.
          </p>
          <div className="grid gap-6 pt-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-white">Field operations OS</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Route optimization, weather-aware scheduling, gate protocols, and mobile-first technician tools proven across 50,000+ visits.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-white">AI & analytics layer</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Computer vision for waste analysis, predictive health insights, and automated reporting that turns every service into data.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-white">Payment & billing rails</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Stripe-powered recurring billing, flexible subscription tiers, and transparent invoicing that customers actually trust.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-white">Customer messaging hub</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Two-way SMS updates, email automations, and branded notifications keeping pet parents in the loop 24/7.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-white">Brand & design system</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Pre-built landing pages, marketing templates, and a cohesive visual language that ships brands in weeks, not months.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-white">Talent & training pipelines</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Vetted technician hiring, onboarding playbooks, and safety protocols ensuring quality service from day one.
              </p>
            </div>
          </div>
        </section>

        <section id="success-story" className="space-y-6">
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-950/30 p-8 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-300" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Success Story</span>
            </div>
            <h3 className="mb-4 text-2xl font-black text-white">InsightScoop: From concept to 1,000+ customers in 18 months</h3>
            <p className="mb-6 text-base leading-relaxed text-white/80">
              Launched in March 2023, InsightScoop pioneered AI-powered dog waste removal with wellness monitoring. By leveraging
              Yardura's shared infrastructure - field operations, billing systems, and customer messaging - the team focused entirely on
              product innovation and customer experience.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Launch to Market</div>
                <div className="text-3xl font-black text-white">8 weeks</div>
                <p className="text-xs text-white/70">From initial concept to first paying customers</p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Customer Growth</div>
                <div className="text-3xl font-black text-white">1,000+</div>
                <p className="text-xs text-white/70">Active subscribers across Minneapolis metro</p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Retention Rate</div>
                <div className="text-3xl font-black text-white">94%</div>
                <p className="text-xs text-white/70">Monthly customer retention with zero contracts</p>
              </div>
            </div>
          </div>
        </section>

        <section id="journey" className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-black">Your journey with Yardura</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70">
              From initial concept to scaling operations, we provide support at every stage of your brand's evolution.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/20 text-xl font-black text-emerald-300">
                1
              </div>
              <h3 className="text-lg font-bold text-white">Discovery</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Share your vision. We assess fit, identify gaps, and map out the infrastructure you'll need.
              </p>
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/20 text-xl font-black text-emerald-300">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Build</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Leverage existing tech, ops playbooks, and brand templates to launch in weeks instead of months.
              </p>
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/20 text-xl font-black text-emerald-300">
                3
              </div>
              <h3 className="text-lg font-bold text-white">Launch</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Go live with proven systems for billing, scheduling, and customer communication already in place.
              </p>
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/20 text-xl font-black text-emerald-300">
                4
              </div>
              <h3 className="text-lg font-bold text-white">Scale</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Expand to new markets, add services, and grow your team with continuous infrastructure support.
              </p>
            </div>
          </div>
        </section>

        <section id="innovation" className="rounded-3xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl text-center">
            <Leaf className="mx-auto mb-4 h-8 w-8 text-emerald-300" />
            <h2 className="mb-4 text-2xl font-black text-white">Innovation that respects the planet</h2>
            <p className="mb-6 text-base leading-relaxed text-white/80">
              Every Yardura brand commits to sustainable practices - from biodegradable waste solutions to eco-conscious supply chains.
              We believe pet wellness and environmental responsibility aren't mutually exclusive; they're essential partners in creating
              healthier communities.
            </p>
            <div className="flex flex-col gap-3 text-sm text-white/70 sm:flex-row sm:justify-center sm:gap-8">
              <span className="flex items-center justify-center gap-2">
                <Leaf className="h-4 w-4 text-emerald-300" /> Biodegradable materials
              </span>
              <span className="flex items-center justify-center gap-2">
                <Leaf className="h-4 w-4 text-emerald-300" /> Composting partnerships
              </span>
              <span className="flex items-center justify-center gap-2">
                <Leaf className="h-4 w-4 text-emerald-300" /> Carbon-neutral operations
              </span>
            </div>
          </div>
        </section>

        <section id="why-yardura" className="rounded-3xl border border-white/10 bg-[#031829]/85 p-8 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Why operators partner with Yardura</h2>
              <p className="text-sm text-white/70">
                We incubate concepts, provide shared services, and recruit talent so founders can concentrate on product-market fit
                and regional growth.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <span className="flex items-center gap-2 font-semibold text-white">
                <Compass className="h-4 w-4 text-emerald-300" /> Playbooks for logistics, staffing, and weatherproof routes
              </span>
              <span className="flex items-center gap-2 font-semibold text-white">
                <Compass className="h-4 w-4 text-emerald-300" /> Shared analytics + AI layer powering every brand
              </span>
              <span className="flex items-center gap-2 font-semibold text-white">
                <Compass className="h-4 w-4 text-emerald-300" /> Brand, marketing, and CX pipelines ready from day one
              </span>
            </div>
          </div>
        </section>

        <section
          id="partner"
          className="relative rounded-3xl border border-white/20 bg-white/95 p-10 text-center text-slate-900 shadow-2xl backdrop-blur"
        >
          <h2 className="text-3xl font-black text-slate-950">Let’s build the next pet-first experience</h2>
          <p className="mx-auto mt-3 max-w-3xl text-base text-slate-600">
            Whether you need to launch a new service or scale an existing one, Yardura provides the infrastructure - ops playbooks,
            AI analytics, brand strategy, and talent pipelines - to accelerate the journey.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:hello@yardura.com"
              className="rounded-2xl bg-slate-950 px-7 py-4 text-sm font-semibold text-white shadow-lg hover:shadow-xl"
            >
              Schedule a strategy session
            </a>
            <Link
              href="https://cal.com/yardura/partnership"
              className="rounded-2xl border-2 border-slate-950 px-7 py-4 text-sm font-semibold text-slate-950 hover:bg-slate-950 hover:text-white"
            >
              Book a 20-minute intro
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
