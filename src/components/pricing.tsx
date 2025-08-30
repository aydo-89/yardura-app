"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Star, ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import {
  estimatePerVisitCents,
  projectedMonthlyCents,
  formatPrice,
  getFrequencyDisplayName,
  type Frequency
} from "@/lib/priceEstimator";

interface PricingCardProps {
  title: string;
  description: string;
  dogs: number;
  frequency: Frequency;
  yardSize: 'small' | 'medium' | 'large' | 'xl';
  popular?: boolean;
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
  addOns = {}
}: PricingCardProps) {
  const perVisitCents = estimatePerVisitCents(dogs, yardSize, frequency);
  const monthlyCents = projectedMonthlyCents(perVisitCents, frequency, addOns);

  return (
    <Card className={`relative ${popular ? 'border-accent shadow-lg scale-105' : 'border-accent/20'}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-accent text-white px-3 py-1">
            <Star className="size-3 mr-1" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">{title}</CardTitle>
        <p className="text-muted text-sm">{description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-ink">
            {formatPrice(perVisitCents)}
          </div>
          <div className="text-sm text-muted">per visit</div>
        </div>

        <div className="text-center text-sm text-muted">
          <div>{formatPrice(monthlyCents)}/month</div>
          <div className="text-xs">({getFrequencyDisplayName(frequency)} service)</div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="size-4 text-accent" />
            <span>{dogs} dog{dogs > 1 ? 's' : ''} included</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="size-4 text-accent" />
            <span>Eco diversion included</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="size-4 text-accent" />
            <span>Health insights included</span>
          </div>
          {addOns.deodorize && (
            <div className="flex items-center gap-2">
              <CheckCircle className="size-4 text-accent" />
              <span>Deodorize & Sanitize (+$5)</span>
            </div>
          )}
          {addOns.litter && (
            <div className="flex items-center gap-2">
              <CheckCircle className="size-4 text-accent" />
              <span>Litter Box Service (+$5)</span>
            </div>
          )}
        </div>

        <Button
          className={`w-full ${popular ? 'bg-accent hover:bg-accent/90' : ''}`}
          variant={popular ? 'default' : 'outline'}
          asChild
        >
          <a href="/quote" data-analytics="cta_pricing_get_quote">
            Get Started
            <ArrowRight className="size-4 ml-2" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Pricing() {
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>('weekly');

  return (
    <section id="pricing" className="container py-16">
      <div className="text-center mb-12">
        <Reveal>
          <h2 className="text-3xl font-extrabold text-ink mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            No hidden fees. Eco diversion and health insights included.
            Billed monthly for completed visits only.
          </p>
        </Reveal>
      </div>

      {/* Frequency Toggle */}
      <Reveal delay={0.1}>
        <div className="flex justify-center mb-8">
          <Tabs value={selectedFrequency} onValueChange={(value) => setSelectedFrequency(value as Frequency)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="biweekly">Every Other Week</TabsTrigger>
              <TabsTrigger value="twice-weekly">Twice Weekly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Reveal>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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

      {/* Add-on Services */}
      <Reveal delay={0.5}>
        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold text-ink mb-4">Add-on Services</h3>
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <Card className="text-center">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-2">Deodorize & Sanitize</h4>
                <p className="text-sm text-muted mb-3">Pet-safe enzymatic treatment</p>
                <div className="text-lg font-bold text-accent">+$5 per visit</div>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-2">Litter Box Service</h4>
                <p className="text-sm text-muted mb-3">Complete litter maintenance</p>
                <div className="text-lg font-bold text-accent">+$5 per visit</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Reveal>

      {/* CTA */}
      <Reveal delay={0.6}>
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-accent-soft/30 to-accent-soft/20 rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold text-ink mb-3">
              Ready to Get Started?
            </h3>
            <p className="text-muted mb-6">
              Get an instant quote with no commitment. Eco-friendly service with health insights included.
            </p>
            <Button size="lg" asChild>
              <a href="/quote" data-analytics="cta_pricing_bottom_get_quote">
                Get Your Quote
                <ArrowRight className="size-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
