"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle,
  Save,
  DollarSign,
  Plus,
  Settings,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BusinessConfig,
  DEFAULT_YARDURA_CONFIG,
  AddOnConfig,
} from "@/lib/business-config";

type ConfigFrequency =
  BusinessConfig["basePricing"]["frequencies"][number]["frequency"];

const FREQUENCY_DISPLAY_ORDER: ConfigFrequency[] = [
  "daily",
  "twice-weekly",
  "weekly",
  "bi-weekly",
  "monthly",
  "one-time",
];

const FREQUENCY_DETAILS: Record<ConfigFrequency, {
  label: string;
  description: string;
  defaultMultiplier: number;
  defaultVisits: number;
  badgeClass: string;
}> = {
  daily: {
    label: "Daily (Mon–Fri)",
    description: "Weekday visit cadence for spotless yards",
    defaultMultiplier: 0.5,
    defaultVisits: 21.67,
    badgeClass:
      "bg-emerald-500/15 text-emerald-600 border border-emerald-400/30",
  },
  "twice-weekly": {
    label: "Twice Weekly",
    description: "High-traffic yards with mid-week refresh",
    defaultMultiplier: 0.75,
    defaultVisits: 8.67,
    badgeClass:
      "bg-indigo-500/15 text-indigo-600 border border-indigo-400/30",
  },
  weekly: {
    label: "Weekly",
    description: "Standard upkeep cadence",
    defaultMultiplier: 1.0,
    defaultVisits: 4.33,
    badgeClass:
      "bg-blue-500/15 text-blue-600 border border-blue-400/30",
  },
  "bi-weekly": {
    label: "Bi-weekly",
    description: "Every other week for lighter usage",
    defaultMultiplier: 1.25,
    defaultVisits: 2.17,
    badgeClass:
      "bg-amber-500/15 text-amber-600 border border-amber-400/30",
  },
  monthly: {
    label: "Monthly",
    description: "Deep maintenance visit once per month",
    defaultMultiplier: 1.5,
    defaultVisits: 1,
    badgeClass:
      "bg-rose-500/15 text-rose-600 border border-rose-400/30",
  },
  "one-time": {
    label: "One-time",
    description: "Single visit or spring clean",
    defaultMultiplier: 1,
    defaultVisits: 1,
    badgeClass:
      "bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-400/30",
  },
};

const STATUS_BADGES = [
  {
    label: "Pricing engine active",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  {
    label: "Multi-zone support",
    className:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  },
  {
    label: "Dynamic add-ons",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200",
  },
];

// Helper function to safely parse numeric inputs
const safeParseNumber = (value: string, fallback: number = 0): number => {
  if (value === "") return fallback;
  if (value === "." || value === "0.") return 0; // Allow starting to type decimals
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
};

// Helper function to safely parse cents (multiplies by 100)
const safeParseCents = (value: string, fallback: number = 0): number => {
  if (value === "") return fallback;
  if (value === "." || value === "0.") return 0; // Allow starting to type decimals
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : Math.round(parsed * 100);
};

// Combined slider and input component for numeric values
const NumericInputSlider = ({
  value,
  onChange,
  min,
  max,
  step,
  label,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label?: string;
  placeholder?: string;
}) => {
  const [inputValue, setInputValue] = useState(value.toString());

  // Update input value when slider changes
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleInputChange = (inputVal: string) => {
    setInputValue(inputVal);
    const parsed = safeParseNumber(inputVal, value);
    if (parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleSliderChange = (sliderVal: number) => {
    onChange(sliderVal);
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </Label>
      )}
      <div className="flex items-start gap-3">
        <div className="relative flex-1 pt-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-slate-200/80 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:bg-slate-700/60"
            style={{
              background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${((value - min) / (max - min)) * 100}%, #e2e8f0 ${((value - min) / (max - min)) * 100}%, #e2e8f0 100%)`,
            }}
          />
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-12">
            <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white shadow-lg dark:bg-slate-950">
              {typeof value === "number" ? value.toFixed(2) : value}
            </div>
          </div>
        </div>
        <Input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={() => setInputValue(value.toString())} // Reset to actual value on blur
          placeholder={placeholder}
          className="w-24 rounded-xl border-slate-200 text-center dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 font-medium"
        />
      </div>
    </div>
  );
};

export default function AdminPricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // All useState hooks MUST be called before any conditional logic
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Compute businessId after hooks but before conditional returns
  const businessId = (session?.user as any)?.orgId || "yardura";

  // Define functions before useEffect calls
  const loadConfig = async () => {
    try {
      // Add timestamp to prevent caching
      const response = await fetch(
        `/api/admin/business-config?businessId=${businessId}&t=${Date.now()}`,
      );
      if (response.ok) {
        const data = await response.json();
        // Use the loaded config directly without merging, since it should be complete
        const loadedConfig = data.config;
        if (loadedConfig && loadedConfig.basePricing) {
          setConfig(loadedConfig);
        } else {
          setConfig(DEFAULT_YARDURA_CONFIG);
        }
      } else {
        // If no config in database, use default
        setConfig(DEFAULT_YARDURA_CONFIG);
      }
    } catch (error) {
      console.error("Error loading config:", error);
      // Fall back to default config
      setConfig(DEFAULT_YARDURA_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      // Ensure the config has all required fields by merging with defaults
      const completeConfig = {
        ...DEFAULT_YARDURA_CONFIG,
        ...config,
        // Make sure service zones are preserved
        serviceZones:
          config.serviceZones && config.serviceZones.length > 0
            ? config.serviceZones
            : DEFAULT_YARDURA_CONFIG.serviceZones,
      };

      const response = await fetch("/api/admin/business-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "update",
          config: completeConfig,
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Pricing configuration saved successfully",
        });
        // Reload config to get the saved data
        setTimeout(() => loadConfig(), 500); // Small delay to ensure DB commit
      } else {
        const errorData = await response.json();
        setMessage({
          type: "error",
          text: errorData.error || "Failed to save pricing configuration",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to save pricing configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  // ALL useEffect hooks must be called before any conditional logic
  useEffect(() => {
    if (status === "loading") return; // Still loading

    const userRole = (session as any)?.userRole;
    const isAdmin =
      userRole === "ADMIN" ||
      userRole === "OWNER" ||
      userRole === "TECH" ||
      userRole === "SALES_REP";

    if (!session || !isAdmin) {
      router.push("/dashboard");
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    loadConfig();
  }, []);

  if (status === "loading") {
    return (
      <div className="admin-surface min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-surface min-h-screen">
        <div className="container mx-auto p-6 pt-20">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="admin-surface min-h-screen">
        <div className="container mx-auto px-6 pt-24">
          <Alert className="max-w-xl border-red-200 bg-red-50 dark:border-red-400/40 dark:bg-red-500/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-100">
              Failed to load pricing configuration
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <header className="relative isolate overflow-hidden bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="absolute left-0 top-0 h-64 w-64 -translate-y-1/3 -translate-x-1/3 rounded-full bg-emerald-200/40 blur-3xl dark:bg-indigo-500/35" />
        <div className="absolute right-10 top-16 h-48 w-48 rounded-full bg-emerald-300/30 blur-[110px] dark:bg-sky-400/30" />
        <div className="absolute inset-x-0 bottom-[-18rem] h-[24rem] bg-gradient-to-t from-white via-white/60 to-transparent dark:from-slate-900 dark:via-slate-900/40" />
        <div className="container relative mx-auto px-6 py-16 space-y-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3 admin-kicker">
                <DollarSign className="h-4 w-4" />
                <span>Pricing controls</span>
              </div>
              <div className="space-y-3">
                <h1 className="admin-title">
                  Pricing Management
                </h1>
                <p className="admin-subtitle">
                  Configure cadences, multipliers, and launch promotions across InsightScoop service zones.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-4 sm:items-end">
              <div className="flex flex-wrap justify-end gap-2">
                {STATUS_BADGES.map((badge) => (
                  <Badge
                    key={badge.label}
                    className={`inline-flex max-w-[10rem] items-center gap-2 rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] ${badge.className}`}
                  >
                    <span className="truncate">{badge.label}</span>
                  </Badge>
                ))}
              </div>
              <Button
                onClick={saveConfig}
                disabled={saving}
                className="rounded-xl border border-slate-200/80 bg-white px-5 py-2 text-slate-900 shadow-lg transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-emerald-400 dark:hover:bg-emerald-500/20"
              >
                {saving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-slate-900" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Pricing Configuration
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="admin-card rounded-2xl p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Dog pricing tiers
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {(config?.basePricing?.tiers || []).length}
              </p>
            </div>
            <div className="admin-card rounded-2xl p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Frequency options
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {(config?.basePricing?.frequencies || []).length}
              </p>
            </div>
            <div className="admin-card rounded-2xl p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Yard size multipliers
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {(config?.basePricing?.yardSizes || []).length}
              </p>
            </div>
            <div className="admin-card rounded-2xl p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Active add-ons
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {
                  (config?.basePricing?.addOns || []).filter((a) => a.available)
                    .length
                }
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-6 pb-20 pt-14">
        {message && (
          <Alert
            className={`mb-6 max-w-3xl rounded-2xl border ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/15"
                : "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/15"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-200" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-200" />
            )}
            <AlertDescription
              className={
                message.type === "success"
                  ? "text-emerald-800 dark:text-emerald-100"
                  : "text-rose-800 dark:text-rose-100"
              }
            >
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-10">
          {/* Base Dog Pricing Tiers */}
          <Card className="admin-card rounded-3xl">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-indigo-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 dark:text-white">Dog Count Pricing</CardTitle>
              </div>
              <p className="text-slate-600 dark:text-slate-300 ml-11">
                Configure the base pricing for different numbers of dogs. These
                prices will be multiplied by zone multipliers and add-on costs.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.tiers || []).map((tier, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/95 p-5 shadow-sm md:grid-cols-4"
                  >
                    <div>
                      <Label className="text-sm font-medium">Dogs</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={tier.dogCount || ""}
                        onChange={(e) => {
                          const newTiers = [...config.basePricing.tiers];
                          newTiers[index].dogCount = safeParseNumber(
                            e.target.value,
                            tier.dogCount,
                          );
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              tiers: newTiers,
                            },
                          });
                        }}
                        min="1"
                        max="10"
                      />
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Base Price ($)"
                        value={
                          tier.basePriceCents ? tier.basePriceCents / 100 : 0
                        }
                        onChange={(value) => {
                          const newTiers = [...config.basePricing.tiers];
                          newTiers[index].basePriceCents = safeParseCents(
                            value.toString(),
                            tier.basePriceCents,
                          );
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              tiers: newTiers,
                            },
                          });
                        }}
                        min={0}
                        max={150}
                        step={0.5}
                        placeholder="25.00"
                      />
                    </div>
                    <div>
                      <NumericInputSlider
                        label="Extra Dog Price ($)"
                        value={
                          tier.extraDogPriceCents
                            ? tier.extraDogPriceCents / 100
                            : 0
                        }
                        onChange={(value) => {
                          const newTiers = [...config.basePricing.tiers];
                          newTiers[index].extraDogPriceCents =
                            value > 0
                              ? safeParseCents(
                                  value.toString(),
                                  tier.extraDogPriceCents,
                                )
                              : undefined;
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              tiers: newTiers,
                            },
                          });
                        }}
                        min={0}
                        max={50}
                        step={0.5}
                        placeholder="5.00"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newTiers = config.basePricing.tiers.filter(
                            (_, i) => i !== index,
                          );
                          setConfig({
                            ...config,
                            basePricing: {
                              ...config.basePricing,
                              tiers: newTiers,
                            },
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newTiers = [
                      ...config.basePricing.tiers,
                      {
                        dogCount: config.basePricing.tiers.length + 1,
                        basePriceCents: 2500,
                        extraDogPriceCents: 500,
                      },
                    ];
                    setConfig({
                      ...config,
                      basePricing: { ...config.basePricing, tiers: newTiers },
                    });
                  }}
                >
                  Add Pricing Tier
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Frequency Multipliers */}
          <Card className="admin-card rounded-3xl">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 dark:text-white">
                  Service Frequency Multipliers
                </CardTitle>
              </div>
              <p className="text-slate-600 dark:text-slate-300 ml-11">
                Configure multipliers for different service frequencies. Higher
                frequencies should have higher multipliers.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.frequencies || [])
                  .map((freq, originalIndex) => ({ freq, originalIndex }))
                  .sort((a, b) => {
                    const orderMap = new Map(
                      FREQUENCY_DISPLAY_ORDER.map((frequency, idx) => [
                        frequency,
                        idx,
                      ]),
                    );
                    const indexA = orderMap.get(a.freq.frequency) ?? 99;
                    const indexB = orderMap.get(b.freq.frequency) ?? 99;
                    return indexA - indexB;
                  })
                  .map(({ freq, originalIndex }) => {
                    const optionMeta = FREQUENCY_DETAILS[freq.frequency];

                    const handleFrequencyChange = (value: ConfigFrequency) => {
                      const newFreqs = [...config.basePricing.frequencies];
                      const meta = FREQUENCY_DETAILS[value];
                      newFreqs[originalIndex] = {
                        ...newFreqs[originalIndex],
                        frequency: value,
                        multiplier:
                          meta?.defaultMultiplier ??
                          newFreqs[originalIndex].multiplier,
                        visitsPerMonth:
                          meta?.defaultVisits ??
                          newFreqs[originalIndex].visitsPerMonth,
                      };
                      setConfig({
                        ...config,
                        basePricing: {
                          ...config.basePricing,
                          frequencies: newFreqs,
                        },
                      });
                    };

                  return (
                    <div
                      key={`${freq.frequency}-${originalIndex}`}
                      className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/95 p-5 shadow-sm md:grid-cols-4"
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Frequency</Label>
                        <Select
                          value={freq.frequency}
                          onValueChange={(value) =>
                            handleFrequencyChange(value as ConfigFrequency)
                          }
                        >
                          <SelectTrigger className="w-full justify-start rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCY_DISPLAY_ORDER.map((value) => {
                              const meta = FREQUENCY_DETAILS[value];
                              return (
                                <SelectItem key={value} value={value}>
                                  <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {meta.label}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {optionMeta ? (
                          <Badge
                            className={`${optionMeta.badgeClass} mt-1 rounded-full px-3 py-1 text-xs font-medium capitalize`}
                          >
                            {optionMeta.description}
                          </Badge>
                        ) : null}
                      </div>
                      <div>
                        <NumericInputSlider
                          label="Multiplier"
                          value={freq.multiplier}
                          onChange={(value) => {
                            const newFreqs = [...config.basePricing.frequencies];
                            newFreqs[originalIndex].multiplier = value;
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                frequencies: newFreqs,
                              },
                            });
                          }}
                          min={0}
                          max={3.0}
                          step={0.05}
                          placeholder="1.0"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">
                          Visits / Month
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={freq.visitsPerMonth ?? ""}
                          onChange={(e) => {
                            const newFreqs = [...config.basePricing.frequencies];
                            newFreqs[originalIndex].visitsPerMonth =
                              safeParseNumber(
                                e.target.value,
                                freq.visitsPerMonth,
                              );
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                frequencies: newFreqs,
                              },
                            });
                          }}
                          className="rounded-xl"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Typical: {optionMeta ? optionMeta.defaultVisits.toFixed(2) : "—"}
                          {" "}
                          visits/mo
                        </p>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => {
                            const newFreqs =
                              config.basePricing.frequencies.filter(
                                (_, i) => i !== originalIndex,
                              );
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                frequencies: newFreqs,
                              },
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="rounded-xl border-dashed border-slate-300 bg-white/70"
                  onClick={() => {
                    const existing = new Set(
                      config.basePricing.frequencies.map((f) => f.frequency),
                    );
                    const nextFrequency =
                      FREQUENCY_DISPLAY_ORDER.find(
                        (value) => !existing.has(value),
                      ) ?? "weekly";
                    const preset = FREQUENCY_DETAILS[nextFrequency];
                    const newFreqs = [
                      ...config.basePricing.frequencies,
                      {
                        frequency: nextFrequency,
                        multiplier: preset.defaultMultiplier,
                        visitsPerMonth: preset.defaultVisits,
                      },
                    ];
                    setConfig({
                      ...config,
                      basePricing: {
                        ...config.basePricing,
                        frequencies: newFreqs,
                      },
                    });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Frequency
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Yard Size Multipliers */}
          <Card className="admin-card rounded-3xl">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-pink-100 to-pink-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-pink-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 dark:text-white">
                  Yard Size Multipliers
                </CardTitle>
              </div>
              <p className="text-slate-600 dark:text-slate-300 ml-11">
                Configure multipliers for different yard sizes. Larger yards
                should have higher multipliers.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.yardSizes || []).map(
                  (yardSize, index) => (
                    <div
                      key={yardSize.size}
                      className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/95 p-5 shadow-sm md:grid-cols-4"
                    >
                      <div>
                        <Label className="text-sm font-medium">Size</Label>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3 py-2"
                          value={yardSize.size}
                          onChange={(e) => {
                            const newYardSizes = [
                              ...config.basePricing.yardSizes,
                            ];
                            newYardSizes[index].size = e.target.value as any;
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                yardSizes: newYardSizes,
                              },
                            });
                          }}
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                          <option value="xlarge">X-Large</option>
                        </select>
                      </div>
                      <div>
                        <NumericInputSlider
                          label="Multiplier"
                          value={yardSize.multiplier}
                          onChange={(value) => {
                            const newYardSizes = [
                              ...config.basePricing.yardSizes,
                            ];
                            newYardSizes[index].multiplier = value;
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                yardSizes: newYardSizes,
                              },
                            });
                          }}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          placeholder="1.0"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium">
                          Description
                        </Label>
                        <Input
                          value={yardSize.description}
                          onChange={(e) => {
                            const newYardSizes = [
                              ...config.basePricing.yardSizes,
                            ];
                            newYardSizes[index].description = e.target.value;
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                yardSizes: newYardSizes,
                              },
                            });
                          }}
                          placeholder="e.g., Townhouse or small lot"
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          {/* Initial Clean Pricing */}
          <Card className="admin-card rounded-3xl">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-xl">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 dark:text-white">
                  Initial Clean Pricing
                </CardTitle>
              </div>
              <p className="text-slate-600 dark:text-slate-300 ml-11">
                Configure pricing for initial cleanups based on time since last
                service. Higher multipliers apply to more neglected yards.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.basePricing?.initialClean?.buckets || []).map(
                  (bucket, index) => (
                    <div
                      key={bucket.bucket}
                      className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/95 p-5 shadow-sm md:grid-cols-5"
                    >
                      <div>
                        <Label className="text-sm font-medium">
                          Bucket (Days)
                        </Label>
                        <Input
                          type="text"
                          value={bucket.bucket}
                          onChange={(e) => {
                            const newBuckets = [
                              ...config.basePricing.initialClean.buckets,
                            ];
                            newBuckets[index].bucket = e.target.value;
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                initialClean: {
                                  ...config.basePricing.initialClean,
                                  buckets: newBuckets,
                                },
                              },
                            });
                          }}
                          placeholder="e.g., 14"
                        />
                      </div>
                      <div>
                        <NumericInputSlider
                          label="Multiplier"
                          value={bucket.multiplier}
                          onChange={(value) => {
                            const newBuckets = [
                              ...config.basePricing.initialClean.buckets,
                            ];
                            newBuckets[index].multiplier = value;
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                initialClean: {
                                  ...config.basePricing.initialClean,
                                  buckets: newBuckets,
                                },
                              },
                            });
                          }}
                          min={0.5}
                          max={3.0}
                          step={0.1}
                          placeholder="1.0"
                        />
                      </div>
                      <div>
                        <NumericInputSlider
                          label="Floor Price ($)"
                          value={
                            bucket.floorPriceCents
                              ? bucket.floorPriceCents / 100
                              : 0
                          }
                          onChange={(value) => {
                            const newBuckets = [
                              ...config.basePricing.initialClean.buckets,
                            ];
                            newBuckets[index].floorPriceCents = safeParseCents(
                              value.toString(),
                              bucket.floorPriceCents,
                            );
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                initialClean: {
                                  ...config.basePricing.initialClean,
                                  buckets: newBuckets,
                                },
                              },
                            });
                          }}
                          min={0}
                          max={200}
                          step={1}
                          placeholder="49.00"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium">Label</Label>
                        <Input
                          value={bucket.label}
                          onChange={(e) => {
                            const newBuckets = [
                              ...config.basePricing.initialClean.buckets,
                            ];
                            newBuckets[index].label = e.target.value;
                            setConfig({
                              ...config,
                              basePricing: {
                                ...config.basePricing,
                                initialClean: {
                                  ...config.basePricing.initialClean,
                                  buckets: newBuckets,
                                },
                              },
                            });
                          }}
                          placeholder="Description of this cleanup bucket"
                        />
                      </div>
                    </div>
                  ),
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newBuckets = [
                      ...(config.basePricing.initialClean.buckets || []),
                      {
                        bucket: "30",
                        multiplier: 1.0,
                        floorPriceCents: 4900,
                        label: "New bucket",
                      },
                    ];
                    setConfig({
                      ...config,
                      basePricing: {
                        ...config.basePricing,
                        initialClean: {
                          ...config.basePricing.initialClean,
                          buckets: newBuckets,
                        },
                      },
                    });
                  }}
                >
                  Add Cleanup Bucket
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Areas Pricing */}
          <Card className="admin-card rounded-3xl">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-900 dark:text-white">Areas Pricing</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Configure pricing for service areas. The first area is always
                free, with additional costs for each extra area.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">Free Areas</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={config.basePricing?.areaPricing?.baseAreas || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        basePricing: {
                          ...config.basePricing,
                          areaPricing: {
                            ...config.basePricing.areaPricing,
                            baseAreas: safeParseNumber(
                              e.target.value,
                              config.basePricing?.areaPricing?.baseAreas || 1,
                            ),
                          },
                        },
                      })
                    }
                    min="0"
                    className="mt-1 bg-white/90 text-slate-900 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Number of areas included free
                  </p>
                </div>
                <div>
                  <NumericInputSlider
                    label="One-time Extra ($)"
                    value={
                      config.basePricing?.areaPricing?.extraAreaCostCents
                        ? config.basePricing.areaPricing.extraAreaCostCents /
                          100
                        : 0
                    }
                    onChange={(value) =>
                      setConfig({
                        ...config,
                        basePricing: {
                          ...config.basePricing,
                          areaPricing: {
                            ...config.basePricing.areaPricing,
                            extraAreaCostCents: safeParseCents(
                              value.toString(),
                              config.basePricing?.areaPricing
                                ?.extraAreaCostCents,
                            ),
                          },
                        },
                      })
                    }
                    min={0}
                    max={20}
                    step={0.5}
                    placeholder="5.00"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cost per additional area for one-time service
                  </p>
                </div>
                <div>
                  <NumericInputSlider
                    label="Recurring Extra ($)"
                    value={
                      config.basePricing?.areaPricing
                        ?.recurringExtraAreaCostCents
                        ? config.basePricing.areaPricing
                            .recurringExtraAreaCostCents / 100
                        : 0
                    }
                    onChange={(value) =>
                      setConfig({
                        ...config,
                        basePricing: {
                          ...config.basePricing,
                          areaPricing: {
                            ...config.basePricing.areaPricing,
                            recurringExtraAreaCostCents: safeParseCents(
                              value.toString(),
                              config.basePricing?.areaPricing
                                ?.recurringExtraAreaCostCents,
                            ),
                          },
                        },
                      })
                    }
                    min={0}
                    max={15}
                    step={0.5}
                    placeholder="3.00"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cost per additional area for recurring service
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add-ons Pricing */}
          <Card className="admin-card rounded-3xl">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 dark:text-white">Service Add-ons</CardTitle>
              </div>
              <p className="text-slate-600 dark:text-slate-300 ml-11">
                Configure pricing and availability for premium service add-ons.
                Each add-on supports multiple billing modes.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {(config.basePricing?.addOns || []).map(
                  (addon, originalIndex) => {
                    // Skip spray-deck and litter add-ons
                    if (addon.id === "spray-deck" || addon.id === "litter")
                      return null;
                    return (
                      <div
                        key={addon.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-sm"
                      >
                        {/* Add-on Header */}
                        <div className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/90 px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`available-${addon.id}`}
                                  checked={addon.available}
                                  onChange={(e) => {
                                    const newAddOns = [
                                      ...config.basePricing.addOns,
                                    ];
                                    newAddOns[originalIndex].available =
                                      e.target.checked;
                                    setConfig({
                                      ...config,
                                      basePricing: {
                                        ...config.basePricing,
                                        addOns: newAddOns,
                                      },
                                    });
                                  }}
                                  className="h-4 w-4 rounded border border-gray-300 bg-gray-100 text-purple-600 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-800 dark:text-purple-300 dark:focus:ring-purple-300"
                                />
                                <Label
                                  htmlFor={`available-${addon.id}`}
                                  className="text-sm font-medium text-slate-700 dark:text-slate-200"
                                >
                                  Available
                                </Label>
                              </div>
                              <div className="h-4 w-px bg-gray-300 dark:bg-slate-700"></div>
                              <h3 className="font-semibold text-slate-900 dark:text-white">
                                {addon.name}
                              </h3>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newAddOns = (
                                  config.basePricing.addOns || []
                                ).filter((_, i) => i !== originalIndex);
                                setConfig({
                                  ...config,
                                  basePricing: {
                                    ...config.basePricing,
                                    addOns: newAddOns,
                                  },
                                });
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:text-red-200 dark:hover:bg-red-500/10"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>

                        {/* Add-on Details */}
                        <div className="space-y-4 bg-white p-6 dark:bg-slate-900">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                Add-on ID
                              </Label>
                              <Input
                                value={addon.id}
                                onChange={(e) => {
                                  const newAddOns = [
                                    ...config.basePricing.addOns,
                                  ];
                                  newAddOns[originalIndex].id = e.target.value;
                                  setConfig({
                                    ...config,
                                    basePricing: {
                                      ...config.basePricing,
                                      addOns: newAddOns,
                                    },
                                  });
                                }}
                                placeholder="unique-id"
                                className="mt-1 bg-white/90 text-slate-900 dark:bg-slate-900/70 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                Display Name
                              </Label>
                              <Input
                                value={addon.name}
                                onChange={(e) => {
                                  const newAddOns = [
                                    ...config.basePricing.addOns,
                                  ];
                                  newAddOns[originalIndex].name =
                                    e.target.value;
                                  setConfig({
                                    ...config,
                                    basePricing: {
                                      ...config.basePricing,
                                      addOns: newAddOns,
                                    },
                                  });
                                }}
                                placeholder="Service name"
                                className="mt-1 bg-white/90 text-slate-900 dark:bg-slate-900/70 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              Description
                            </Label>
                              <Input
                                value={addon.description}
                              onChange={(e) => {
                                const newAddOns = [
                                  ...config.basePricing.addOns,
                                ];
                                newAddOns[originalIndex].description =
                                  e.target.value;
                                setConfig({
                                  ...config,
                                  basePricing: {
                                    ...config.basePricing,
                                    addOns: newAddOns,
                                  },
                                });
                              }}
                              placeholder="Brief description of the service"
                                className="mt-1 bg-white/90 text-slate-900 dark:bg-slate-900/70 dark:text-slate-100"
                              />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <NumericInputSlider
                                label="Base Price ($)"
                                value={
                                  addon.priceCents ? addon.priceCents / 100 : 0
                                }
                                onChange={(value) => {
                                  const newAddOns = [
                                    ...config.basePricing.addOns,
                                  ];
                                  newAddOns[originalIndex].priceCents =
                                    safeParseCents(
                                      value.toString(),
                                      addon.priceCents,
                                    );
                                  setConfig({
                                    ...config,
                                    basePricing: {
                                      ...config.basePricing,
                                      addOns: newAddOns,
                                    },
                                  });
                                }}
                                min={0}
                                max={addon.id.startsWith("divert") ? 20 : 100} // Lower max for diversion add-ons
                                step={addon.id.startsWith("divert") ? 0.5 : 1} // Smaller steps for diversion add-ons
                                placeholder={
                                  addon.id.startsWith("divert")
                                    ? "2.00"
                                    : "25.00"
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                Default Billing Mode
                              </Label>
                              <select
                                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-900"
                                value={addon.billingMode}
                                onChange={(e) => {
                                  const newAddOns = [
                                    ...config.basePricing.addOns,
                                  ];
                                  newAddOns[originalIndex].billingMode = e
                                    .target.value as any;
                                  setConfig({
                                    ...config,
                                    basePricing: {
                                      ...config.basePricing,
                                      addOns: newAddOns,
                                    },
                                  });
                                }}
                              >
                                <option value="first-visit">
                                  First Visit Only
                                </option>
                                <option value="each-visit">Each Visit</option>
                                <option value="every-other">
                                  Every Other Visit
                                </option>
                                <option value="one-time">One-time</option>
                              </select>
                            </div>
                          </div>

                          {/* Billing Mode Availability */}
                          <div>
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 block">
                              Available Billing Modes
                            </Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                              Customers can choose from these billing options
                              during quote
                            </p>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                              {[
                                { value: "first-visit", label: "First Visit" },
                                { value: "each-visit", label: "Each Visit" },
                                { value: "every-other", label: "Every Other" },
                                { value: "one-time", label: "One-time" },
                              ].map((mode) => (
                                <div
                                  key={mode.value}
                                  className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-slate-800/60"
                                >
                                  <input
                                    type="checkbox"
                                    id={`${addon.id}-${mode.value}`}
                                    checked={addon.available} // For now, all modes are available if addon is available
                                    onChange={() => {
                                      // Future: implement per-mode availability
                                    }}
                                    className="h-4 w-4 rounded border border-gray-300 bg-gray-100 text-purple-600 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-800 dark:text-purple-300 dark:focus:ring-purple-300"
                                  />
                                  <div>
                                    <Label
                                      htmlFor={`${addon.id}-${mode.value}`}
                                      className="text-xs font-medium text-slate-700 dark:text-slate-200"
                                    >
                                      {mode.label}
                                    </Label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
