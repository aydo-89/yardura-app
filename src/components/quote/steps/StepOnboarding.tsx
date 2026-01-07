"use client";

import React, { useMemo } from "react";
import { motion } from "@/lib/framermotion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepProps } from "@/types/quote";
import { getPremiumOnboardingOptions } from "@/lib/priceEstimator";
import { cn } from "@/lib/utils";
import { quoteSubtleTextClass, quoteSurfaceClass, withQuotePanel, quoteMutedBadgeClass, quoteHeadingClass } from "../quoteStyles";
import { CheckCircle, Sparkles, MapPin, Video } from "lucide-react";

const onboardingCardBase =
  "flex h-full flex-col rounded-2xl border-2 p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40";
const onboardingCardSelected =
  "border-[rgba(20,92,69,0.45)] bg-[rgba(20,92,69,0.08)] text-brand-ink shadow-[0_18px_40px_rgba(243,100,91,0.32)] dark:border-brand-coral/60 dark:bg-brand-coral/15/85 dark:text-cream-vanilla";
const onboardingCardIdle =
  "border-brand-coral/15 bg-cream-vanilla/60 text-brand-ink hover:border-brand-coral/35 hover:bg-cream-vanilla/80 dark:border-brand-coral/35 dark:bg-evergreen-800/80 dark:text-cream-vanilla hover:dark:border-brand-coral/45";

const packages = [
  {
    value: "none",
    title: "Fast-track onboarding",
    price: "Included",
    description: "We schedule your first visit immediately, share prep instructions, and start sending wellness recaps after every scoop.",
    bullets: [
      "Automated scheduling & reminders",
      "Before/after photos on every visit",
      "Instant wellness recap texts",
    ],
    icon: MapPin,
  },
  {
    value: "essential",
    title: "Concierge onboarding",
    price: "$99",
    description: "Jump on a video consult with our concierge team, lock ideal service windows, and get a senior scooper the first week.",
    bullets: [
      "Live video walkthrough before launch",
      "Senior scooper assigned for week one",
      "Personalized prep plan + gated access coaching",
    ],
    icon: Video,
  },
];

export const StepOnboarding: React.FC<StepProps> = ({ quoteData, updateQuoteData }) => {
  const upcoming = useMemo(() => getPremiumOnboardingOptions(), []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24 md:pb-28">
      <Card className={withQuotePanel("space-y-6 text-brand-ink dark:text-cream-vanilla")}>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-normal md:text-lg text-brand-ink dark:text-cream-vanilla">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-brand-coral/15 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <Sparkles className="h-4 w-4" />
            </span>
            Choose your onboarding experience
          </CardTitle>
          <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
            Fast-track is on the house. Upgrade to concierge if you want a video walkthrough, senior scooper, and bespoke launch coaching.
          </p>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            {packages.map((pkg) => {
              const Icon = pkg.icon;
              const selected = quoteData.premiumOnboarding === pkg.value || (!quoteData.premiumOnboarding && pkg.value === "none");

              return (
              <motion.button
                  key={pkg.value}
                  type="button"
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99, y: 0 }}
                  onClick={() => updateQuoteData({ premiumOnboarding: pkg.value })}
                  className={cn(
                    onboardingCardBase,
                    selected ? onboardingCardSelected : onboardingCardIdle,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center rounded-2xl bg-brand-coral/10 p-3 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-serif text-lg font-normal md:text-xl">{pkg.title}</h3>
                          <p className={quoteSubtleTextClass}>{pkg.description}</p>
                        </div>
                        <span className={cn(quoteMutedBadgeClass, "bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla")}>{pkg.price}</span>
                      </div>
                    </div>
                    {selected ? (
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
                        <CheckCircle className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {pkg.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-coral dark:bg-emerald-400" />
                        <span className={quoteSubtleTextClass}>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </motion.button>
              );
            })}
          </div>

          {upcoming.length > 0 ? (
            <div className={cn(
              quoteSurfaceClass,
              "space-y-4 border border-brand-coral/25 bg-brand-coral/8 p-4 text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/80 dark:text-cream-vanilla",
            )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-coral dark:text-cream-vanilla" />
                <p className="text-sm font-semibold">Coming soon</p>
              </div>
              <p className={quoteSubtleTextClass}>
                Reserve early access to advanced onboarding perks launching later this year.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {upcoming.map((option) => (
                  <motion.div
                    key={option.value}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      quoteSurfaceClass,
                      "space-y-3 border-2 border-dashed border-brand-coral/35 bg-brand-coral/8 p-4 text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/60 dark:text-cream-vanilla",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold md:text-base">{option.label}</h3>
                        <p className={quoteSubtleTextClass}>{option.description}</p>
                      </div>
                      <span className={cn(quoteMutedBadgeClass, "bg-white/20 text-white dark:bg-brand-coral/20 dark:text-cream-vanilla")}>Waitlist</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
