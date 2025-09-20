"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { PricingData, QuoteData } from "@/types/quote";
import { AddOnConfig } from "@/lib/business-config";

interface PricingSummaryProps {
  pricing: PricingData;
  frequency?: string;
  quoteData?: QuoteData;
}

export const PricingSummary = ({
  pricing,
  frequency,
  quoteData,
}: PricingSummaryProps) => {
  const [availableAddOns, setAvailableAddOns] = useState<AddOnConfig[]>([]);

  // Load business config via public API (server-side)
  const loadConfig = async (force = false) => {
    try {
      const timestamp = force ? `?_=${Date.now()}` : "";
      const res = await fetch(`/api/business-config${timestamp}`, {
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(`Failed to fetch business config: ${res.status}`);
      const { config } = await res.json();
      setAvailableAddOns(
        config.basePricing.addOns.filter(
          (addon: AddOnConfig) => addon.available,
        ),
      );
      if (force) {
        console.log("PricingSummary loaded config for orgId: yardura");
        console.log(
          "PricingSummary pricing - deodorize:",
          config.basePricing.addOns.find((a: any) => a.id === "deodorize")
            ?.priceCents,
          "spray-deck:",
          config.basePricing.addOns.find((a: any) => a.id === "spray-deck")
            ?.priceCents,
        );
      }
    } catch (error) {
      console.error(
        "Failed to load business config for pricing summary:",
        error,
      );
    }
  };

  // Load business config on mount
  useEffect(() => {
    loadConfig(true);
  }, []);

  // Force reload config when component becomes visible or window gains focus
  useEffect(() => {
    const handleFocus = () => loadConfig(true);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadConfig(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Helper function to calculate add-on pricing
  const calculateAddonPrice = (addon: AddOnConfig, billingMode: string) => {
    let priceCents = addon.priceCents;

    if (billingMode === "every-other") {
      priceCents = Math.round(priceCents / 2);
    }

    const price = (priceCents / 100).toFixed(2);
    return price;
  };

  // Helper function to get add-on display info
  const getAddonDisplay = (addonId: string, mode: string) => {
    const addon = availableAddOns.find((a) => a.id === addonId);
    if (!addon) return { name: addonId, price: "0.00" };

    const price = calculateAddonPrice(addon, mode);
    return { name: addon.name, price };
  };

  // Helper function to get diversion display info
  const getDiversionDisplay = (divertMode: string) => {
    const diversionMap: Record<string, string> = {
      takeaway: "divert-takeaway",
      "25": "divert-25",
      "50": "divert-50",
      "100": "divert-100",
    };

    const addonId = diversionMap[divertMode];
    if (!addonId) return { name: "Waste Diversion", price: "0.00" };

    const addon = availableAddOns.find((a) => a.id === addonId);
    if (!addon) return { name: "Waste Diversion", price: "0.00" };

    const price = calculateAddonPrice(addon, "each-visit"); // All diversion add-ons use each-visit billing
    return { name: addon.name, price };
  };

  if (!pricing) return null;

  // Handle commercial/custom quote case
  if (pricing.requiresCustomQuote) {
    return (
      <div className="sticky top-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Custom Quote Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {pricing.commercialMessage ||
                "Please contact us for a custom quote based on your property details."}
            </p>
            <div className="space-y-2">
              <a
                href="tel:1-888-915-9273"
                className="flex items-center gap-2 text-teal-700 hover:text-teal-700-dark"
              >
                <Phone className="size-4" />
                <span>Call 1-888-915-YARD</span>
              </a>
              <a
                href="/contact"
                className="flex items-center gap-2 text-teal-700 hover:text-teal-700-dark"
              >
                <Mail className="size-4" />
                <span>Request more information</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate discount for initial clean and dynamic one-time add-ons based on frequency
  const getInitialCleanDiscount = () => {
    if (frequency === "onetime") return null; // No discount for one-time

    const initialCleanAmount = parseFloat((pricing as any).initialClean || "0");
    if (initialCleanAmount === 0) return null; // No initial clean needed

    // Calculate first-visit-only add-ons dynamically from availableAddOns
    let firstVisitAddOns = 0;
    if (quoteData?.addOns?.deodorizeMode === "first-visit") {
      const addon = availableAddOns.find((a) => a.id === "deodorize");
      if (addon) firstVisitAddOns += addon.priceCents / 100;
    }
    if (quoteData?.addOns?.sprayDeckMode === "first-visit") {
      const addon = availableAddOns.find((a) => a.id === "spray-deck");
      if (addon) firstVisitAddOns += addon.priceCents / 100;
    }

    if (frequency === "monthly") {
      return {
        discountPercent: 50,
        discountAmount: initialCleanAmount * 0.5,
        finalAmount: initialCleanAmount * 0.5 + firstVisitAddOns,
      };
    } else if (
      ["weekly", "biweekly", "twice-weekly"].includes(frequency || "")
    ) {
      return {
        discountPercent: 100,
        discountAmount: initialCleanAmount,
        finalAmount: firstVisitAddOns,
      };
    }

    return null;
  };

  const discount = getInitialCleanDiscount();

  return (
    <div className="sticky top-4">
      {/* Top-Level Price Display - Enhanced Branding */}
      <div className="bg-gradient-to-br from-accent/10 via-accent/5 to-white border-2 border-teal-700/20 rounded-xl p-6 mb-6 shadow-lg backdrop-blur-sm">
        {frequency === "onetime" ? (
          // One-time service: show single price
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-700/20 rounded-full mb-3">
              <span className="text-teal-700 font-bold text-lg">💰</span>
            </div>
            <div className="text-sm font-medium text-teal-700/80 mb-2">
              One-time service cost
            </div>
            <div className="text-3xl font-bold text-teal-700">
              ${(pricing as any).oneTime}
            </div>
          </div>
        ) : (
          // Recurring service: show per-visit and first-visit pricing
          <>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-700/20 rounded-full mb-3">
                <span className="text-teal-700 font-bold text-lg">🔄</span>
              </div>
              <div className="text-sm font-medium text-teal-700/80">
                Recurring Service Pricing
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg border border-teal-700/10">
                <span className="text-sm font-medium text-gray-700">
                  Price per visit
                </span>
                <span className="font-bold text-lg text-teal-700">
                  ${(pricing as any).perVisit}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg border border-teal-700/10">
                <span className="text-sm font-medium text-gray-700">
                  Total for first visit
                </span>
                <span className="font-bold text-lg text-teal-700">
                  {discount
                    ? `$${discount.finalAmount.toFixed(2)}`
                    : `$${(pricing as any).oneTime}`}
                </span>
              </div>
            </div>

            {/* Show discount explanation for free initial clean */}
            {discount && discount.discountPercent === 100 && (
              <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-green-600">🎉</span>
                  <p className="text-sm font-medium text-green-800 text-center">
                    <strong>Initial clean FREE</strong> with weekly, bi-weekly,
                    or twice-weekly subscriptions!
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Service Summary - Enhanced Branding */}
      <Card className="shadow-lg border-teal-700/10 bg-gradient-to-br from-white to-accent/5">
        <CardHeader className="pb-4 bg-gradient-to-r from-accent/5 to-transparent border-b border-teal-700/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-teal-700">📋</span>
            Service Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Basic service details */}
          <div className="space-y-3">
            {quoteData?.dogs && (
              <div className="flex justify-between items-center p-3 bg-white/70 rounded-lg border border-teal-700/10">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span>🐕</span>
                  Number of dogs
                </span>
                <span className="font-semibold text-teal-700">
                  {quoteData.dogs} dog{quoteData.dogs !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {quoteData?.yardSize && (
              <div className="flex justify-between items-center p-3 bg-white/70 rounded-lg border border-teal-700/10">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span>🏠</span>
                  Property type
                </span>
                <span className="font-semibold text-teal-700 capitalize">
                  {quoteData.yardSize === "xl" ? "XL" : quoteData.yardSize}
                </span>
              </div>
            )}
            {frequency && frequency !== "onetime" && (
              <div className="flex justify-between items-center p-3 bg-white/70 rounded-lg border border-teal-700/10">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span>🔄</span>
                  Service frequency
                </span>
                <span className="font-semibold text-teal-700 capitalize">
                  {frequency.replace("-", " ")}
                </span>
              </div>
            )}
            {quoteData?.areasToClean &&
              Object.values(quoteData.areasToClean).some((v) => v) && (
                <div className="flex justify-between items-start p-3 bg-white/70 rounded-lg border border-teal-700/10">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2 mt-1">
                    <span>🗺️</span>
                    Service areas
                  </span>
                  <span className="font-semibold text-teal-700 text-right">
                    {(() => {
                      const areas = [];
                      if (quoteData.areasToClean.frontYard) areas.push("Front");
                      if (quoteData.areasToClean.backYard) areas.push("Back");
                      if (quoteData.areasToClean.sideYard) areas.push("Side");
                      if (quoteData.areasToClean.dogRun) areas.push("Dog Run");
                      if (quoteData.areasToClean.fencedArea)
                        areas.push("Additional Fenced");
                      if (quoteData.areasToClean.other)
                        areas.push(quoteData.areasToClean.other);
                      return areas.length > 0
                        ? areas.join(", ")
                        : "Standard areas";
                    })()}
                  </span>
                </div>
              )}
          </div>

          {/* Add-ons Section - Conditional */}
          {quoteData?.addOns && (
            <>
              <div className="border-t border-gray-200 pt-3">
                <div className="text-sm font-medium mb-2">Add-ons</div>
                <div className="space-y-1">
                  {/* Deodorize */}
                  {quoteData.addOns.deodorize &&
                    (() => {
                      const deodorizeInfo = getAddonDisplay(
                        "deodorize",
                        quoteData.addOns.deodorizeMode || "each-visit",
                      );
                      return (
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>
                            {deodorizeInfo.name}
                            {quoteData.addOns.deodorizeMode === "first-visit" &&
                              " (First visit only)"}
                            {quoteData.addOns.deodorizeMode === "each-visit" &&
                              " (Each visit)"}
                            {quoteData.addOns.deodorizeMode === "every-other" &&
                              " (Every other visit)"}
                            {quoteData.addOns.deodorizeMode === "one-time" &&
                              " (One-time service)"}
                          </span>
                          <span>
                            +${deodorizeInfo.price}
                            {quoteData.addOns.deodorizeMode === "first-visit" &&
                              " one-time"}
                            {quoteData.addOns.deodorizeMode === "each-visit" &&
                              " per visit"}
                            {quoteData.addOns.deodorizeMode === "every-other" &&
                              " per visit"}
                            {quoteData.addOns.deodorizeMode === "one-time" &&
                              " one-time"}
                          </span>
                        </div>
                      );
                    })()}

                  {/* Spray Deck */}
                  {quoteData.addOns.sprayDeck &&
                    (() => {
                      const sprayDeckInfo = getAddonDisplay(
                        "spray-deck",
                        quoteData.addOns.sprayDeckMode || "each-visit",
                      );
                      return (
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>
                            {sprayDeckInfo.name}
                            {quoteData.addOns.sprayDeckMode === "first-visit" &&
                              " (First visit only)"}
                            {quoteData.addOns.sprayDeckMode === "each-visit" &&
                              " (Each visit)"}
                            {quoteData.addOns.sprayDeckMode === "every-other" &&
                              " (Every other visit)"}
                            {quoteData.addOns.sprayDeckMode === "one-time" &&
                              " (One-time service)"}
                          </span>
                          <span>
                            +${sprayDeckInfo.price}
                            {quoteData.addOns.sprayDeckMode === "first-visit" &&
                              " one-time"}
                            {quoteData.addOns.sprayDeckMode === "each-visit" &&
                              " per visit"}
                            {quoteData.addOns.sprayDeckMode === "every-other" &&
                              " per visit"}
                            {quoteData.addOns.sprayDeckMode === "one-time" &&
                              " one-time"}
                          </span>
                        </div>
                      );
                    })()}

                  {/* Waste Diversion */}
                  {quoteData.addOns.divertMode &&
                    quoteData.addOns.divertMode !== "none" &&
                    (() => {
                      const diversionInfo = getDiversionDisplay(
                        quoteData.addOns.divertMode,
                      );
                      return (
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>
                            🌱 {diversionInfo.name}
                            {quoteData.addOns.divertMode === "takeaway" &&
                              " (standard)"}
                            {quoteData.addOns.divertMode === "25" &&
                              " - divert 25%"}
                            {quoteData.addOns.divertMode === "50" &&
                              " - divert 50%"}
                            {quoteData.addOns.divertMode === "100" &&
                              " - divert 100%"}
                          </span>
                          <span>
                            +${diversionInfo.price}
                            {frequency === "one-time"
                              ? " one-time"
                              : " per visit"}
                          </span>
                        </div>
                      );
                    })()}
                </div>
              </div>
            </>
          )}

          {/* One-time Charges Section - Conditional */}
          {parseFloat((pricing as any).initialClean || "0") > 0 && (
            <div className="border-t border-gray-200 pt-3">
              <div className="text-sm font-medium mb-2">One-time charges</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Initial clean</span>
                  <span>${(pricing as any).initialClean}</span>
                </div>

                {discount && (
                  <div className="flex justify-between text-xs text-green-600 bg-green-50 p-2 rounded">
                    <span>
                      🎉 Initial clean discount ({discount.discountPercent}%
                      off)
                    </span>
                    <span>-${discount.discountAmount.toFixed(2)}</span>
                  </div>
                )}

                {/* First-visit-only add-ons */}
                {quoteData?.addOns?.deodorizeMode === "first-visit" &&
                  (() => {
                    const addon = availableAddOns.find(
                      (a) => a.id === "deodorize",
                    );
                    const price = addon
                      ? (addon.priceCents / 100).toFixed(2)
                      : "0.00";
                    return (
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Deodorize & Sanitize (first visit only)</span>
                        <span>+${price}</span>
                      </div>
                    );
                  })()}
                {quoteData?.addOns?.sprayDeckMode === "first-visit" &&
                  (() => {
                    const addon = availableAddOns.find(
                      (a) => a.id === "spray-deck",
                    );
                    const price = addon
                      ? (addon.priceCents / 100).toFixed(2)
                      : "0.00";
                    return (
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Spray Deck/Patio (first visit only)</span>
                        <span>+${price}</span>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

          {/* Final Total */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total for first visit</span>
              <span className="font-semibold text-lg">
                {discount
                  ? `$${discount.finalAmount.toFixed(2)}`
                  : `$${(pricing as any).oneTime}`}
              </span>
            </div>

            {/* Monthly billing note */}
            {frequency !== "onetime" &&
              (pricing as any).monthly !== (pricing as any).oneTime &&
              (pricing as any).monthly !== "0.00" && (
                <div className="text-xs text-gray-500 text-center pt-2">
                  Billed monthly: ${(pricing as any).monthly}
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Questions section */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800 mb-2">
          <strong>Questions about your quote?</strong>
        </p>
        <p className="text-xs text-blue-700">
          Call us at{" "}
          <a
            href="tel:1-888-915-9273"
            className="text-blue-600 hover:underline"
          >
            1-888-915-YARD
          </a>{" "}
          or{" "}
          <a href="/contact" className="text-blue-600 hover:underline">
            request more information
          </a>
        </p>
      </div>
    </div>
  );
};
