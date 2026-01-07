"use client";

import React from "react";
import { useServiceTypeValidation } from "@/hooks/useFormValidation";
import { motion } from "@/lib/framermotion";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Home, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { track } from "@/lib/analytics";
import { StepProps } from "@/types/quote";
import {
  withQuotePanel,
  quoteSubtleTextClass,
  quoteMutedBadgeClass,
} from "../quoteStyles";

const cardBase =
  "group relative flex h-full flex-col rounded-3xl border-2 p-6 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40";
const cardSelected =
  "border-brand-coral/55 bg-brand-coral/8 text-brand-ink shadow-[0_22px_60px_rgba(243,100,91,0.2)] ring-2 ring-brand-coral/40 dark:border-brand-coral/70 dark:bg-brand-coral/15 dark:text-cream-vanilla dark:ring-brand-coral/45";
const cardIdle =
  "border-brand-coral/15 bg-cream-vanilla/60 text-brand-ink hover:border-brand-coral/30 hover:bg-cream-vanilla/80 hover:shadow-[0_12px_32px_rgba(243,100,91,0.08)] dark:border-brand-coral/25 dark:bg-evergreen-800/75 dark:text-cream-vanilla dark:hover:border-brand-coral/45";

export const StepServiceType: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  onNext,
}) => {
  const { handleSubmit, setValue } = useServiceTypeValidation(
    quoteData.serviceType,
  );

  const handleServiceTypeSelect = async (
    serviceType: "residential" | "commercial",
  ) => {
    setValue("serviceType", serviceType);
    updateQuoteData({
      serviceType,
      ...(serviceType === "commercial"
        ? {
            frequency: undefined,
            dogs: undefined,
            yardSize: undefined,
            deepCleanAssessment: undefined,
            areasToClean: {},
            addOns: {},
          }
        : {
            frequency: quoteData.frequency || "weekly",
            dogs: quoteData.dogs || 1,
            yardSize: quoteData.yardSize || "medium",
          }),
    });
    track("service_type_selected", { serviceType });
    onNext?.();
  };
  const onSubmit = async (data: {
    serviceType?: "residential" | "commercial";
  }) => {
    if (data.serviceType) {
      updateQuoteData({ serviceType: data.serviceType });
      track("service_type_selected", { serviceType: data.serviceType });
      onNext?.();
    }
  };

  const isCommercial = quoteData.serviceType === "commercial";
  const isResidential = !isCommercial;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 pb-24 md:pb-28"
    >
      <Card className={withQuotePanel("space-y-6 text-brand-ink dark:text-cream-vanilla")}>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-normal md:text-lg text-brand-ink dark:text-cream-vanilla">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <Building className="size-4" />
            </span>
            Service Type
          </CardTitle>
          <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
            Tell us where we're helping. Residential routes unlock instant pricing; community spaces route to our team for tailored packages.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleServiceTypeSelect("residential")}
              aria-pressed={isResidential}
              className={cn(cardBase, isResidential ? cardSelected : cardIdle)}
            >
              {isResidential ? (
                <span
                  className={cn(
                    quoteMutedBadgeClass,
                    "absolute right-5 top-5 bg-brand-coral/12 text-brand-coral shadow dark:bg-brand-coral/25 dark:text-cream-vanilla",
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                </span>
              ) : null}
              <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
                <Home className="h-7 w-7" />
              </span>
              <div className="mt-5 space-y-3">
                <h3 className="font-serif text-lg font-normal md:text-xl">Residential</h3>
                <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
                  Ideal for single-family homes, condos, and apartments. Instant pricing and flexible visit schedules.
                </p>
                <span className={cn(quoteMutedBadgeClass, "mt-3 w-fit bg-gold/15 text-gold dark:bg-gold/25 dark:text-cream-vanilla")}>Most booked</span>
              </div>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleServiceTypeSelect("commercial")}
              aria-pressed={isCommercial}
              className={cn(cardBase, isCommercial ? cardSelected : cardIdle)}
            >
              {isCommercial ? (
                <span
                  className={cn(
                    quoteMutedBadgeClass,
                    "absolute right-5 top-5 bg-brand-coral/12 text-brand-coral shadow dark:bg-brand-coral/25 dark:text-cream-vanilla",
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                </span>
              ) : null}
              <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
                <Building className="h-7 w-7" />
              </span>
              <div className="mt-5 space-y-3">
                <h3 className="font-serif text-lg font-normal md:text-xl">Community & Commercial</h3>
                <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
                  HOAs, pet amenities, vet clinics, and shared spaces. We'll align visits, staffing, and reporting with your residents.
                </p>
                <span className={cn(quoteMutedBadgeClass, "mt-3 w-fit bg-mint/15 text-mint dark:bg-mint/25 dark:text-cream-vanilla")}>Custom quote & concierge onboarding</span>
              </div>
            </motion.button>
          </div>

          <button type="submit" className="hidden" />
        </CardContent>
      </Card>
    </form>
  );
};
