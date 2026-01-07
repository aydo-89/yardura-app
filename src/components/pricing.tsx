"use client";

import Image from "next/image";
import { motion } from "@/lib/framermotion";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Star, ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { track } from "@/lib/analytics";
import { brandColors, withAlpha } from "@/shared/brand";
import {
  calculateCompletePricing,
  formatPrice,
  getFrequencyDisplayName,
  type Frequency,
  type DogCount,
} from "@/lib/pricing-client";
import { useTheme } from "./theme/ThemeProvider";

const FREQUENCY_ACCENTS: Record<Frequency, string> = {
  weekly: brandColors.mint,
  biweekly: brandColors.gold,
  "twice-weekly": brandColors.coral,
  daily: brandColors.sunset,
  monthly: brandColors.gold,
  onetime: brandColors.coralInk,
};

interface PricingCardProps {
  title: string;
  description: string;
  dogs: DogCount;
  frequency: Frequency;
  yardSize: "small" | "medium" | "large" | "xl";
  popular?: boolean;
  selectedFrequency?: Frequency;
  addOns?: {
    deodorize?: boolean;
    litter?: boolean;
  };
}

function PricingCard({
  title,
  description,
  dogs,
  frequency,
  yardSize,
  popular = false,
  selectedFrequency = "weekly",
  addOns = {},
}: PricingCardProps) {
  const [perVisitCents, setPerVisitCents] = useState(0);
  const [monthlyCents, setMonthlyCents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPricing() {
      setIsLoading(true);
      try {
        const pricing = await calculateCompletePricing({
          dogs,
          yardSize,
          frequency,
          addons: {
            deodorize: addOns.deodorize,
            // Note: For pricing display, we don't know the mode, so default to each-visit
            deodorizeMode: addOns.deodorize ? "each-visit" : undefined,
          },
        });
        setPerVisitCents(pricing.perVisitCents);
        setMonthlyCents(pricing.monthlyCents);
      } catch (error) {
        console.error('Error loading pricing:', error);
        // Fallback to basic calculation
        const fallbackPerVisit = dogs * 20 * 100; // Rough estimate
        setPerVisitCents(fallbackPerVisit);
        setMonthlyCents(fallbackPerVisit * 4); // Weekly estimate
      } finally {
        setIsLoading(false);
      }
    }

    loadPricing();
  }, [dogs, yardSize, frequency, addOns]);

  const accentColor = FREQUENCY_ACCENTS[frequency] ?? brandColors.evergreen;

  return (
    <Card
      className="relative rounded-[32px] border border-white/15 bg-white/5 text-white shadow-[0_28px_60px_rgba(3,7,6,0.55)] transition-all duration-300 backdrop-blur"
      style={{
        borderColor: withAlpha(accentColor, popular ? 0.6 : 0.38),
        boxShadow: popular
          ? `0 32px 68px ${withAlpha(accentColor, 0.35)}`
          : `0 24px 58px ${withAlpha(accentColor, 0.2)}`,
        transform: popular ? "translateY(-4px)" : undefined,
      }}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <Badge
            className="px-4 py-2 shadow-2xl font-bold backdrop-blur rounded-full"
            style={{
              backgroundColor: withAlpha(accentColor, 0.22),
              borderColor: withAlpha(accentColor, 0.4),
              color: brandColors.coralInk,
            }}
          >
            <Star className="size-4 mr-1 fill-current" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-bold text-white">
          {title}
        </CardTitle>
        <p className="text-white/70 text-sm leading-relaxed">{description}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="text-center">
          <div
            className="text-4xl font-black mb-1"
            style={{ color: frequency === "weekly" ? brandColors.mint : accentColor }}
          >
            {isLoading ? (
              <div className="animate-pulse bg-slate-200 h-8 w-16 rounded mx-auto"></div>
            ) : (
              formatPrice(perVisitCents)
            )}
          </div>
          <div className="text-sm text-white/70 font-medium">per visit</div>
        </div>

          <div
            className="text-center text-sm rounded-xl p-3 border"
            style={{
              backgroundColor: withAlpha(frequency === "weekly" ? brandColors.mint : accentColor, 0.14),
              borderColor: withAlpha(frequency === "weekly" ? brandColors.mint : accentColor, 0.3),
              color: frequency === "weekly" ? brandColors.mint : accentColor,
            }}
          >
          <div className="font-semibold text-white">
            {isLoading ? (
              <div className="animate-pulse bg-slate-200 h-4 w-20 rounded mx-auto"></div>
            ) : (
              `${formatPrice(monthlyCents)}/month`
            )}
          </div>
          <div className="text-xs font-medium">
            ({getFrequencyDisplayName(frequency)} service)
          </div>
        </div>

        <div className="space-y-3">
          <div
            className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200"
            style={{ backgroundColor: withAlpha(accentColor, 0.08) }}
          >
            <CheckCircle className="size-5 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-sm text-white/75 font-medium">
              {dogs} dog{dogs > 1 ? "s" : ""} included
            </span>
          </div>

          <div
            className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200"
            style={{ backgroundColor: withAlpha(accentColor, 0.08) }}
          >
            <CheckCircle className="size-5 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-sm text-white/75 font-medium">
              Visit recap link + gate photo included
            </span>
          </div>
          <div
            className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200"
            style={{ backgroundColor: withAlpha(accentColor, 0.08) }}
          >
            <CheckCircle className="size-5 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-sm text-white/75 font-medium">
              Stool health notes included
            </span>
          </div>
          <div
            className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200"
            style={{ backgroundColor: withAlpha(accentColor, 0.08) }}
          >
            <CheckCircle className="size-5 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-sm text-white/75 font-medium">
              Cancel or pause anytime
            </span>
          </div>
          {addOns.deodorize && (
            <div
              className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200"
              style={{ backgroundColor: withAlpha(accentColor, 0.08) }}
            >
              <CheckCircle className="size-5 flex-shrink-0" style={{ color: accentColor }} />
              <span className="text-sm text-white/75 font-medium">
                Deodorize & Sanitize
              </span>
            </div>
          )}
          {addOns.litter && (
            <div
              className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200"
              style={{ backgroundColor: withAlpha(accentColor, 0.08) }}
            >
              <CheckCircle className="size-5 flex-shrink-0" style={{ color: accentColor }} />
              <span className="text-sm text-white/75 font-medium">
                Litter Box Service
              </span>
            </div>
          )}
        </div>

        <Button
          size="lg"
          variant="ghost"
          className={`w-full rounded-xl transition-all duration-300 ${
            popular
              ? "btn-cta-primary"
              : "border border-white/25 bg-white/10 text-white hover:bg-white/18"
          }`}
          asChild
        >
          <a
            href="/quote?businessId=yardura"
            data-analytics="cta_pricing_get_quote"
            onClick={() =>
              track("cta_pricing_get_quote", {
                dogs,
                frequency,
                yardSize,
                popular,
              })
            }
          >
            Get my quote
            <ArrowRight className="size-4 ml-2" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Pricing() {
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>("weekly");
  const frequencyAccent = FREQUENCY_ACCENTS[selectedFrequency] ?? brandColors.evergreen;
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
        ? { desktop: "/hero_backgrounds/arlo_coral_right_dark.jpeg", mobile: "/hero_backgrounds/arlo_coral_right_dark.jpeg" }
        : { desktop: "/hero_backgrounds/arlo_coral_right_light.jpeg", mobile: "/hero_backgrounds/arlo_coral_right_light.jpeg" };
    return isMobile ? base.mobile : base.desktop;
  }, [theme, isMobile]);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(155deg, rgba(8,16,12,0.62) 0%, rgba(10,20,14,0.54) 50%, rgba(12,24,16,0.46) 100%)";
    }
    return "linear-gradient(155deg, rgba(7,11,8,0.3) 0%, rgba(8,16,12,0.28) 50%, rgba(10,18,12,0.26) 100%)";
  }, [theme]);

  const backgroundColor = theme === "dark" ? "#050b08" : "#f8f5ee";

  return (
    <section
      id="pricing"
      className="landing-section section-modern relative overflow-hidden"
      style={{ backgroundColor }}
    >
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Pet parent reviewing InsightScoop pricing options"
          fill
          loading="eager"
          className="object-cover"
          sizes="100vw"
          style={{ objectPosition: "55% center" }}
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

      <div className="container relative z-10 py-20 text-white">
        <div className="text-center mb-16">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
              <CheckCircle className="size-4 text-brand-mint" />
              No contracts • No surprises
            </div>
            <h2 className="mt-6 text-5xl font-serif leading-tight md:text-6xl">
              Simple pricing. Premium service.
            </h2>
            <p className="mt-4 text-lg text-white/85 max-w-3xl mx-auto text-balance">
              Pricing is based on dogs, yard size, and cadence. Every plan includes consistent scooping plus a recap link with stool health notes. A dashboard view is coming in 2026.
            </p>
          </Reveal>
        </div>

        {/* Frequency Toggle */}
        <Reveal delay={0.1}>
          <div className="flex flex-col items-center justify-center mb-12 space-y-6">
            <Tabs
              value={selectedFrequency}
              onValueChange={(value) => setSelectedFrequency(value as Frequency)}
            >
              <TabsList className="flex w-full max-w-3xl bg-[rgba(12,24,18,0.78)] p-2 rounded-2xl border border-white/20 shadow-[0_18px_40px_rgba(3,7,6,0.5)] gap-1">
                <TabsTrigger
                  value="daily"
                  className="flex-1 rounded-xl py-2 px-4 text-xs font-medium transition-all duration-200 border border-transparent data-[state=active]:border-white/25 data-[state=active]:bg-white/12 data-[state=active]:text-white data-[state=inactive]:text-white/65 data-[state=inactive]:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[rgba(255,194,77,0.35)] focus:ring-offset-0"
                >
                  Daily (Mon–Fri)
                </TabsTrigger>
                <TabsTrigger
                  value="twice-weekly"
                  className="flex-1 rounded-xl py-2 px-4 text-xs font-medium transition-all duration-200 border border-transparent data-[state=active]:border-white/25 data-[state=active]:bg-white/12 data-[state=active]:text-white data-[state=inactive]:text-white/65 data-[state=inactive]:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[rgba(255,194,77,0.35)] focus:ring-offset-0"
                >
                  2x Weekly
                </TabsTrigger>
                <TabsTrigger
                  value="weekly"
                  className="flex-1 rounded-xl py-2 px-4 text-xs font-medium transition-all duration-200 border border-transparent data-[state=active]:border-white/25 data-[state=active]:bg-white/12 data-[state=active]:text-white data-[state=inactive]:text-white/65 data-[state=inactive]:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[rgba(255,194,77,0.35)] focus:ring-offset-0"
                >
                  Weekly
                </TabsTrigger>
                <TabsTrigger
                  value="biweekly"
                  className="flex-1 rounded-xl py-2 px-4 text-xs font-medium transition-all duration-200 border border-transparent data-[state=active]:border-white/25 data-[state=active]:bg-white/12 data-[state=active]:text-white data-[state=inactive]:text-white/65 data-[state=inactive]:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[rgba(255,194,77,0.35)] focus:ring-offset-0"
                >
                  Every 2 Weeks
                </TabsTrigger>
                <TabsTrigger
                  value="monthly"
                  className="flex-1 rounded-xl py-2 px-4 text-xs font-medium transition-all duration-200 border border-transparent data-[state=active]:border-white/25 data-[state=active]:bg-white/12 data-[state=active]:text-white data-[state=inactive]:text-white/65 data-[state=inactive]:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[rgba(255,194,77,0.35)] focus:ring-offset-0"
                >
                  Monthly
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Frequency description - appears below the tabs */}
            <div className="w-full max-w-lg">
              {selectedFrequency === "daily" && (
                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    backgroundColor: withAlpha(frequencyAccent, 0.12),
                    borderColor: withAlpha(frequencyAccent, 0.28),
                  }}
                >
                  <p className="text-sm text-white text-center leading-relaxed font-medium">
                    Mon–Fri visits for multi-dog homes that want a clean yard every day.
                  </p>
                </div>
              )}
              {selectedFrequency === "biweekly" && (
                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    backgroundColor: withAlpha(frequencyAccent, 0.12),
                    borderColor: withAlpha(frequencyAccent, 0.28),
                  }}
                >
                  <p className="text-sm text-white text-center leading-relaxed font-medium">
                    Budget-friendly rhythm with more buildup between visits.
                  </p>
                </div>
              )}
              {selectedFrequency === "twice-weekly" && (
                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    backgroundColor: withAlpha(frequencyAccent, 0.12),
                    borderColor: withAlpha(frequencyAccent, 0.28),
                  }}
                >
                  <p className="text-sm text-white text-center leading-relaxed font-medium">
                    Great for busy yards—stays consistently clean.
                  </p>
                </div>
              )}
              {selectedFrequency === "monthly" && (
                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    backgroundColor: withAlpha(frequencyAccent, 0.12),
                    borderColor: withAlpha(frequencyAccent, 0.28),
                  }}
                >
                  <p className="text-sm text-white text-center leading-relaxed font-medium">
                    Seasonal tune-up to reset the yard when you need it.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-3">
          <Reveal delay={0.2}>
            <PricingCard
              title="1 Dog"
              description="Perfect for single pet households"
              dogs={1}
              frequency={selectedFrequency}
              yardSize="medium"
            />
          </Reveal>

          <Reveal delay={0.3}>
            <PricingCard
              title="2 Dogs"
              description="Great for multi-pet families"
              dogs={2}
              frequency={selectedFrequency}
              yardSize="medium"
              popular={true}
            />
          </Reveal>

          <Reveal delay={0.4}>
            <PricingCard
              title="3+ Dogs"
              description="Contact us for larger households"
              dogs={3}
              frequency={selectedFrequency}
              yardSize="medium"
            />
          </Reveal>
        </div>

        {/* CTA */}
        <Reveal delay={0.6}>
          <div className="mt-20 text-center">
            <div className="rounded-3xl p-10 max-w-4xl mx-auto border border-white/18 bg-[rgba(12,24,18,0.8)] shadow-[0_32px_72px_rgba(3,7,6,0.6)]">
              <h3 className="text-responsive-2xl font-serif text-white mb-4 text-balance">
                Ready for a clean yard + a simple recap?
              </h3>
              <p className="text-white/78 text-lg mb-8 leading-relaxed max-w-2xl mx-auto text-balance">
                Quotes take 60 seconds. Billing only after completed visits. Pause anytime, upgrade whenever you want.
              </p>
              <Button
                size="lg"
                className="btn-cta-primary text-lg px-8 py-4"
                asChild
              >
                <a
                  href="/quote?businessId=yardura"
                  data-analytics="cta_pricing_bottom_get_quote"
                  onClick={() => track("cta_pricing_bottom_get_quote")}
                >
                  Get my quote
                  <ArrowRight className="size-5 ml-2" />
                </a>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
