"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "@/lib/framermotion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepProps } from "@/types/quote";
import {
  CheckCircle2,
  ChevronRight,
  Info,
  Leaf,
  Recycle,
  Sparkles,
  SprayCan,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  withQuotePanel,
  quoteSurfaceClass,
  quoteSubtleTextClass,
  quoteMutedBadgeClass,
  quoteHeadingClass,
} from "../quoteStyles";

const formatCurrencyFromCents = (cents: number | null | undefined) => {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
};

const DEFAULT_ADDON_PRICES: Record<string, number> = {
  deodorize: 500,
  "spray-deck": 1200,
  "divert-takeaway": 500,
  "divert-compost": 1000,
};

const mintSelectedClass =
  "border-[brand-coral/55] bg-[brand-coral/10] text-brand-ink shadow-[0_18px_38px_rgba(243,100,91,0.35)] ring-2 ring-brand-coral/40 dark:border-brand-coral/65 dark:bg-brand-coral/15/90 dark:text-cream-vanilla dark:ring-brand-coral/45";
const mintIdleClass =
  "border-brand-coral/15 bg-cream-vanilla/60 text-brand-ink hover:border-brand-coral/35 hover:bg-cream-vanilla/80 dark:border-brand-coral/35 dark:bg-evergreen-800/80 dark:text-cream-vanilla hover:dark:border-brand-coral/45";
const goldSelectedClass =
  "border-[rgba(220,179,99,0.7)] bg-[rgba(247,236,215,0.9)] text-[#8a6115] shadow-[0_18px_38px_rgba(162,114,0,0.35)] ring-2 ring-amber-300/50 dark:border-amber-400/65 dark:bg-[#2b1a05]/85 dark:text-amber-100 dark:ring-amber-300/60";
const goldIdleClass =
  "border-brand-gold/25 bg-cream-vanilla/60 text-brand-ink hover:border-brand-gold/45 hover:bg-cream-vanilla/80 dark:border-amber-400/30 dark:bg-[#241303]/80 dark:text-amber-50 hover:dark:border-amber-400/45";

const accentTextClass = (accent: "mint" | "gold") =>
  accent === "gold"
    ? "text-[#8a6115] dark:text-amber-100"
    : "text-brand-ink dark:text-cream-vanilla";

const accentBadgeClass = (accent: "mint" | "gold") =>
  accent === "gold"
    ? "bg-[#f7ecd7] text-[#8a6115] dark:bg-[#2b1a05] dark:text-amber-100"
    : "bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla";

type BusinessConfig = {
  basePricing?: {
    addOns?: Array<{ id: string; priceCents: number }>;
  };
};

type EcoSubSelection = "takeaway" | "compost";

type DeodorizeSubSelection = "first-visit" | "each-visit";

const SectionHeader = ({
  title,
  blurb,
  icon,
  accent,
}: {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  accent: "mint" | "gold";
}) => (
  <div className="flex flex-col gap-2">
    <div className="inline-flex items-center gap-2 font-serif text-base font-normal text-emerald-50 md:text-lg md:text-brand-ink">
      <span
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-2xl",
          accent === "mint"
            ? "bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla"
            : "bg-amber-400/15 text-amber-700 dark:bg-[#2b1a05] dark:text-amber-100",
        )}
      >
        {icon}
      </span>
      {title}
    </div>
    <p className={cn("text-xs leading-relaxed", quoteSubtleTextClass)}>{blurb}</p>
  </div>
);

const OptionCard = ({
  title,
  description,
  priceLabel,
  selected,
  accent,
  onClick,
}: {
  title: string;
  description: string;
  priceLabel?: string;
  selected: boolean;
  accent: "mint" | "gold";
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "relative h-full rounded-2xl border-2 p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40",
      accent === "mint"
        ? selected
          ? mintSelectedClass
          : mintIdleClass
        : selected
          ? goldSelectedClass
          : goldIdleClass,
    )}
  >
    {selected ? (
      <CheckCircle2
        className="absolute right-4 top-4 h-4 w-4 text-white md:text-brand-coral dark:text-cream-vanilla dark:md:text-emerald-50"
        aria-hidden="true"
      />
    ) : null}
    <div className="space-y-2">
      <div className={cn("font-serif text-lg font-normal md:text-xl", accentTextClass(accent))}>
        {title}
      </div>
      <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
        {description}
      </p>
      {priceLabel ? (
        <span className={cn(quoteMutedBadgeClass, "mt-1 inline-flex", accentBadgeClass(accent))}>{priceLabel}</span>
      ) : null}
    </div>
  </button>
);

const SubOptionChip = ({
  title,
  helper,
  price,
  selected,
  accent,
  onClick,
}: {
  title: string;
  helper: string;
  price: string;
  selected: boolean;
  accent: "mint" | "gold";
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "w-full rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 sm:w-auto",
      accent === "mint"
        ? selected
          ? mintSelectedClass
          : mintIdleClass
        : selected
          ? goldSelectedClass
          : goldIdleClass,
    )}
  >
    <div className={cn("font-serif text-base font-normal md:text-lg", accentTextClass(accent))}>
      {title}
    </div>
    <p className={cn("mt-1 text-sm", quoteSubtleTextClass)}>{helper}</p>
    <span className={cn(quoteMutedBadgeClass, "mt-3 inline-flex", accentBadgeClass(accent))}>{price}</span>
  </button>
);

export const StepCustomization: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  estimatedPrice,
}) => {
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedEcoSub, setCachedEcoSub] = useState<EcoSubSelection | null>(null);
  const [ecoInfoOpen, setEcoInfoOpen] = useState(false);

  const breakdown = useMemo(() => {
    if (!estimatedPrice || typeof estimatedPrice !== "object") {
      return {} as Record<string, unknown>;
    }
    return ((estimatedPrice as any).breakdown ?? {}) as Record<string, unknown>;
  }, [estimatedPrice]);

  const { yardZoneMultiplier, frequencyMultiplier } = useMemo(() => {
    const rawYard = typeof breakdown?.yardMultiplier === "number" ? breakdown.yardMultiplier : 1;
    const rawZone = typeof breakdown?.zoneMultiplier === "number" ? breakdown.zoneMultiplier : 1;
    const rawFrequency =
      typeof breakdown?.frequencyMultiplier === "number"
        ? breakdown.frequencyMultiplier
        : 1;

    const yardZone =
      Math.max(0, rawYard || 0) === 0
        ? rawZone || 1
        : (rawYard || 1) * (rawZone || 1);

    return {
      yardZoneMultiplier: yardZone || 1,
      frequencyMultiplier: rawFrequency || 1,
    };
  }, [breakdown]);

  const frequencyValue = (quoteData.frequency || "weekly").toLowerCase();

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/business-config", {
        cache: "no-store",
      });
        if (response.ok) {
          const { config } = await response.json();
          if (isMounted) {
            setConfig(config);
          }
        }
    } catch (error) {
        console.warn("Unable to load add-on pricing", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const getAddonPrice = (id: string) =>
    config?.basePricing?.addOns?.find((addon) => addon.id === id)?.priceCents ??
    DEFAULT_ADDON_PRICES[id] ?? null;

  const deodorizePriceCents = getAddonPrice("deodorize");
  const divertTakeawayPriceCents = getAddonPrice("divert-takeaway");
  const divertCompostPriceCents = getAddonPrice("divert-compost");

  const mutateAddOns = (mutator: (draft: Record<string, any>) => void) => {
    const draft: Record<string, any> = { ...(quoteData.addOns || {}) };
    mutator(draft);
    updateQuoteData({ addOns: draft });
  };

  // Deodorizing selections
  const isOneTimeService =
    frequencyValue === "onetime" || frequencyValue === "one-time";
  const deodorizeSelected = Boolean(quoteData.addOns?.deodorize);
  const defaultDeodorizeMode: DeodorizeSubSelection = isOneTimeService
    ? "first-visit"
    : "each-visit";
  const normalizeDeodorizeMode = (mode?: string | null): DeodorizeSubSelection => {
    if (mode === "first-visit") {
      return isOneTimeService ? "first-visit" : "each-visit";
    }
    return "each-visit";
  };
  const deodorizeMode: DeodorizeSubSelection = deodorizeSelected
    ? normalizeDeodorizeMode(quoteData.addOns?.deodorizeMode)
    : defaultDeodorizeMode;

  const deodorizePriceLabel = (mode: DeodorizeSubSelection) => {
    const base = deodorizePriceCents ?? 0;
    if (base <= 0) {
      return "Adds refreshing fragrance";
    }

    const firstVisitCents = Math.round(base * yardZoneMultiplier);
    const recurringCents = Math.round(base * yardZoneMultiplier * frequencyMultiplier);
    const isOneTimeFrequency = frequencyValue === "onetime";

    if (isOneTimeFrequency) {
      return `${formatCurrencyFromCents(firstVisitCents)} one-time`;
    }

    if (mode === "first-visit") {
      return `${formatCurrencyFromCents(recurringCents)} one-time`;
    }

    return `${formatCurrencyFromCents(recurringCents)}/visit`;
  };

  const handleDeodorizePrimary = (selection: "none" | "add") => {
    mutateAddOns((draft) => {
      if (selection === "none") {
        delete draft.deodorize;
        delete draft.deodorizeMode;
      } else {
        draft.deodorize = true;
        draft.deodorizeMode = isOneTimeService ? "first-visit" : deodorizeMode;
      }
    });
  };

  // Eco diversion selections
  const rawDivertMode =
    typeof quoteData.addOns?.divertMode === "string"
      ? quoteData.addOns.divertMode.toLowerCase().trim()
      : "none";
  const normalizedDivertMode =
    rawDivertMode === "takeaway"
      ? "takeaway"
      : rawDivertMode === "compost" || /^\d{1,3}%?$/.test(rawDivertMode)
        ? "compost"
        : "none";
  const currentDivertMode = normalizedDivertMode as
    | "none"
    | "takeaway"
    | EcoSubSelection;

  const ecoPrimarySelection: "leave" | "takeaway" = [
    "takeaway",
    "compost",
  ].includes(currentDivertMode)
    ? "takeaway"
    : "leave";

  const ecoSubSelection: EcoSubSelection = useMemo(() => {
    if (currentDivertMode === "takeaway" || currentDivertMode === "compost") {
      return currentDivertMode as EcoSubSelection;
    }
    return cachedEcoSub || "takeaway";
  }, [currentDivertMode, cachedEcoSub]);

  const handleEcoPrimary = (selection: "leave" | "takeaway") => {
    mutateAddOns((draft) => {
      if (selection === "leave") {
        draft.divertMode = "none";
      } else {
        const nextMode =
          cachedEcoSub ||
          (["takeaway", "compost"].includes(currentDivertMode)
            ? (currentDivertMode as EcoSubSelection)
            : "takeaway");
        draft.divertMode = nextMode;
        setCachedEcoSub(nextMode);
      }
    });
  };

  const handleEcoSub = (selection: EcoSubSelection) => {
    setCachedEcoSub(selection);
    mutateAddOns((draft) => {
      draft.divertMode = selection;
    });
  };

  const ecoNoteVisible = ecoSubSelection === "compost";

  const ecoSubOptionPrice = (mode: EcoSubSelection) => {
    const map: Record<EcoSubSelection, number | null> = {
      takeaway: divertTakeawayPriceCents,
      compost: divertCompostPriceCents,
    };
    const fallbackMap: Record<EcoSubSelection, number> = {
      takeaway: DEFAULT_ADDON_PRICES["divert-takeaway"],
      compost: DEFAULT_ADDON_PRICES["divert-compost"],
    };
    const base = map[mode] ?? fallbackMap[mode] ?? 0;
    if (base <= 0) {
      return mode === "takeaway"
        ? "Included"
        : "Adds zero landfill waste";
    }

    const firstVisitCents = Math.round(base * yardZoneMultiplier);
    const recurringCents = Math.round(base * yardZoneMultiplier * frequencyMultiplier);
    const isOneTimeFrequency = frequencyValue === "onetime";

    if (isOneTimeFrequency) {
      return `${formatCurrencyFromCents(firstVisitCents)} one-time`;
    }

    return `${formatCurrencyFromCents(recurringCents)}/visit`;
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24 md:pb-28">
      <Card className={withQuotePanel("space-y-6 text-brand-ink dark:text-cream-vanilla")}>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-normal md:text-lg text-brand-ink dark:text-cream-vanilla">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <Sparkles className="h-4 w-4" />
            </span>
            Customize Service
          </CardTitle>
          <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
            Layer on deodorizing, compost routing, wellness insights, and concierge onboarding. Adjust these anytime from your dashboard.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-5">
            <SectionHeader
              title="Deodorizing & sanitizing"
              blurb="Decide if we finish each scoop with a plant-based fragrance mist."
              icon={<SprayCan className="size-4" />}
              accent="mint"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionCard
                title="No deodorizing"
                description="We’ll scoop and go - perfect if you prefer the yard untouched."
                priceLabel="Included"
                selected={!deodorizeSelected}
                accent="mint"
                onClick={() => handleDeodorizePrimary("none")}
              />
              <OptionCard
                title="Add deodorizing"
                description="Finish each visit with a light, pet-safe mist that knocks out odors."
                priceLabel={deodorizePriceLabel(
                  deodorizeSelected ? deodorizeMode : defaultDeodorizeMode,
                )}
                selected={deodorizeSelected}
                accent="mint"
                onClick={() => handleDeodorizePrimary("add")}
              />
            </div>
            {deodorizeSelected ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  quoteSurfaceClass,
                  "space-y-2 border border-brand-coral/25 bg-brand-coral/8 p-4 text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/80 dark:text-cream-vanilla",
                )}
              >
                <p className="font-serif text-sm font-normal md:text-base">
                  We'll mist {isOneTimeService ? "during your kickoff clean" : "after every visit"}.
                </p>
                <div className="text-sm text-brand-ink dark:text-cream-vanilla">
                  Plant-based enzymes knock down bacteria without leaving residue.
                </div>
                <span
                  className={cn(
                    quoteMutedBadgeClass,
                    "inline-flex bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla",
                  )}
                >
                  {deodorizePriceLabel(deodorizeMode)}
                </span>
              </motion.div>
            ) : (
              <div className={cn(
                quoteSurfaceClass,
                "flex items-start gap-2 border border-brand-coral/20 bg-brand-coral/8 p-3 text-xs text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/80 dark:text-cream-vanilla",
              )}
              >
                <Info className="mt-0.5 h-4 w-4" />
                Toggle this anytime—deodorizing simply adds a $5 fragrance mist after each scoop.
              </div>
            )}
          </section>

          <section className="space-y-5">
            <SectionHeader
              title="Waste diversion & takeaway"
              blurb="Tell us if we should leave double-bagged waste on-site, haul it away, or send every bag into our compost stream."
              icon={<Recycle className="size-4" />}
              accent="gold"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionCard
                title="Leave in my bin"
                description="We double-bag and tuck everything neatly into your bin for regular pickup."
                priceLabel="Included"
                selected={ecoPrimarySelection === "leave"}
                accent="gold"
                onClick={() => handleEcoPrimary("leave")}
              />
              <OptionCard
                title="Take it away"
                description="We haul waste off-site. Upgrade below if you want us to route each haul through compost partners whenever there's capacity."
                priceLabel={ecoSubOptionPrice(
                  ecoPrimarySelection === "takeaway" ? ecoSubSelection : "takeaway",
                )}
                selected={ecoPrimarySelection === "takeaway"}
                accent="gold"
                onClick={() => handleEcoPrimary("takeaway")}
              />
            </div>
            {ecoPrimarySelection === "leave" ? (
              <div className={cn(
                quoteSurfaceClass,
                "flex items-start gap-2 border border-amber-300/35 bg-amber-50/80 p-3 text-xs text-amber-700 dark:border-amber-400/45 dark:bg-[#2b1a05] dark:text-amber-100",
              )}
              >
                <Leaf className="mt-0.5 h-4 w-4" />
                We seal every bag in compostable liners so collection day stays tidy.
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  quoteSurfaceClass,
                  "space-y-3 border border-brand-coral/25 bg-gradient-to-br from-brand-coral/10 via-transparent to-amber-400/10 p-4 text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/15/80 dark:text-cream-vanilla",
                )}
              >
                <p className="font-serif text-sm font-normal md:text-base">Choose how we handle the waste</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {[
                    {
                      value: "takeaway" as EcoSubSelection,
                      title: "Haul it away",
                      helper: "We remove every bag off-site using standard disposal.",
                      accent: "gold" as const,
                    },
                    {
                      value: "compost" as EcoSubSelection,
                      title: "Compost routing",
                      helper: "We route each haul through compost partners when capacity allows—eco impact still tracked.",
                      accent: "mint" as const,
                    },
                  ].map((option) => (
                    <SubOptionChip
                      key={option.value}
                      title={option.title}
                      helper={option.helper}
                      price={ecoSubOptionPrice(option.value)}
                      selected={ecoSubSelection === option.value}
                      accent={option.accent}
                      onClick={() => handleEcoSub(option.value)}
                    />
                  ))}
                </div>
                {ecoNoteVisible ? (
                  <div className="space-y-2">
                    <div
                        className={cn(
                          quoteMutedBadgeClass,
                          "inline-flex bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla",
                        )}
                    >
                      Diversion recaps show how many pounds skipped the landfill—even when a few bags must be landfilled.
                    </div>
                    <p className={cn("text-[0.7rem]", quoteSubtleTextClass)}>
                      Compost routing capacity can vary. We divert as much as partners can accept and still log the impact in your dashboard.
                    </p>
                  </div>
                ) : null}
              </motion.div>
            )}
          </section>

          {isLoading ? (
            <div className="flex items-center gap-3 text-xs text-cream-vanilla md:text-[rgba(var(--graphite-rgb-commas),0.55)]">
              <div className="h-3 w-3 animate-pulse rounded-full bg-brand-coral/60" />
              Updating add-on pricing...
            </div>
          ) : null}

          <div className={cn(
            quoteSurfaceClass,
            "overflow-hidden border border-brand-coral/25 md:border-brand-soft",
          )}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold"
              onClick={() => setEcoInfoOpen((prev) => !prev)}
            >
              <span>Why does waste diversion matter?</span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  ecoInfoOpen ? "rotate-90" : "",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {ecoInfoOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 px-5 pb-5 text-xs"
                >
                  <div
                    className={cn(
                      quoteSurfaceClass,
                      "space-y-3 border border-brand-coral/25 bg-brand-coral/8 p-4 text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/80 dark:text-cream-vanilla",
                    )}
                  >
                    <p>
                      EPA studies estimate 99%+ of U.S. pet waste still hits landfills - usually sealed in plastic that traps methane. Diverting even a portion cuts emissions and the plastic footprint trailing every scoop.
                    </p>
                    <div className="flex flex-wrap gap-3 text-[0.65rem] font-semibold">
                      <span className={cn(quoteMutedBadgeClass, "bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla")}>99% still landfilled</span>
                      <span className={cn(quoteMutedBadgeClass, "bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla")}>~1% of household plastic = poop bags</span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[{
                      src: "/pexels-karola-g-4751990.jpg",
                      caption: "Diverted waste becomes nutrient-rich soil through our compost partner.",
                    },
                    {
                      src: "/pexels-mumtahina-tanni-1080117-3230538.jpg",
                      caption: "Landfills trap organics for decades - diversion keeps methane out of the cycle.",
                    }].map((item) => (
                      <div
                        key={item.src}
                        className={cn(
                          quoteSurfaceClass,
                          "overflow-hidden border border-brand-coral/25 bg-brand-coral/8 dark:border-brand-coral/35 dark:bg-evergreen-800",
                        )}
                      >
                        <Image
                          src={item.src}
                          alt={item.caption}
                          width={640}
                          height={480}
                          className="h-40 w-full object-cover"
                        />
                        <div className={cn("px-3 py-3", quoteSubtleTextClass)}>{item.caption}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
