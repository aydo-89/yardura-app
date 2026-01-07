"use client";

import React, { useEffect, useMemo } from "react";
import { motion } from "@/lib/framermotion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Building, Home, Check, CheckCircle } from "lucide-react";
import Image from "next/image";

import { StepProps } from "@/types/quote";
import {
  withQuotePanel,
  quoteSubtleTextClass,
  quoteSurfaceClass,
  quoteMutedBadgeClass,
  quoteInputClass,
  quoteFieldLabelClass,
} from "../quoteStyles";
import { brandColors, withAlpha } from "@/shared/brand";
import { useTheme } from "@/components/theme/ThemeProvider";

const sliderInactiveTrackLight = withAlpha(brandColors.coral, 0.18);
const sliderInactiveTrackDark = "rgba(243,100,91,0.3)";

const interactiveCardBase =
  "group flex h-full w-full flex-col justify-between rounded-3xl border-2 p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/50";
const interactiveCardSelected =
  "border-brand-coral/55 bg-brand-coral/8 text-brand-ink shadow-[0_20px_45px_rgba(243,100,91,0.2)] ring-2 ring-brand-coral/50 dark:border-brand-coral/70 dark:bg-brand-coral/15 dark:text-cream-vanilla dark:ring-brand-coral/40";
const interactiveCardIdle =
  "border-brand-coral/15 bg-cream-vanilla/60 text-brand-ink hover:border-brand-coral/35 hover:bg-cream-vanilla/80 hover:shadow-[0_12px_32px_rgba(243,100,91,0.1)] dark:border-brand-coral/25 dark:bg-evergreen-800/80 dark:text-cream-vanilla dark:hover:border-brand-coral/45";

const errorTextClass = "text-sm text-rose-600 dark:text-rose-400";

const residentialPropertyOptions = [
  {
    id: "small",
    label: "Small",
    description: "Townhome, condo, or compact yard",
    icon: "🏡",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Standard single-family home (< 0.5 acre)",
    icon: "🏠",
  },
  {
    id: "large",
    label: "Large",
    description: "Spacious yard, corner lot, or > 0.5 acre",
    icon: "🏘️",
  },
  {
    id: "xl",
    label: "Estate",
    description: "Estate property or multi-acre grounds",
    icon: "🏰",
  },
];

const commercialPropertyOptions = [
  {
    id: "small",
    label: "Small",
    description: "Townhouse, condo, or small complex",
    icon: "🏢",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Standard business or veterinary clinic",
    icon: "🏫",
  },
  {
    id: "large",
    label: "Large",
    description: "Large apartment campus or shared park",
    icon: "🏟️",
  },
  {
    id: "xl",
    label: "Enterprise",
    description: "Major facility or multi-building campus",
    icon: "🏙️",
  },
];

const residentialCleanupOptions = [
  {
    value: 14,
    label: "< 2 weeks",
    description: "Recently cleaned",
  },
  {
    value: 42,
    label: "2–6 weeks",
    description: "Moderate accumulation",
  },
  {
    value: 999,
    label: "> 6 weeks",
    description: "Significant cleanup needed",
  },
];

const commercialCleanupOptions = [
  { value: 1, label: "Weekdays", description: "High-traffic weekday sweeps (Mon–Fri)" },
  {
    value: 3,
    label: "Every few days",
    description: "Moderate traffic, 2–3 cleanups per week",
  },
  {
    value: 7,
    label: "Weekly",
    description: "Standard facilities",
  },
  {
    value: 14,
    label: "Every 2 weeks",
    description: "Lower traffic areas",
  },
  { value: 30, label: "Monthly", description: "Minimal use" },
  {
    value: 90,
    label: "90+ days",
    description: "It’s been awhile – we’ll take extra care",
  },
];

const residentialAreaOptions = [
  { id: "frontYard", label: "Front Yard", icon: "🌳" },
  { id: "backYard", label: "Back Yard", icon: "🏡" },
  { id: "sideYard", label: "Side Yard", icon: "🌿" },
  { id: "dogRun", label: "Dog Run", icon: "🏃" },
  { id: "fencedArea", label: "Additional Fenced Area", icon: "🔒" },
];

// Unified selection styles - use same coral accent as property cards
const selectionCardSelected = interactiveCardSelected;
const selectionCardIdle = interactiveCardIdle;

export const StepBasics: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  errors,
}) => {
  const { theme } = useTheme();
  const sliderInactiveTrack =
    theme === "dark" ? sliderInactiveTrackDark : sliderInactiveTrackLight;
  const isCommercial = quoteData.serviceType === "commercial";

  const propertyOptions = isCommercial
    ? commercialPropertyOptions
    : residentialPropertyOptions;

  const cleanupOptions = isCommercial
    ? commercialCleanupOptions
    : residentialCleanupOptions;

  const defaultResidentialCleanupValue = residentialCleanupOptions[1]?.value ?? 42;

  const selectedResidentialAreasCount = Object.values(quoteData.areasToClean || {}).filter(Boolean).length;

  const residentialDogValue = useMemo(() => {
    if (isCommercial) return 1;
    if (!quoteData.dogs || quoteData.dogs < 1) return 1;
    return Math.min(quoteData.dogs, 4);
  }, [isCommercial, quoteData.dogs]);

  const handleResidentialDogsChange = (value: number) => {
    if (isCommercial) return;
    const normalized = value >= 4 ? 4 : value;
    updateQuoteData({ dogs: normalized });
  };

  const handleCommercialDogsChange = (value: string) => {
    if (!isCommercial) return;
    const parsed = parseInt(value, 10);
    updateQuoteData({ dogs: Number.isFinite(parsed) ? parsed : undefined });
  };

  const handleCleanupSelection = (days: number) => {
    updateQuoteData({
      deepCleanAssessment: {
        daysSinceLastCleanup: days,
      },
    });
  };

  const handleAreaToggle = (areaId: string) => {
    const current = quoteData.areasToClean || {};
    updateQuoteData({
      areasToClean: {
        ...current,
        [areaId]: !current[areaId],
      },
    });
  };

  const handlePropertySelection = (propertyId: string) => {
    updateQuoteData({ yardSize: propertyId as any });
  };

  // Default residential customers to the "2–6 weeks" bucket when state is missing or legacy values persist
  useEffect(() => {
    if (isCommercial) return;

    const currentValue = quoteData.deepCleanAssessment?.daysSinceLastCleanup;
    const hasValidSelection =
      typeof currentValue === "number" &&
      residentialCleanupOptions.some((option) => option.value === currentValue);

    if (!hasValidSelection) {
      updateQuoteData({
        deepCleanAssessment: {
          daysSinceLastCleanup: defaultResidentialCleanupValue,
        },
      });
    }
  }, [
    isCommercial,
    quoteData.deepCleanAssessment?.daysSinceLastCleanup,
    updateQuoteData,
    defaultResidentialCleanupValue,
  ]);

  const displayErrors = errors || {};

  const SectionHeading = ({ step, text }: { step: number; text: string }) => (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-coral/15 font-serif text-xl font-normal text-brand-coral dark:bg-brand-coral/25 dark:text-brand-coral dark:ring-1 dark:ring-brand-coral/40">
        {step}
      </span>
      <span className="font-serif text-base font-normal text-brand-ink md:text-lg dark:text-cream-vanilla">{text}</span>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24 md:pb-28">
      <Card className={withQuotePanel("w-full text-brand-ink dark:text-cream-vanilla")}>
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-normal md:text-lg">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <MapPin className="size-4" />
            </span>
            Property Details
          </CardTitle>
          <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
            {isCommercial
              ? "Tell us about your shared space so we can tailor routing, on-site protocols, and reporting."
              : "We’ll personalize pricing for your yard, pups, and cleaning cadence."
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={cn(quoteSurfaceClass, "flex items-center gap-3 p-4 text-brand-ink dark:text-cream-vanilla")}
          >
            <div className="inline-flex size-12 flex-none items-center justify-center rounded-2xl bg-[rgba(20,92,69,0.12)] text-brand-coral dark:bg-brand-coral/15/80 dark:text-cream-vanilla">
              {isCommercial ? <Building className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            </div>
            <div>
                <p className="font-semibold">
                  {isCommercial ? "Community Service" : "Residential Service"}
                </p>
                <p className={cn("text-sm", quoteSubtleTextClass)}>
                  {isCommercial
                    ? "Perfect for HOAs, apartments, and shared spaces."
                    : "Professional pet waste removal for your home."
                  }
                </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <SectionHeading
                step={1}
                text={
                  isCommercial
                    ? "Expected number of dogs *"
                    : "How many dogs?"
                }
              />
              <p className={cn("text-sm", quoteSubtleTextClass)}>
                {isCommercial
                  ? "Estimate the number of dogs using this area on a typical day."
                  : "We’ll adjust pricing based on how many pups we’ll be picking up after."
                }
              </p>

              {isCommercial ? (
                <Input
                  type="number"
                  min={1}
                  max={500}
                  placeholder="e.g., 50"
                  value={quoteData.dogs || ""}
                  onChange={(event) => handleCommercialDogsChange(event.target.value)}
                  className={cn(quoteInputClass, "mt-2 h-12 text-lg")}
                />
              ) : (
                <div className="mt-3">
                  <Slider
                    min={1}
                    max={4}
                    step={1}
                    value={residentialDogValue}
                    onValueChange={handleResidentialDogsChange}
                    className="mx-1"
                    showValue={false}
                    activeColor="rgba(20,92,69,1)"
                    inactiveColor={sliderInactiveTrack}
                    thumbClassName="border-white bg-gradient-to-r from-[#145c45] to-[#0f4733] dark:border-brand-coral/40"
                  />
                  <p className="mt-2 font-serif text-2xl font-bold text-brand-ink dark:text-cream-vanilla">
                    {residentialDogValue === 4
                      ? "4+ dogs"
                      : `${residentialDogValue} dog${residentialDogValue > 1 ? "s" : ""}`}
                  </p>
                </div>
              )}

              {displayErrors.dogs && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-rose-600"
                >
                  {displayErrors.dogs}
                </motion.p>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeading
                step={2}
                text={
                  isCommercial
                    ? "Property size *"
                    : "What’s your place like?"
                }
              />
              <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(isCommercial ? commercialPropertyOptions : residentialPropertyOptions).map((option) => {
                  const isSelected = quoteData.yardSize === option.id;
                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePropertySelection(option.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        interactiveCardBase,
                        "items-center text-center",
                        isSelected ? interactiveCardSelected : interactiveCardIdle,
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-2xl">{option.icon}</div>
                        <div className="font-serif text-base font-normal md:text-lg">
                          {option.label}
                        </div>
                        <p className={cn("text-xs leading-relaxed", quoteSubtleTextClass)}>
                          {option.description}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className={cn(quoteMutedBadgeClass, "mt-3 inline-flex items-center gap-1")}> <Check className="h-3.5 w-3.5" /> Selected </span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
              {displayErrors.yardSize && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-rose-600"
                >
                  {displayErrors.yardSize}
                </motion.p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeading
              step={3}
              text={
                isCommercial
                  ? "Current cleanup situation"
                  : "When was your yard last cleaned?"
              }
            />
            <p className={cn("text-sm", quoteSubtleTextClass)}>
              {isCommercial
                ? "Helps us understand the level of service your property needs."
                : "We’ll use this to determine the one-time initial clean."
            }
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(isCommercial ? commercialCleanupOptions : residentialCleanupOptions).map((option) => {
                const isSelected =
                  quoteData.deepCleanAssessment?.daysSinceLastCleanup === option.value;
                return (
                    <motion.button
                      key={option.value}
                      type="button"
                      aria-pressed={isSelected}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        interactiveCardBase,
                        "items-start",
                        isSelected ? selectionCardSelected : selectionCardIdle,
                      )}
                      onClick={() => handleCleanupSelection(option.value)}
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-serif text-base font-normal text-brand-ink md:text-lg dark:text-cream-vanilla">
                          {option.label}
                        </p>
                        <p className={cn("text-xs", quoteSubtleTextClass)}>{option.description}</p>
                      </div>
                      {isSelected ? (
                        <Check className="h-4 w-4 flex-shrink-0 text-brand-coral dark:text-cream-vanilla" />
                      ) : null}
                    </div>
                  </motion.button>
                );
              })}
            </div>
            {displayErrors.deepCleanAssessment && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-rose-600"
              >
                {displayErrors.deepCleanAssessment}
              </motion.p>
            )}
          </div>

          {!isCommercial && (
            <div className="space-y-3">
              <SectionHeading step={4} text="Areas to clean" />
              <p className={cn("text-sm", quoteSubtleTextClass)}>
                Select every area where we should clean up.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {residentialAreaOptions.map((area) => {
                  const selectedCount = selectedResidentialAreasCount;
                  const isSelected = Boolean(quoteData.areasToClean?.[area.id]);
                  const showAddonHint = selectedCount > 0 && !isSelected;
                  return (
                    <motion.button
                      key={area.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAreaToggle(area.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        interactiveCardBase,
                        "items-center text-center",
                        isSelected ? selectionCardSelected : selectionCardIdle,
                      )}
                    >
                      <div className="text-xl">{area.icon}</div>
                      <p className="mt-1 font-serif text-base font-normal text-brand-ink dark:text-cream-vanilla md:text-lg">
                        {area.label}
                      </p>
                      {showAddonHint ? (
                <span
                          className={cn(
                            quoteMutedBadgeClass,
                            "mt-2 inline-flex bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla",
                          )}
                        >
                          Add area (+$3/visit)
                        </span>
                      ) : null}
                      {isSelected ? (
                        <CheckCircle className="mt-2 h-4 w-4 text-brand-coral dark:text-cream-vanilla" />
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
              {displayErrors.areasToClean && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-rose-500"
                >
                  {displayErrors.areasToClean}
                </motion.p>
              )}
            </div>
          )}

          {isCommercial && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.18em]",
                    quoteFieldLabelClass,
                  )}
                >
                  Business type *
                </Label>
                <Select
                  value={quoteData.businessType || ""}
                  onValueChange={(value) => updateQuoteData({ businessType: value })}
                >
                  <SelectTrigger
                    className={cn(quoteInputClass, "mt-2 text-left text-sm")}
                  >
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog-park">Dog park or recreation area</SelectItem>
                    <SelectItem value="veterinary">Veterinary clinic / hospital</SelectItem>
                    <SelectItem value="grooming">Grooming salon</SelectItem>
                    <SelectItem value="boarding">Boarding or daycare facility</SelectItem>
                    <SelectItem value="hotel">Pet hotel or resort</SelectItem>
                    <SelectItem value="training">Training facility</SelectItem>
                    <SelectItem value="retail">Pet retail store</SelectItem>
                    <SelectItem value="other">Other commercial facility</SelectItem>
                  </SelectContent>
                </Select>
                {displayErrors.businessType && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm text-rose-600 mt-1"
                  >
                    {displayErrors.businessType}
                  </motion.p>
                )}
              </div>

              <div>
                <Label
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.18em]",
                    quoteFieldLabelClass,
                  )}
                >
                  Typical service frequency
                </Label>
                <Select
                  value={quoteData.serviceFrequency || ""}
                  onValueChange={(value) => updateQuoteData({ serviceFrequency: value })}
                >
                  <SelectTrigger
                    className={cn(quoteInputClass, "mt-2 text-left text-sm")}
                  >
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">
                      <div className="flex flex-col">
                        <span>Daily</span>
                        <span className={cn("text-xs", quoteSubtleTextClass)}>Mon–Fri coverage</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="multiple-daily">Multiple times daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="as-needed">As needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};
