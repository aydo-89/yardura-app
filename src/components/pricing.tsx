"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Star, ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { track } from "@/lib/analytics";
import {
  estimatePerVisitCents,
  projectedMonthlyCents,
  formatPrice,
  getFrequencyDisplayName,
  type Frequency,
  type DogCount,
} from "@/lib/priceEstimator";

interface PricingCardProps {
  title: string;
  description: string;
  dogs: DogCount;
  frequency: Frequency;
  yardSize: "small" | "medium" | "large" | "xl";
  popular?: boolean;
  color?: "emerald" | "teal" | "cyan" | "green";
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
  color = "green",
  selectedFrequency = "weekly",
  addOns = {},
}: PricingCardProps) {
  const perVisitCents = estimatePerVisitCents(dogs, yardSize, frequency);
  const monthlyCents = projectedMonthlyCents(perVisitCents, frequency, addOns);

  // Get enhanced color variations for more visual distinction
  const getColorClasses = (color: string, popular: boolean) => {
    const baseClasses = "relative overflow-visible interactive-hover";
    const popularClasses = popular ? "card-elevated scale-105" : "card-modern";

    switch (color) {
      case "emerald":
        return `${baseClasses} ${popularClasses} ${popular ? "border-emerald-400/60 shadow-emerald-100/60 bg-gradient-to-br from-emerald-50/20 to-emerald-100/10" : "border-emerald-300/50 bg-gradient-to-br from-emerald-50/10 to-emerald-100/5"}`;
      case "green":
        return `${baseClasses} ${popularClasses} ${popular ? "border-green-500/60 shadow-green-100/60 bg-gradient-to-br from-green-50/20 to-green-100/10" : "border-green-400/50 bg-gradient-to-br from-green-50/10 to-green-100/5"}`;
      case "teal":
        return `${baseClasses} ${popularClasses} ${popular ? "border-teal-400/60 shadow-teal-100/60 bg-gradient-to-br from-teal-50/20 to-teal-100/10" : "border-teal-300/50 bg-gradient-to-br from-teal-50/10 to-teal-100/5"}`;
      default:
        return `${baseClasses} ${popularClasses} ${popular ? "border-slate-400/60 shadow-slate-100/60 bg-gradient-to-br from-slate-50/20 to-slate-100/10" : "border-slate-300/50 bg-gradient-to-br from-slate-50/10 to-slate-100/5"}`;
    }
  };

  return (
    <Card className={getColorClasses(color, popular)}>
      {popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-br from-green-700 to-green-600 text-white px-4 py-2 shadow-2xl font-bold border-2 border-white/80 backdrop-blur-sm">
            <Star className="size-4 mr-1 fill-current" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-bold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="text-gradient text-4xl font-black mb-1">
            {formatPrice(perVisitCents)}
          </div>
          <div className="text-sm text-slate-600 font-medium">per visit</div>
        </div>

        <div
          className={`text-center text-sm text-slate-600 rounded-xl p-3 border ${
            color === "emerald"
              ? "bg-emerald-50/70 border-emerald-200/50"
              : color === "green"
                ? "bg-green-50/70 border-green-200/50"
                : color === "teal"
                  ? "bg-teal-50/70 border-teal-200/50"
                  : "bg-slate-50/70 border-slate-200/50"
          }`}
        >
          <div className="font-semibold text-slate-900">
            {formatPrice(monthlyCents)}/month
          </div>
          <div className="text-xs font-medium">
            ({getFrequencyDisplayName(frequency)} service)
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50/50 transition-colors duration-200">
            <CheckCircle className="size-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-slate-700 font-medium">
              {dogs} dog{dogs > 1 ? "s" : ""} included
            </span>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50/50 transition-colors duration-200">
            <CheckCircle className="size-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-slate-700 font-medium">
              Health insights included
            </span>
          </div>
          {addOns.deodorize && (
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-teal-700-soft/30 transition-colors duration-200">
              <CheckCircle className="size-5 text-green-600 flex-shrink-0" />
              <span className="text-sm text-slate-700 font-medium">
                Deodorize & Sanitize (+$5)
              </span>
            </div>
          )}
          {addOns.litter && (
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-teal-700-soft/30 transition-colors duration-200">
              <CheckCircle className="size-5 text-green-600 flex-shrink-0" />
              <span className="text-sm text-slate-700 font-medium">
                Litter Box Service (+$5)
              </span>
            </div>
          )}
        </div>

        <Button
          className={`w-full ${popular ? "btn-cta-primary" : "btn-cta-secondary"} interactive-press`}
          variant={popular ? "default" : "outline"}
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
            Get Started
            <ArrowRight className="size-4 ml-2" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Pricing() {
  const [selectedFrequency, setSelectedFrequency] =
    useState<Frequency>("weekly");

  return (
    <section id="pricing" className="section-modern gradient-section-cool">
      <div className="container">
        <div className="text-center mb-16">
          <Reveal>
            <div className="relative">
              <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
                Simple{" "}
                <span className="relative">
                  Pricing
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-cyan-700 via-cyan-600 to-white rounded-full"></div>
                </span>
              </h2>
            </div>
            <p className="text-responsive-lg text-slate-600 max-w-3xl mx-auto leading-relaxed text-balance">
              No hidden fees. Health insights included. Premium eco diversion
              options available. Billed monthly for completed visits only.
            </p>
          </Reveal>
        </div>

        {/* Frequency Toggle */}
        <Reveal delay={0.1}>
          <div className="flex flex-col items-center justify-center mb-12 space-y-6">
            <Tabs
              value={selectedFrequency}
              onValueChange={(value) =>
                setSelectedFrequency(value as Frequency)
              }
            >
              <TabsList className="flex w-full max-w-lg bg-slate-100/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/40 shadow-card gap-1">
                <TabsTrigger
                  value="weekly"
                  className="flex-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-md data-[state=active]:font-bold text-slate-700 hover:text-slate-900 data-[state=inactive]:hover:bg-emerald-50/50 data-[state=inactive]:hover:text-emerald-700 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:outline-none font-medium transition-all duration-300 rounded-xl py-2 px-4 text-xs"
                >
                  Weekly
                </TabsTrigger>
                <TabsTrigger
                  value="biweekly"
                  className="flex-1 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-md data-[state=active]:font-bold text-slate-700 hover:text-slate-900 data-[state=inactive]:hover:bg-teal-50/50 data-[state=inactive]:hover:text-teal-700 focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 focus:outline-none font-medium transition-all duration-300 rounded-xl py-2 px-4 text-xs"
                >
                  Every 2 Weeks
                </TabsTrigger>
                <TabsTrigger
                  value="twice-weekly"
                  className="flex-1 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700 data-[state=active]:shadow-md data-[state=active]:font-bold text-slate-700 hover:text-slate-900 data-[state=inactive]:hover:bg-cyan-50/50 data-[state=inactive]:hover:text-cyan-700 focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none font-medium transition-all duration-300 rounded-xl py-2 px-4 text-xs"
                >
                  2x Weekly
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Frequency description - appears below the tabs */}
            <div className="w-full max-w-lg">
              {selectedFrequency === "biweekly" && (
                <div className="bg-teal-50/70 border border-teal-200/30 rounded-2xl p-4">
                  <p className="text-sm text-teal-800 text-center leading-relaxed font-medium">
                    Higher per-visit due to accumulation • Fewer visits save you
                    money overall
                  </p>
                </div>
              )}
              {selectedFrequency === "twice-weekly" && (
                <div className="bg-cyan-50/70 border border-cyan-200/30 rounded-2xl p-4">
                  <p className="text-sm text-cyan-800 text-center leading-relaxed font-medium">
                    Slight discount for route efficiency
                  </p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* Pricing Cards */}
        <div className="grid-cards">
          <Reveal delay={0.2}>
            <PricingCard
              title="1 Dog"
              description="Perfect for single pet households"
              dogs={1}
              frequency={selectedFrequency}
              yardSize="medium"
              color="emerald"
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
              color="green"
            />
          </Reveal>

          <Reveal delay={0.4}>
            <PricingCard
              title="3+ Dogs"
              description="Contact us for larger households"
              dogs={3}
              frequency={selectedFrequency}
              yardSize="medium"
              color="teal"
            />
          </Reveal>
        </div>

        {/* CTA */}
        <Reveal delay={0.6}>
          <div className="mt-20 text-center">
            <div className="bg-white rounded-3xl p-10 max-w-4xl mx-auto shadow-floating border border-green-700/10">
              <h3 className="text-responsive-2xl font-bold text-slate-900 mb-4 text-balance">
                Ready to Get <span className="text-gradient">Started?</span>
              </h3>
              <p className="text-slate-600 text-lg mb-8 leading-relaxed max-w-2xl mx-auto text-balance">
                Get an instant quote with no commitment. Eco-friendly service
                with health insights included. Premium diversion options
                available for maximum environmental impact.
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
                  Get Your Quote
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
