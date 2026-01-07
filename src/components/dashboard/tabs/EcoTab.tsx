"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Leaf,
  Recycle,
  Wind,
  TreePine,
  Droplets,
  Car,
  Trash2,
  TrendingUp,
  Info,
  Sparkles,
  ArrowRight,
  Zap,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  DashboardServiceVisit,
  DashboardDataReading,
  ServiceSummary,
} from "../types";
import {
  calculateCompletePricing,
  formatPrice,
  type Frequency,
  type YardSize,
} from "@/lib/pricing-client";

interface EcoTabProps {
  serviceVisits: DashboardServiceVisit[];
  dataReadings: DashboardDataReading[];
  dogsCount: number;
  frequency: string;
  divertMode: string | null; // none | takeaway | compost
  serviceSummary?: ServiceSummary | null;
}

/**
 * Research-based environmental impact calculations for dog waste diversion
 * 
 * Sources and assumptions:
 * 1. Average dog produces 0.5 lbs (227g) of waste per day
 *    - Source: EPA, USDA studies on pet waste
 * 
 * 2. Weekly service collects ~7 days of waste per dog per visit
 *    We log the exact number of deposits collected each week for accuracy.
 * 
 * 3. Methane emissions from landfill decomposition:
 *    - Dog waste produces ~0.02 kg CH4 per kg waste in landfills
 *    - Source: Various composting and waste management studies
 * 
 * 4. CO2 equivalent: Methane has 25x global warming potential of CO2
 *    - 1 kg CH4 = 25 kg CO2 equivalent
 *    - Source: EPA, IPCC
 * 
 * 5. Tree CO2 absorption: A mature tree absorbs ~48 lbs CO2 per year
 *    - Source: Arbor Day Foundation, US Forest Service
 * 
 * 6. Car emissions: Average car emits ~0.89 lbs CO2 per mile
 *    - Source: EPA (average passenger vehicle)
 * 
 * 7. Composting benefit: Reduces methane emissions by ~80% vs landfill
 * 
 * 8. Water pollution: Dog waste contains harmful bacteria (E. coli, fecal coliform)
 *    - 1 gram of dog waste contains ~23 million fecal coliform bacteria
 *    - Source: EPA, various water quality studies
 */

const CALCULATIONS = {
  // Average waste per dog per day in lbs
  WASTE_PER_DOG_PER_DAY_LBS: 0.5,
  
  // Average waste per deposit in lbs (based on typical dog bowel movement)
  WASTE_PER_DEPOSIT_LBS: 0.25,
  
  // Days of waste collected per visit based on frequency
  DAYS_PER_VISIT: {
    weekly: 7,
    biweekly: 14,
    "bi-weekly": 14,
    monthly: 30,
    "one-time": 7, // Assume one week's worth for one-time
  } as Record<string, number>,
  
  // Methane production: kg CH4 per kg waste in landfill
  METHANE_KG_PER_KG_WASTE: 0.02,
  
  // Methane to CO2 equivalent multiplier
  METHANE_CO2_MULTIPLIER: 25,
  
  // Tree CO2 absorption per year in lbs
  TREE_CO2_ABSORPTION_LBS_PER_YEAR: 48,
  
  // Car CO2 emissions per mile in lbs
  CAR_CO2_PER_MILE_LBS: 0.89,
  
  // Composting methane reduction
  COMPOSTING_REDUCTION: {
    none: 0, // Landfill only - no composting benefit
    takeaway: 0, // Takeaway only - no composting (just convenient pickup)
    compost: 0.80, // Compost routing reduces methane emissions ~80%
  } as Record<string, number>,
  
  // Gallons of water protected per lb of waste diverted
  // Based on runoff contamination potential
  WATER_GALLONS_PER_LB: 5,
};

// Map divert modes to display labels
const DIVERT_LABELS: Record<string, string> = {
  none: "Standard Disposal",
  takeaway: "Haul-away",
  compost: "Compost routing",
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const wholeNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export default function EcoTab({
  serviceVisits,
  dataReadings,
  dogsCount,
  frequency,
  divertMode,
  serviceSummary,
}: EcoTabProps) {
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [pricing, setPricing] = useState<{
    perVisitCents: number;
    monthlyCents: number;
  } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const resolveFrequency = (value?: string | null): Frequency => {
    if (!value) return "weekly";
    const normalized = value.toLowerCase().replace(/_/g, "-");
    if (normalized === "bi-weekly") return "biweekly";
    if (normalized === "one-time" || normalized === "one time") return "onetime";
    if (normalized === "twice-weekly") return "twice-weekly";
    if (normalized === "daily") return "daily";
    if (normalized === "monthly") return "monthly";
    return "weekly";
  };

  const resolveYardSize = (value?: string | null): YardSize => {
    if (!value) return "medium";
    const normalized = value.toLowerCase();
    if (normalized === "xl" || normalized === "xlarge") return "xl";
    if (normalized === "small") return "small";
    if (normalized === "large") return "large";
    return "medium";
  };

  const resolveDeodorizeMode = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/_/g, "-");
    if (normalized === "none") return null;
    if (normalized === "first-visit") return "first-visit";
    if (normalized === "each-visit") return "each-visit";
    if (normalized === "every-other") return "every-other";
    if (normalized === "one-time" || normalized === "onetime") return "one-time";
    return null;
  };

  const normalizeDivertMode = (value?: string | null) => {
    if (!value) return "none";
    const normalized = value.toLowerCase().replace(/_/g, "-").trim();
    if (normalized === "takeaway") return "takeaway";
    if (normalized === "compost" || normalized === "composting") return "compost";
    if (/^\d{1,3}%?$/.test(normalized)) return "compost";
    if (normalized.startsWith("eco") && /\d/.test(normalized)) return "compost";
    return normalized || "none";
  };

  // Determine composting status
  const normalizedDivertMode = normalizeDivertMode(divertMode);
  const compostMode =
    normalizedDivertMode === "takeaway" || normalizedDivertMode === "compost"
      ? normalizedDivertMode
      : "none";
  const hasComposting = compostMode === "compost";
  const compostingReduction = CALCULATIONS.COMPOSTING_REDUCTION[compostMode] || 0;

  useEffect(() => {
    let cancelled = false;

    const loadPricing = async () => {
      const resolvedDogs = Math.max(
        1,
        serviceSummary?.dogsCount ?? dogsCount ?? 1,
      );
      const resolvedFrequency = resolveFrequency(
        serviceSummary?.frequency ?? frequency,
      );
      const resolvedYard = resolveYardSize(
        serviceSummary?.yardSize ?? null,
      );
      const deodorizeMode = resolveDeodorizeMode(
        serviceSummary?.deodorizeMode ?? null,
      );
      const existingDivertMode = normalizeDivertMode(
        serviceSummary?.divertMode ?? divertMode ?? "none",
      );
      const weekendUpgrade = Boolean(serviceSummary?.weekendUpgrade);

      setPricingLoading(true);
      try {
        const basePricing = await calculateCompletePricing({
          dogs: resolvedDogs,
          yardSize: resolvedYard,
          frequency: resolvedFrequency,
          weekendUpgrade,
          addons: {
            deodorize: Boolean(deodorizeMode),
            deodorizeMode: deodorizeMode ?? undefined,
            divertMode: existingDivertMode as any,
          },
        });

        const basePerVisit = basePricing.perVisitCents;
        const zoneMultiplier =
          serviceSummary?.perVisitCents && basePerVisit > 0
            ? serviceSummary.perVisitCents / basePerVisit
            : 1;

        const compostPricing = await calculateCompletePricing({
          dogs: resolvedDogs,
          yardSize: resolvedYard,
          frequency: resolvedFrequency,
          weekendUpgrade,
          addons: {
            deodorize: Boolean(deodorizeMode),
            deodorizeMode: deodorizeMode ?? undefined,
            divertMode: "compost",
          },
        });

        const perVisitDeltaRaw =
          compostPricing.recurringAddOns.divert -
          basePricing.recurringAddOns.divert;
        const perVisitCents = Math.max(
          0,
          Math.round(perVisitDeltaRaw * zoneMultiplier),
        );
        const monthlyCents = Math.round(
          perVisitCents * compostPricing.visitsPerMonth,
        );

        if (!cancelled) {
          setPricing({ perVisitCents, monthlyCents });
        }
      } catch (error) {
        console.error("EcoTab: failed to load pricing", error);
        if (!cancelled) {
          setPricing(null);
        }
      } finally {
        if (!cancelled) {
          setPricingLoading(false);
        }
      }
    };

    loadPricing();

    return () => {
      cancelled = true;
    };
  }, [
    dogsCount,
    frequency,
    divertMode,
    serviceSummary?.dogsCount,
    serviceSummary?.frequency,
    serviceSummary?.yardSize,
    serviceSummary?.weekendUpgrade,
    serviceSummary?.deodorizeMode,
    serviceSummary?.divertMode,
    serviceSummary?.perVisitCents,
  ]);
  
  // Calculate completed visits
  const completedVisits = useMemo(
    () => serviceVisits.filter((v) => v.status === "COMPLETED"),
    [serviceVisits]
  );
  
  const completedVisitsThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return completedVisits.filter(
      (v) => new Date(v.scheduledDate) >= monthStart
    ).length;
  }, [completedVisits]);

  // Calculate actual deposit count from data readings
  const totalLoggedDeposits = useMemo(() => {
    return dataReadings.reduce((sum, reading) => sum + (reading.volume || 0), 0);
  }, [dataReadings]);

  const totalCompletedVisits = completedVisits.length;
  const effectiveDogsCount = Math.max(1, dogsCount);
  
  // Get days per visit based on frequency
  const daysPerVisit = CALCULATIONS.DAYS_PER_VISIT[frequency.toLowerCase()] || 7;

  // Determine if we should use actual logged data or estimates
  const hasLoggedData = totalLoggedDeposits > 0;

  // Calculate total waste diverted (lifetime)
  // Use actual logged deposits when available, otherwise estimate
  const totalWasteLbs = useMemo(() => {
    if (hasLoggedData) {
      // Use actual logged deposit count × average weight per deposit
      return totalLoggedDeposits * CALCULATIONS.WASTE_PER_DEPOSIT_LBS;
    }
    // Fall back to estimate based on visits
    return totalCompletedVisits * effectiveDogsCount * CALCULATIONS.WASTE_PER_DOG_PER_DAY_LBS * daysPerVisit;
  }, [hasLoggedData, totalLoggedDeposits, totalCompletedVisits, effectiveDogsCount, daysPerVisit]);

  // Calculate waste diverted this month
  const wasteThisMonthLbs = useMemo(() => {
    return completedVisitsThisMonth * effectiveDogsCount * CALCULATIONS.WASTE_PER_DOG_PER_DAY_LBS * daysPerVisit;
  }, [completedVisitsThisMonth, effectiveDogsCount, daysPerVisit]);

  // Calculate methane avoided (in lbs CO2 equivalent)
  // Formula: waste_kg * methane_per_kg * co2_multiplier * composting_benefit
  const methaneCO2EquivLbs = useMemo(() => {
    const wasteKg = totalWasteLbs * 0.453592; // Convert lbs to kg
    const methaneCO2Kg = wasteKg * CALCULATIONS.METHANE_KG_PER_KG_WASTE * CALCULATIONS.METHANE_CO2_MULTIPLIER;
    const withCompostingBenefit = methaneCO2Kg * (1 + compostingReduction);
    return withCompostingBenefit * 2.20462; // Convert kg back to lbs
  }, [totalWasteLbs, compostingReduction]);

  // Calculate POTENTIAL impact if they had compost routing
  const potentialMethaneCO2EquivLbs = useMemo(() => {
    const wasteKg = totalWasteLbs * 0.453592;
    const methaneCO2Kg = wasteKg * CALCULATIONS.METHANE_KG_PER_KG_WASTE * CALCULATIONS.METHANE_CO2_MULTIPLIER;
    const withComposting = methaneCO2Kg * (1 + CALCULATIONS.COMPOSTING_REDUCTION.compost);
    return withComposting * 2.20462;
  }, [totalWasteLbs]);

  // Calculate trees equivalent (lifetime CO2 savings / tree absorption per year)
  const treesEquivalent = useMemo(() => {
    if (methaneCO2EquivLbs <= 0) return 0;
    return methaneCO2EquivLbs / CALCULATIONS.TREE_CO2_ABSORPTION_LBS_PER_YEAR;
  }, [methaneCO2EquivLbs]);

  // Potential trees with compost routing
  const potentialTreesEquivalent = useMemo(() => {
    if (potentialMethaneCO2EquivLbs <= 0) return 0;
    return potentialMethaneCO2EquivLbs / CALCULATIONS.TREE_CO2_ABSORPTION_LBS_PER_YEAR;
  }, [potentialMethaneCO2EquivLbs]);

  // Calculate car miles equivalent
  const carMilesEquivalent = useMemo(() => {
    if (methaneCO2EquivLbs <= 0) return 0;
    return methaneCO2EquivLbs / CALCULATIONS.CAR_CO2_PER_MILE_LBS;
  }, [methaneCO2EquivLbs]);

  // Potential car miles with compost routing
  const potentialCarMilesEquivalent = useMemo(() => {
    if (potentialMethaneCO2EquivLbs <= 0) return 0;
    return potentialMethaneCO2EquivLbs / CALCULATIONS.CAR_CO2_PER_MILE_LBS;
  }, [potentialMethaneCO2EquivLbs]);

  // Calculate water protected (gallons)
  const waterProtectedGallons = useMemo(() => {
    return totalWasteLbs * CALCULATIONS.WATER_GALLONS_PER_LB;
  }, [totalWasteLbs]);

  // Calculate trash bags equivalent (assume ~10 lbs per bag)
  const trashBagsThisMonth = useMemo(() => {
    return wasteThisMonthLbs / 10;
  }, [wasteThisMonthLbs]);

  // Calculate progress percentages (capped at 100, based on reasonable monthly targets)
  const monthlyTargetLbs = effectiveDogsCount * 30; // ~1 lb/day/dog as target
  const wasteProgress = Math.min((wasteThisMonthLbs / monthlyTargetLbs) * 100, 100);
  
  // Methane target based on monthly waste target
  const monthlyMethaneCO2Target = (monthlyTargetLbs * 0.453592 * CALCULATIONS.METHANE_KG_PER_KG_WASTE * CALCULATIONS.METHANE_CO2_MULTIPLIER * (1 + compostingReduction) * 2.20462);
  const monthlyMethaneCO2 = (wasteThisMonthLbs * 0.453592 * CALCULATIONS.METHANE_KG_PER_KG_WASTE * CALCULATIONS.METHANE_CO2_MULTIPLIER * (1 + compostingReduction) * 2.20462);
  const methaneProgress = Math.min((monthlyMethaneCO2 / monthlyMethaneCO2Target) * 100, 100);
  const compostLevel = "compost";
  const compostPerVisitLabel = pricing
    ? `${formatPrice(pricing.perVisitCents)}/visit`
    : "$10/visit";
  const compostMonthlyLabel = pricing
    ? `~${formatPrice(pricing.monthlyCents)}/mo`
    : null;
  const compostPriceDisplay = pricingLoading
    ? "Calculating..."
    : `+${compostPerVisitLabel}`;
  const compostMonthlyDisplay =
    !pricingLoading && compostMonthlyLabel ? `(${compostMonthlyLabel})` : null;

  // Handle add-on submission
  const handleAddComposting = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch("/api/subscription/add-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addOn: "compost",
          level: compostLevel,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add composting");
      }
      
      setSubmitSuccess(true);
      // Refresh the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="eco" className="space-y-8">
      {/* ====== HERO: Impact Summary ====== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-evergreen-500 via-evergreen-600 to-evergreen-500 dark:from-evergreen-600 dark:via-evergreen-700 dark:to-evergreen-600 p-1">
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-evergreen-500 via-evergreen-600 to-evergreen-500 dark:from-evergreen-600 dark:via-evergreen-700 dark:to-evergreen-600 p-8 md:p-10">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-mint-400/25 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          
          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 mb-6">
              <Leaf className="size-4 text-mint" />
              <span className="text-xs font-semibold tracking-wide text-white uppercase">
                Environmental Impact
              </span>
              {hasComposting && (
                <span className="ml-2 text-xs font-medium text-mint bg-white/20 px-2 py-0.5 rounded-full">
                  {DIVERT_LABELS[compostMode] ?? "Compost routing"}
              </span>
              )}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-white tracking-tight leading-none">
                  {numberFormatter.format(totalWasteLbs)}
                  <span className="text-2xl md:text-3xl ml-2 text-white/70">lbs</span>
                </h1>
                <p className="text-lg text-white/80 font-medium">
                  {hasComposting ? "Total waste diverted from landfills" : "Total waste collected to date"}
                </p>
                <p className="text-sm text-white/60 max-w-md">
                  Based on {hasLoggedData ? (
                    <><strong>{wholeNumberFormatter.format(totalLoggedDeposits)} deposits</strong> logged by our technicians</>
                  ) : (
                    <>{totalCompletedVisits} completed {totalCompletedVisits === 1 ? "visit" : "visits"} for {effectiveDogsCount} {effectiveDogsCount === 1 ? "dog" : "dogs"}</>
                  )}.
                  {hasComposting ? (
                    <> Your waste is routed through composting, significantly reducing methane emissions.</>
                  ) : (
                    <> Add compost routing to start tracking diversion and methane reductions.</>
                  )}
                </p>
              </div>

              {/* Monthly Stats */}
              <div className="flex gap-4 flex-wrap lg:flex-nowrap">
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 min-w-[140px]">
                  <Recycle className="size-5 text-mint mb-3" />
                  <p className="text-3xl font-heading font-bold text-white">{numberFormatter.format(wasteThisMonthLbs)}</p>
                  <p className="text-xs text-white/60 mt-1">lbs this month</p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 min-w-[140px]">
                  <TrendingUp className="size-5 text-coral-light mb-3" />
                  <p className="text-3xl font-heading font-bold text-white">{completedVisitsThisMonth}</p>
                  <p className="text-xs text-white/60 mt-1">{completedVisitsThisMonth === 1 ? "visit" : "visits"} this month</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== COMPOSTING UPSELL (if no composting) ====== */}
      {!hasComposting && totalCompletedVisits > 0 && (
        <section className="relative overflow-hidden rounded-3xl border border-amber-200/50 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 via-yellow-50/80 to-orange-50/50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/20 p-8 md:p-10">
          {/* Decorative spark */}
          <div className="absolute top-4 right-4">
            <Sparkles className="size-8 text-amber-400/50 dark:text-amber-400/30" />
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-4 py-1.5">
                <Zap className="size-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-300 uppercase">
                  Maximize Your Impact
                </span>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-heading font-bold text-graphite dark:text-white">
                You could be offsetting{" "}
                <span className="text-amber-600 dark:text-amber-400">
                  {numberFormatter.format(potentialTreesEquivalent)} trees
                </span>{" "}
                worth of CO₂
              </h2>
              
              <p className="text-graphite/70 dark:text-white/70">
                Based on your service history, adding our composting program could reduce your carbon footprint 
                by up to <strong>{wholeNumberFormatter.format(potentialCarMilesEquivalent)} car miles</strong> of emissions. 
                We'll divert your pup's waste through compost routing instead of the landfill.
              </p>
              
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="inline-flex items-center rounded-full bg-white/70 dark:bg-white/10 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  Adds {compostPerVisitLabel}
                  {compostMonthlyLabel ? ` · ${compostMonthlyLabel}` : ""}
                </span>
                <Button
                  onClick={() => setShowAddOnModal(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-6 h-12 text-base font-semibold shadow-lg shadow-amber-500/25 transition-all hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5"
                >
                  Add Composting
                  <ArrowRight className="size-4 ml-2" />
                </Button>
              </div>
            </div>
            
            {/* Potential Impact Stats */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
                <TreePine className="size-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-heading font-bold text-graphite dark:text-white">
                  {numberFormatter.format(potentialTreesEquivalent)}
              </p>
                <p className="text-xs text-graphite/60 dark:text-white/60">trees/year</p>
              </div>
              <div className="bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
                <Car className="size-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-heading font-bold text-graphite dark:text-white">
                  {wholeNumberFormatter.format(potentialCarMilesEquivalent)}
                </p>
                <p className="text-xs text-graphite/60 dark:text-white/60">miles offset</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====== Real-World Equivalents ====== */}
      {hasComposting ? (
        <section className="space-y-4">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">
            Your Impact
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Trees */}
            <div className="group rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-mint/10 text-mint mb-4 group-hover:scale-110 transition-transform">
                <TreePine className="size-7" />
              </div>
              <p className="text-4xl font-heading font-bold text-graphite dark:text-white mb-1">
                {treesEquivalent < 0.1 ? "< 0.1" : numberFormatter.format(treesEquivalent)}
              </p>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                trees worth of CO₂ absorption (annual)
              </p>
            </div>

            {/* Car Miles */}
            <div className="group rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-coral/10 text-coral mb-4 group-hover:scale-110 transition-transform">
                <Car className="size-7" />
              </div>
              <p className="text-4xl font-heading font-bold text-graphite dark:text-white mb-1">
                {wholeNumberFormatter.format(carMilesEquivalent)}
              </p>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                miles of car emissions offset
              </p>
            </div>

            {/* Water Protected */}
            <div className="group rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                <Droplets className="size-7" />
              </div>
              <p className="text-4xl font-heading font-bold text-graphite dark:text-white mb-1">
                {wholeNumberFormatter.format(waterProtectedGallons)}
              </p>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                gallons of water protected
              </p>
            </div>

            {/* Trash Bags */}
            <div className="group rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-evergreen/10 dark:bg-mint/10 text-evergreen-500 dark:text-mint mb-4 group-hover:scale-110 transition-transform">
                <Trash2 className="size-7" />
              </div>
              <p className="text-4xl font-heading font-bold text-graphite dark:text-white mb-1">
                {numberFormatter.format(trashBagsThisMonth)}
              </p>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                trash bags diverted this month
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">
            Potential impact with compost routing
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="group rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-mint/10 text-mint mb-4 group-hover:scale-110 transition-transform">
                <TreePine className="size-7" />
              </div>
              <p className="text-4xl font-heading font-bold text-graphite dark:text-white mb-1">
                {potentialTreesEquivalent < 0.1 ? "< 0.1" : numberFormatter.format(potentialTreesEquivalent)}
              </p>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                trees worth of CO₂ absorption (annual)
              </p>
            </div>
            <div className="group rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-coral/10 text-coral mb-4 group-hover:scale-110 transition-transform">
                <Car className="size-7" />
              </div>
              <p className="text-4xl font-heading font-bold text-graphite dark:text-white mb-1">
                {wholeNumberFormatter.format(potentialCarMilesEquivalent)}
              </p>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                miles of car emissions offset
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ====== Progress Bars ====== */}
      {hasComposting && (
        <section className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-heading font-bold text-graphite dark:text-white mb-1">Monthly Progress</h2>
            <p className="text-sm text-graphite/50 dark:text-white/50">Track your environmental impact month over month</p>
          </div>

          <div className="space-y-6">
            {/* Waste Diverted */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-mint/10 text-mint">
                    <Recycle className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-graphite dark:text-white">Waste Diverted</p>
                    <p className="text-xs text-graphite/50 dark:text-white/50">Target: {wholeNumberFormatter.format(monthlyTargetLbs)} lbs/month</p>
                  </div>
                </div>
                <p className="text-xl font-heading font-bold text-graphite dark:text-white">
                  {numberFormatter.format(wasteThisMonthLbs)} <span className="text-sm text-graphite/50 dark:text-white/50 font-normal">lbs</span>
                </p>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-graphite/5 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-mint to-evergreen-400 transition-all duration-1000"
                  style={{ width: `${wasteProgress}%` }}
                />
              </div>
            </div>

            {/* CO2 Avoided */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-coral/10 text-coral">
                    <Wind className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-graphite dark:text-white">CO₂ Emissions Avoided</p>
                    <p className="text-xs text-graphite/50 dark:text-white/50">
                      From methane reduction
                      {hasComposting && <span className="text-mint"> (compost routing impact)</span>}
                    </p>
                  </div>
                </div>
                <p className="text-xl font-heading font-bold text-graphite dark:text-white">
                  {numberFormatter.format(monthlyMethaneCO2)} <span className="text-sm text-graphite/50 dark:text-white/50 font-normal">lbs CO₂</span>
                </p>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-graphite/5 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-coral to-sunset transition-all duration-1000"
                  style={{ width: `${methaneProgress}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====== How We Calculate ====== */}
      <section className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-graphite/5 dark:bg-white/10 text-graphite/60 dark:text-white/60 flex-shrink-0">
            <Info className="size-5" />
          </div>
          <div className="space-y-3">
            <h3 className="font-heading font-bold text-graphite dark:text-white">How We Calculate Your Impact</h3>
            <div className="text-sm text-graphite/60 dark:text-white/60 leading-relaxed space-y-2">
              <p>
                Our calculations are based on EPA and environmental research:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>We log the exact number of deposits collected at each visit for accuracy</li>
                <li>Average dog produces ~0.5 lbs of waste per day (~0.25 lbs per deposit)</li>
                <li>{frequency === "weekly" ? "Weekly" : frequency === "biweekly" || frequency === "bi-weekly" ? "Bi-weekly" : "Your"} service collects ~{daysPerVisit} days of waste per visit</li>
                <li>Dog waste in landfills produces methane (25x more potent than CO₂)</li>
                {hasComposting ? (
                  <li className="text-mint">Compost routing reduces methane emissions by ~80%</li>
                ) : (
                  <li>Adding composting can reduce methane emissions by up to 80%</li>
                )}
                <li>Proper disposal protects ~5 gallons of groundwater per lb of waste</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====== Why It Matters ====== */}
      <section className="rounded-2xl border border-evergreen/10 dark:border-mint/20 bg-gradient-to-br from-evergreen/5 to-transparent dark:from-mint/10 dark:to-transparent p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <Droplets className="size-5 text-evergreen-500 dark:text-mint" />
              <h3 className="font-heading font-bold text-graphite dark:text-white">Why This Matters</h3>
            </div>
            <p className="text-sm text-graphite/60 dark:text-white/60 leading-relaxed">
              Dog waste contains harmful bacteria including E. coli and fecal coliform—one gram contains 23 million bacteria! 
              Left in yards or landfills, it pollutes waterways and releases potent greenhouse gases.
              Your participation helps protect local ecosystems and fights climate change.
            </p>
          </div>
          {!hasComposting ? (
            <Button
              onClick={() => setShowAddOnModal(true)}
              className="bg-evergreen-500 hover:bg-evergreen-600 dark:bg-mint dark:hover:bg-mint/90 dark:text-evergreen-900 text-white rounded-xl h-11 px-6 font-semibold flex-shrink-0"
            >
              Add Composting
              <ArrowRight className="size-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-evergreen/20 dark:border-mint/30 bg-evergreen/5 dark:bg-mint/10 text-evergreen-500 dark:text-mint hover:bg-evergreen/10 dark:hover:bg-mint/20 rounded-xl h-11 px-6 font-semibold flex-shrink-0"
              asChild
            >
              <a href="mailto:sustainability@yardura.com">
                Learn More
              </a>
            </Button>
          )}
        </div>
      </section>

      {/* ====== Add Composting Modal ====== */}
      <Dialog open={showAddOnModal} onOpenChange={setShowAddOnModal}>
        <DialogContent className="sm:max-w-[500px] dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-graphite dark:text-white flex items-center gap-2">
              <Leaf className="size-5 text-mint" />
              Add Composting to Your Plan
            </DialogTitle>
            <DialogDescription className="text-graphite/60 dark:text-white/60">
              Maximize your environmental impact by composting your pup's waste instead of sending it to the landfill.
            </DialogDescription>
          </DialogHeader>
          
          {submitSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto size-16 rounded-full bg-mint/10 flex items-center justify-center">
                <Check className="size-8 text-mint" />
              </div>
              <h3 className="text-lg font-heading font-bold text-graphite dark:text-white">
                Composting Added!
              </h3>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                Your plan has been updated. Thank you for making a greener choice!
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 py-4">
                <div className="w-full rounded-xl border-2 border-mint bg-mint/5 p-4 text-left dark:bg-mint/10">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-graphite dark:text-white">Compost routing</p>
                      <p className="text-sm text-graphite/60 dark:text-white/60">
                        We route every pickup to composting when capacity allows.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-lg font-heading font-bold text-graphite dark:text-white">
                        {compostPriceDisplay}
                      </span>
                      {compostMonthlyDisplay && (
                        <span className="text-xs text-graphite/60 dark:text-white/60">
                          {compostMonthlyDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {submitError && (
                <p className="text-red-500 text-sm">{submitError}</p>
              )}
              
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddOnModal(false)}
                  disabled={isSubmitting}
                  className="dark:text-white dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddComposting}
                  disabled={isSubmitting || pricingLoading}
                  className="bg-mint-600 hover:bg-mint-700 text-white dark:bg-mint-500 dark:hover:bg-mint-400 dark:text-graphite font-semibold"
                >
                  {isSubmitting ? "Adding..." : "Add to Plan"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
