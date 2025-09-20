"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { StepProps } from "@/types/quote";
import type { AddOnConfig } from "@/lib/business-config";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const StepContactReview: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  estimatedPrice,
  onNext,
}) => {
  const [availableAddOns, setAvailableAddOns] = useState<AddOnConfig[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/business-config", { cache: "no-store" });
        if (res.ok) {
          const { config } = await res.json();
          setAvailableAddOns(
            (config?.basePricing?.addOns || []).filter(
              (a: AddOnConfig) => a.available,
            ),
          );
        }
      } catch (e) {}
    };
    load();
  }, []);

  const visitsPerMonth = useMemo(() => {
    switch (quoteData?.frequency) {
      case "twice-weekly":
        return 8.67;
      case "weekly":
        return 4.33;
      case "biweekly":
        return 2.17;
      case "monthly":
        return 1;
      default:
        return undefined;
    }
  }, [quoteData?.frequency]);

  const getAddon = (id: string) => availableAddOns.find((a) => a.id === id);

  const renderAddonLines = () => {
    const lines: Array<{ label: string; price: string }> = [];
    const add = (label: string, price: string) => lines.push({ label, price });

    if (quoteData?.addOns?.deodorize) {
      const a = getAddon("deodorize");
      if (a) {
        const mode = quoteData.addOns.deodorizeMode || "each-visit";
        const base = a.priceCents / 100;
        if (mode === "each-visit")
          add(
            "Deodorize & Sanitize (each visit)",
            `+$${base.toFixed(2)} / visit`,
          );
        if (mode === "every-other")
          add(
            "Deodorize & Sanitize (every other)",
            `+$${(Math.round(a.priceCents / 2) / 100).toFixed(2)} / visit`,
          );
        if (mode === "first-visit" || mode === "one-time")
          add(
            "Deodorize & Sanitize (first visit only)",
            `+$${base.toFixed(2)} one-time`,
          );
      }
    }

    if (
      quoteData?.addOns?.divertMode &&
      quoteData.addOns.divertMode !== "none"
    ) {
      const map: Record<string, string> = {
        takeaway: "divert-takeaway",
        "25": "divert-25",
        "50": "divert-50",
        "100": "divert-100",
      };
      const id = map[quoteData.addOns.divertMode];
      const a = id ? getAddon(id) : undefined;
      if (a) add(`${a.name}`, `+$${(a.priceCents / 100).toFixed(2)} / visit`);
    }

    return lines.length ? (
      <div className="space-y-1">
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between text-xs text-gray-600">
            <span>{l.label}</span>
            <span>{l.price}</span>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-xs text-muted-foreground">None</div>
    );
  };

  const areasSummary = useMemo(() => {
    const areas: string[] = [];
    if (quoteData?.areasToClean?.frontYard) areas.push("Front");
    if (quoteData?.areasToClean?.backYard) areas.push("Back");
    if (quoteData?.areasToClean?.sideYard) areas.push("Side");
    if (quoteData?.areasToClean?.dogRun) areas.push("Dog Run");
    if (quoteData?.areasToClean?.fencedArea) areas.push("Additional Fenced");
    if (quoteData?.areasToClean?.other)
      areas.push(quoteData.areasToClean.other as unknown as string);
    return areas.length ? areas.join(", ") : "Standard areas";
  }, [quoteData?.areasToClean]);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-teal-700" />
            Contact & Confirm
          </CardTitle>
          <p className="text-muted">
            Review your service details and enter your contact info
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Service Address - First */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Service Address
            </label>
            <AddressAutocomplete
              value={quoteData?.address || ""}
              onSelect={(data) => {
                updateQuoteData({
                  address: data.formattedAddress,
                  addressValidated: true,
                  addressMeta: {
                    city: data.city,
                    state: data.state,
                    postalCode: data.postalCode,
                    latitude: data.latitude,
                    longitude: data.longitude,
                  },
                });
              }}
              onChange={(value) =>
                updateQuoteData({ address: value, addressValidated: false })
              }
              placeholder="Start typing your address"
            />
            {!quoteData?.addressValidated && quoteData?.address && (
              <div className="mt-1 text-xs text-amber-600">
                Address not yet validated
              </div>
            )}
          </div>

          {/* Service Summary - Full Width */}
          <div className="bg-teal-700/5 border border-teal-700/20 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-medium text-teal-700/80">
                Service Summary
              </div>
              {visitsPerMonth && (
                <div className="text-sm text-muted-foreground">
                  {visitsPerMonth.toFixed(2)} visits / month
                </div>
              )}
            </div>
            {estimatedPrice && (
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-700">Billed monthly</div>
                <div className="font-bold text-teal-700 text-2xl">
                  ${(estimatedPrice as any).monthly || "—"}
                </div>
              </div>
            )}
          </div>

          {/* Service Details - Full Width */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <div className="text-lg font-medium text-gray-700 mb-4">
              Service Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quoteData?.dogs !== undefined && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Dogs:</span>
                  <span className="font-medium text-teal-700">
                    {quoteData.dogs} dog{quoteData.dogs !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {quoteData?.yardSize && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Property Type:</span>
                  <span className="font-medium text-teal-700 capitalize">
                    {quoteData.yardSize === "xl" ? "XL" : quoteData.yardSize}
                  </span>
                </div>
              )}
              {quoteData?.frequency && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Service Type:</span>
                  <span className="font-medium text-teal-700 capitalize">
                    {quoteData.frequency.replace("-", " ")}
                  </span>
                </div>
              )}
              {quoteData?.areasToClean && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Areas to Clean:</span>
                  <span className="font-medium text-teal-700">
                    {areasSummary}
                  </span>
                </div>
              )}
            </div>
            <div className="pt-4 border-t">
              <div className="text-lg font-medium text-gray-700 mb-3">
                Add-ons
              </div>
              {renderAddonLines()}
            </div>
            <div className="pt-4 border-t">
              <div className="text-lg font-medium text-gray-700 mb-1">
                Service Address
              </div>
              <div className="text-sm text-muted-foreground">
                {quoteData?.address || "Not provided"}
              </div>
            </div>
          </div>

          {/* Contact Form - Full Width */}
          <div className="space-y-6">
            {/* Preferred Start Date */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Preferred Start Date
              </label>
              <p className="text-sm text-muted mb-4">
                Select your preferred start date
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Next 3 available dates */}
                {(() => {
                  const dates = [];
                  const today = new Date();
                  for (let i = 0; i < 3; i++) {
                    const date = new Date(today);
                    date.setDate(today.getDate() + i + 1); // Start from tomorrow
                    dates.push({
                      date: date,
                      formatted: date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      }),
                      value: date.toISOString().split("T")[0],
                    });
                  }
                  return dates.map((dateOption, index) => (
                    <label
                      key={index}
                      className={`cursor-pointer border-2 rounded-lg p-3 transition-all duration-200 ${
                        quoteData?.preferredStartDate === dateOption.value
                          ? "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-gray-200 hover:border-teal-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="preferredStartDate"
                        value={dateOption.value}
                        checked={
                          quoteData?.preferredStartDate === dateOption.value
                        }
                        onChange={(e) =>
                          updateQuoteData({
                            preferredStartDate: e.target.value,
                          })
                        }
                        className="sr-only"
                      />
                      <div className="text-center">
                        <div className="font-medium">
                          {dateOption.formatted}
                        </div>
                      </div>
                    </label>
                  ));
                })()}
              </div>

              {/* Date picker for other dates */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Or select another date
                </label>
                <input
                  type="date"
                  value={quoteData?.customStartDate || ""}
                  onChange={(e) => {
                    updateQuoteData({
                      customStartDate: e.target.value,
                      preferredStartDate: e.target.value,
                    });
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                  min={
                    new Date(Date.now() + 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split("T")[0]
                  }
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    placeholder="Enter your full name"
                    value={quoteData?.contact?.name || ""}
                    onChange={(e) =>
                      updateQuoteData({
                        contact: {
                          ...quoteData?.contact,
                          name: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    placeholder="your.email@example.com"
                    value={quoteData?.contact?.email || ""}
                    onChange={(e) =>
                      updateQuoteData({
                        contact: {
                          ...quoteData?.contact,
                          email: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="(555) 123-4567"
                  value={quoteData?.contact?.phone || ""}
                  onChange={(e) =>
                    updateQuoteData({
                      contact: { ...quoteData?.contact, phone: e.target.value },
                    })
                  }
                />
              </div>

              {/* Preferred Contact Method */}
              <div>
                <label className="block text-base font-medium mb-2">
                  Preferred contact method{" "}
                  <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-muted mb-4">Select all that apply</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "text", label: "Text", icon: "📱" },
                    { id: "mobile", label: "Mobile", icon: "📞" },
                    { id: "email", label: "Email", icon: "✉️" },
                  ].map((method) => (
                    <label
                      key={method.id}
                      className={`cursor-pointer border-2 rounded-lg p-4 transition-all duration-200 ${
                        quoteData?.preferredContactMethods?.includes(method.id)
                          ? "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-gray-200 hover:border-teal-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="preferredContactMethods"
                        value={method.id}
                        checked={
                          quoteData?.preferredContactMethods?.includes(
                            method.id,
                          ) || false
                        }
                        onChange={(e) => {
                          const current =
                            quoteData?.preferredContactMethods || [];
                          const updated = e.target.checked
                            ? [...current, method.id]
                            : current.filter((m: string) => m !== method.id);
                          updateQuoteData({ preferredContactMethods: updated });
                        }}
                        className="sr-only"
                      />
                      <div className="text-center">
                        <div className="text-2xl mb-2">{method.icon}</div>
                        <div className="font-medium">{method.label}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* SMS consent for text */}
                {quoteData?.preferredContactMethods?.includes("text") && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quoteData?.smsConsent || false}
                        onChange={(e) =>
                          updateQuoteData({ smsConsent: e.target.checked })
                        }
                        className="mt-1 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-blue-800">
                        Send SMS updates about my service to this number.
                        (Additional carrier rates may apply)
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* How did you hear about us? */}
              <div>
                <label className="block text-base font-medium mb-2">
                  How did you hear about us?
                </label>
                <p className="text-sm text-muted mt-1 mb-3">
                  Help us understand how you found Yardura
                </p>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                  value={quoteData?.howDidYouHear || ""}
                  onChange={(e) =>
                    updateQuoteData({ howDidYouHear: e.target.value })
                  }
                >
                  <option value="">Select how you found us</option>
                  <option value="social-media">Social Media</option>
                  <option value="referral-business">Referral - Business</option>
                  <option value="referral-family">
                    Referral - Family/Friend
                  </option>
                  <option value="yard-sign">Yard Sign</option>
                  <option value="search-engine">Search Engine</option>
                  <option value="truck">Truck</option>
                  <option value="direct-mail">Direct Mail</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
