"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle,
  Check,
  Phone,
  Mail,
  Settings,
  MapPin,
  Clock,
  Loader2,
  Star,
  Shield,
  Truck,
  Users,
  Award,
  Sparkles,
  Heart,
  Zap,
  AlertCircle,
  Building,
  Home,
  Calendar,
  User,
} from "lucide-react";

import { useSession } from "next-auth/react";
import { track } from "@/lib/analytics";

// New validation system
import { validateStep, validateField } from "./validation/schemas";
import { useZipValidation } from "./validation/useZipValidation";
import {
  scrollToFirstError,
  announceValidationErrors,
} from "./validation/formUtils";
import { QuoteStepFooter } from "./QuoteStepFooter";
import { getZoneMultiplierFromZip } from "@/lib/pricing";
import {
  QuoteInput,
  getPremiumOnboardingOptions,
  getServiceTypeOptions,
  getFrequencyDisplayName,
} from "@/lib/priceEstimator";
// import { FormProtection } from '@/components/ui/recaptcha'; // Temporarily disabled
import { env } from "@/lib/env";
import { StepCustomization as ExternalStepCustomization } from "./steps/StepCustomization";
import { getBusinessConfig, AddOnConfig } from "@/lib/business-config";
import { StepContactReview as ExternalStepContactReview } from "./steps/StepContactReview";
import { PricingSummary as ExternalPricingSummary } from "@/components/quote/components/PricingSummary";
import { StepWellness } from "./steps/StepWellness";
import { StepOnboarding } from "./steps/StepOnboarding";
import { StepCommercialContact } from "./steps/StepCommercialContact";

// Transform add-ons from quote format to pricing API format
const transformAddOnsForPricing = (addOns: any) => {
  const transformed: any = {};

  // Handle deodorize
  if (addOns.deodorize && addOns.deodorizeMode) {
    transformed.deodorize = { mode: addOns.deodorizeMode };
  }

  // Handle spray deck
  if (addOns.sprayDeck && addOns.sprayDeckMode) {
    transformed["spray-deck"] = { mode: addOns.sprayDeckMode };
  }

  // Handle waste diversion
  if (addOns.divertMode && addOns.divertMode !== "none") {
    if (addOns.divertMode === "takeaway") {
      transformed["divert-takeaway"] = true;
    } else if (addOns.divertMode === "25") {
      transformed["divert-25"] = true;
    } else if (addOns.divertMode === "50") {
      transformed["divert-50"] = true;
    } else if (addOns.divertMode === "100") {
      transformed["divert-100"] = true;
    }
  }

  // Handle custom add-ons - look for any add-on with a corresponding mode
  Object.keys(addOns).forEach((key) => {
    if (
      key.endsWith("Mode") &&
      addOns[key] &&
      addOns[key.replace("Mode", "")]
    ) {
      const addonId = key.replace("Mode", "");
      transformed[addonId] = { mode: addOns[key] };
    }
  });

  return transformed;
};

// Helper function to get dynamic add-on pricing
const getAddonDisplay = (addonId: string, mode: string) => {
  // This is a simplified version - in a real implementation, you'd load from business config
  // For now, return a default structure that matches the expected format
  return {
    name: addonId,
    price: "+$0.00", // This will be replaced by the actual dynamic pricing system
  };
};

// pricing summary sidebar component
const PricingSummary = ({
  pricing,
  frequency,
  currentStep,
  quoteData,
}: {
  pricing: any;
  frequency?: string;
  currentStep?: number;
  quoteData?: any;
}) => {
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

  // Calculate discount for initial clean based on frequency
  const getInitialCleanDiscount = () => {
    if (frequency === "onetime") return null; // No discount for one-time

    const initialCleanAmount = parseFloat(pricing.initialClean || "0");
    if (initialCleanAmount === 0) return null; // No initial clean needed

    // Calculate first-visit-only add-ons that should be added to the discounted amount
    // Note: Only include TRULY first-visit-only add-ons, not recurring per-visit add-ons
    let firstVisitAddOns = 0;
    if (quoteData.addOns?.deodorizeMode === "first-visit") {
      firstVisitAddOns += 25; // $25 for deodorize (first visit only)
    }
    if (quoteData.addOns?.sprayDeckMode === "first-visit") {
      firstVisitAddOns += 12; // $12 for spray deck (first visit only)
    }
    // Don't include divert/takeaway here as they're per-visit add-ons, not first-visit-only

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
      {/* Header with per-visit and first-visit prices */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        {/* Show different pricing based on step and frequency */}
        {frequency === "onetime" ? (
          // One-time service: only show initial clean cost
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">
              One-time service cost
            </div>
            <span className="font-semibold text-lg">${pricing.oneTime}</span>
          </div>
        ) : currentStep === 2 ? (
          // Property details step: show per-visit with free initial visit indicator
          <>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Price per visit</span>
              <span className="font-semibold text-lg">${pricing.perVisit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Total for first visit
              </span>
              <span className="font-semibold text-lg">${pricing.oneTime}</span>
            </div>
            {/* Free initial visit indicator for property details step */}
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
              <p className="text-xs text-green-700 text-center">
                💚 <strong>Initial clean FREE</strong> with weekly, bi-weekly,
                or twice-weekly subscriptions!
              </p>
            </div>
          </>
        ) : (
          // Other steps: show normal pricing with discount if applicable
          <>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Price per visit</span>
              <span className="font-semibold text-lg">${pricing.perVisit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Total for first visit
              </span>
              <span className="font-semibold text-lg">
                {discount
                  ? `$${discount.finalAmount.toFixed(2)}`
                  : `$${pricing.oneTime}`}
              </span>
            </div>
            {/* Show discount explanation if applicable */}
            {discount && discount.discountPercent === 100 && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                <p className="text-xs text-green-700 text-center">
                  💚 Initial clean FREE with recurring weekly, biweekly or
                  twice-weekly service!
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Service Summary */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Service Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Service Breakdown */}
          {frequency === "onetime" ? (
            // One-time service: focus on the service details
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">One-time service</span>
                <span className="text-sm font-medium">${pricing.oneTime}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1 ml-2">
                <div>• Complete yard cleanup</div>
                <div>
                  • {quoteData?.dogs || 2} Dog{quoteData?.dogs > 1 ? "s" : ""}
                </div>
                <div>
                  •{" "}
                  {quoteData?.yardSize
                    ? quoteData.yardSize === "xl"
                      ? "XL"
                      : quoteData.yardSize.charAt(0).toUpperCase() +
                        quoteData.yardSize.slice(1)
                    : "Medium"}{" "}
                  property
                </div>
                {quoteData?.areasToClean &&
                  Object.values(quoteData.areasToClean).some((v) => v) && (
                    <div>
                      • Service areas:{" "}
                      {(() => {
                        const areas = [];
                        if (quoteData.areasToClean.frontYard)
                          areas.push("Front");
                        if (quoteData.areasToClean.backYard) areas.push("Back");
                        if (quoteData.areasToClean.sideYard) areas.push("Side");
                        if (quoteData.areasToClean.dogRun)
                          areas.push("Dog Run");
                        if (quoteData.areasToClean.fencedArea)
                          areas.push("Fenced");
                        if (quoteData.areasToClean.other)
                          areas.push(quoteData.areasToClean.other);
                        return areas.length > 0
                          ? areas.join(", ")
                          : "Standard areas";
                      })()}
                    </div>
                  )}
                <div>• Professional waste removal</div>
              </div>
            </div>
          ) : (
            // Recurring service: show per-visit pricing
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Recurring service</span>
                <span className="text-sm font-medium">${pricing.perVisit}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1 ml-2">
                <div>
                  • {quoteData?.dogs || 2} Dog{quoteData?.dogs > 1 ? "s" : ""}
                </div>
                <div>
                  •{" "}
                  {quoteData?.yardSize
                    ? quoteData.yardSize === "xl"
                      ? "XL"
                      : quoteData.yardSize.charAt(0).toUpperCase() +
                        quoteData.yardSize.slice(1)
                    : "Medium"}{" "}
                  property
                </div>
                {quoteData?.areasToClean &&
                  Object.values(quoteData.areasToClean).some((v) => v) && (
                    <div>
                      • Service areas:{" "}
                      {(() => {
                        const areas = [];
                        if (quoteData.areasToClean.frontYard)
                          areas.push("Front");
                        if (quoteData.areasToClean.backYard) areas.push("Back");
                        if (quoteData.areasToClean.sideYard) areas.push("Side");
                        if (quoteData.areasToClean.dogRun)
                          areas.push("Dog Run");
                        if (quoteData.areasToClean.fencedArea)
                          areas.push("Fenced");
                        if (quoteData.areasToClean.other)
                          areas.push(quoteData.areasToClean.other);
                        return areas.length > 0
                          ? areas.join(", ")
                          : "Standard areas";
                      })()}
                    </div>
                  )}
                {(() => {
                  const selectedAreas = quoteData?.areasToClean
                    ? Object.values(quoteData.areasToClean).filter((v) => v)
                        .length
                    : 0;
                  const extraAreas = Math.max(0, selectedAreas - 1);
                  if (extraAreas > 0) {
                    const costPerArea = frequency === "onetime" ? 5 : 3;
                    return (
                      <div>
                        • +${extraAreas * costPerArea} for {extraAreas}{" "}
                        additional area
                        {extraAreas > 1 ? "s" : ""}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 my-3" />

          {/* Add-ons */}
          {(() => {
            const addOns = quoteData?.addOns;

            // Check if addOns object is empty or only contains default values
            const isEmptyAddOns =
              !addOns ||
              Object.keys(addOns).length === 0 ||
              (Object.keys(addOns).length === 1 &&
                addOns.divertMode === "none");

            if (isEmptyAddOns) {
              return (
                <>
                  <div>
                    <div className="text-sm font-medium mb-2">Add-ons</div>
                    <div className="text-xs text-gray-500 italic">
                      None selected
                    </div>
                  </div>
                  <div className="border-t border-gray-200 my-3" />
                </>
              );
            }

            // Check each add-on individually for meaningful selections
            const hasDeodorize =
              addOns.deodorize === true ||
              (addOns.deodorizeMode && addOns.deodorizeMode !== "none");
            const hasSprayDeck =
              addOns.sprayDeck === true ||
              (addOns.sprayDeckMode && addOns.sprayDeckMode !== "none");
            const hasDivertMode =
              addOns.divertMode && addOns.divertMode !== "none";

            // If no add-ons are meaningfully selected, show "None selected"
            if (!hasDeodorize && !hasSprayDeck && !hasDivertMode) {
              return (
                <>
                  <div>
                    <div className="text-sm font-medium mb-2">Add-ons</div>
                    <div className="text-xs text-gray-500 italic">
                      None selected
                    </div>
                  </div>
                  <div className="border-t border-gray-200 my-3" />
                </>
              );
            }

            // If add-ons are selected, show them
            return (
              <>
                <div>
                  <div className="text-sm font-medium mb-2">Add-ons</div>
                  {hasDeodorize && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>
                        Deodorize & Sanitize
                        {addOns.deodorizeMode === "first-visit" &&
                          " (First visit only)"}
                        {addOns.deodorizeMode === "each-visit" &&
                          " (Each visit)"}
                        {addOns.deodorizeMode === "every-other" &&
                          " (Every other visit)"}
                        {addOns.deodorizeMode === "one-time" &&
                          " (One-time service)"}
                      </span>
                      <span>
                        {
                          getAddonDisplay("deodorize", addOns.deodorizeMode)
                            .price
                        }
                      </span>
                    </div>
                  )}

                  {/* Spray Deck Add-on */}
                  {hasSprayDeck && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>
                        Spray Deck/Patio
                        {addOns.sprayDeckMode === "first-visit" &&
                          " (First visit only)"}
                        {addOns.sprayDeckMode === "each-visit" &&
                          " (Each visit)"}
                        {addOns.sprayDeckMode === "every-other" &&
                          " (Every other visit)"}
                        {addOns.sprayDeckMode === "onetime" &&
                          " (One-time service)"}
                      </span>
                      <span>
                        {
                          getAddonDisplay("spray-deck", addOns.sprayDeckMode)
                            .price
                        }
                      </span>
                    </div>
                  )}

                  {/* Divert from Landfill Add-on */}
                  {hasDivertMode && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>
                        🌱 Take away
                        {addOns.divertMode === "takeaway" && " (standard)"}
                        {addOns.divertMode === "25" && " - divert 25%"}
                        {addOns.divertMode === "50" && " - divert 50%"}
                        {addOns.divertMode === "100" && " - divert 100%"}
                      </span>
                      <span>
                        {
                          getAddonDisplay(
                            `divert-${addOns.divertMode}`,
                            "selected",
                          ).price
                        }
                      </span>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 my-3" />
              </>
            );
          })()}

          {/* One-time charges with discount */}
          {parseFloat(pricing.initialClean || "0") > 0 && (
            <>
              <div>
                <div className="text-sm font-medium mb-2">One-time charges</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span>
                      Initial clean ({pricing.initialCleanBucket || "2-6 weeks"}
                      )
                    </span>
                    <span>${pricing.initialClean}</span>
                  </div>
                  {discount && (
                    <div className="flex justify-between items-center text-xs text-green-600 bg-green-50 p-2 rounded">
                      <span>
                        🎉 Initial clean discount ({discount.discountPercent}%
                        off)
                      </span>
                      <span>-${discount.discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {/* First visit only add-ons */}
                  {quoteData.addOns?.deodorizeMode === "first-visit" && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Deodorize & Sanitize (first visit only)</span>
                      <span>
                        {getAddonDisplay("deodorize", "first-visit").price}
                      </span>
                    </div>
                  )}
                  {quoteData.addOns?.sprayDeckMode === "first-visit" && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Spray Deck/Patio (first visit only)</span>
                      <span>
                        {getAddonDisplay("spray-deck", "first-visit").price}
                      </span>
                    </div>
                  )}
                  {quoteData.addOns?.divertMode &&
                    quoteData.addOns.divertMode !== "none" &&
                    frequency === "onetime" && (
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <span>
                          Take away
                          {quoteData.addOns.divertMode === "25" &&
                            " - divert 25%"}
                          {quoteData.addOns.divertMode === "50" &&
                            " - divert 50%"}
                          {quoteData.addOns.divertMode === "100" &&
                            " - divert 100%"}
                        </span>
                        <span>
                          {
                            getAddonDisplay(
                              `divert-${quoteData.addOns.divertMode}`,
                              "selected",
                            ).price
                          }
                        </span>
                      </div>
                    )}
                </div>
              </div>
              <div className="border-t border-gray-200 my-3" />
            </>
          )}

          {/* Total */}
          <div className="flex justify-between items-center pt-2">
            <span className="font-medium">Total for first visit</span>
            <span className="font-semibold text-lg">
              {discount
                ? `$${discount.finalAmount.toFixed(2)}`
                : `$${pricing.oneTime}`}
            </span>
          </div>

          {/* Monthly billing note */}
          {frequency !== "onetime" &&
            pricing.monthly !== pricing.oneTime &&
            pricing.monthly !== "0.00" && (
              <div className="text-xs text-gray-500 text-center pt-2">
                Billed monthly: ${pricing.monthly}
              </div>
            )}
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

// Enhanced step configuration with conditional flow - inspired by DoodyCalls
const getSteps = (frequency?: string, isCommercial?: boolean) => [
  {
    id: "zip-check",
    title: "Service Area",
    description: "Verify your location for service",
    icon: MapPin,
    color: "from-blue-500 to-purple-600",
  },
  {
    id: "service-type",
    title: "Service Type",
    description: "Residential or community service",
    icon: Building,
    color: "from-purple-500 to-pink-600",
  },
  {
    id: "basics",
    title: "Property Details",
    description: "Tell us about your dogs and yard",
    icon: Home,
    color: "from-green-500 to-emerald-600",
  },
  // Skip service frequency step for commercial properties
  ...(isCommercial
    ? []
    : [
        {
          id: "frequency",
          title: "Service Frequency",
          description: "How often do you need service?",
          icon: Clock,
          color: "from-orange-500 to-red-600",
        },
      ]),
  ...(isCommercial
    ? []
    : [
        {
          id: "customization",
          title: "Customize Service",
          description: "Add extras and preferences",
          icon: Settings,
          color: "from-yellow-500 to-orange-600",
        },
      ]),
  // Wellness insights step (only for residential, not commercial)
  ...(isCommercial
    ? []
    : [
        {
          id: "wellness",
          title: "Wellness & Health",
          description: "Basic insights included free - add premium options",
          icon: Star,
          color: "from-teal-500 to-cyan-600",
        },
      ]),
  ...(isCommercial
    ? [
        {
          id: "commercial-contact",
          title: "Commercial Contact",
          description: "Provide your details for custom quote",
          icon: Building,
          color: "from-indigo-500 to-blue-600",
        },
      ]
    : []),
  {
    id: "contact-review",
    title: isCommercial ? "Review & Submit" : "Contact & Confirm",
    description: isCommercial
      ? "Review your request and submit"
      : "Your info and final quote review",
    icon: CheckCircle,
    color: "from-emerald-500 to-teal-600",
  },
];

// Trust signals data for top bar
const TRUST_SIGNALS = [
  {
    icon: Shield,
    text: "Licensed & Insured",
    description: "Fully licensed and insured for your peace of mind",
  },
  {
    icon: Award,
    text: "Quality Service",
    description: "Professional waste collection and disposal",
  },
  {
    icon: Truck,
    text: "Reliable Service",
    description: "98% on-time service rate with flexible scheduling",
  },
  {
    icon: Heart,
    text: "Eco-Friendly",
    description: "Carbon-neutral service with sustainable practices",
  },
];

function QuoteWizardComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Determine which organization this quote is for
  // Priority: URL param > session user's org > default to 'yardura'
  const getBusinessOrgId = () => {
    // Check for org/tenant parameter in URL (supports businessId, tenantId aliases)
    const urlOrgId =
      searchParams.get("org") ||
      searchParams.get("businessId") ||
      searchParams.get("tenant") ||
      searchParams.get("tenantId");
    if (urlOrgId) return urlOrgId;

    // Use session user's org if logged in as admin/staff
    const sessionOrgId = (session?.user as any)?.orgId;
    const userRole = (session as any)?.userRole;
    if (
      sessionOrgId &&
      ["ADMIN", "OWNER", "TECH", "SALES_REP"].includes(userRole)
    ) {
      return sessionOrgId;
    }

    // Default to main yardura org for public quotes
    return "yardura";
  };

  const userOrgId = getBusinessOrgId();

  console.log(
    "Quote flow using orgId:",
    userOrgId,
    "for user:",
    session?.user?.email || "anonymous",
  );

  // Simplified state management
  const [currentStep, setCurrentStep] = useState(0);
  const [quoteData, setQuoteData] = useState<Partial<QuoteInput>>({
    serviceType: "residential", // Default to residential
    dogs: 1,
    yardSize: "medium",
    frequency: "weekly",
    addOns: {},
    initialClean: false,
    premiumOnboarding: "none",
    consent: { stoolPhotosOptIn: false, terms: false },
  });
  const [_errors, setErrors] = useState<Record<string, string[]>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showTrustSignals, setShowTrustSignals] = useState(true);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [formProtectionErrors, setFormProtectionErrors] = useState<string[]>(
    [],
  );
  const [zoneMultiplier, setZoneMultiplier] = useState<number>(1.0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);

  // New validation system
  const zipValidation = useZipValidation();
  const fieldRefs = useMemo(
    () => ({}) as Record<string, React.RefObject<HTMLElement>>,
    [],
  );
  const liveRegionRef = useMemo(
    () => ({ current: null }) as React.RefObject<HTMLDivElement>,
    [],
  );

  // Update zone multiplier when ZIP code changes
  useEffect(() => {
    const updateZoneMultiplier = async () => {
      if (quoteData.zipCode) {
        try {
          const multiplier = await getZoneMultiplierFromZip(
            quoteData.zipCode,
            userOrgId,
          );
          setZoneMultiplier(multiplier);
        } catch (error) {
          console.error("Error getting zone multiplier:", error);
          setZoneMultiplier(1.0); // Default to 1.0 on error
        }
      } else {
        setZoneMultiplier(1.0); // Default to 1.0 when no ZIP
      }
    };

    updateZoneMultiplier();
  }, [quoteData.zipCode, userOrgId]);

  // Pricing state for async calculations
  const [pricing, setPricing] = useState<any>(null);

  // Show mobile sticky pricing only after property details are selected
  const hasPropertyDetails = useMemo(() => {
    const hasDogs = !!quoteData.dogs;
    const hasYard = !!quoteData.yardSize;
    const hasLastCleanup =
      !!quoteData.deepCleanAssessment?.daysSinceLastCleanup;
    const hasAreas =
      !!quoteData.areasToClean &&
      Object.values(quoteData.areasToClean).some((v) => !!v);
    return hasDogs && hasYard && hasLastCleanup && hasAreas;
  }, [
    quoteData.dogs,
    quoteData.yardSize,
    quoteData.deepCleanAssessment?.daysSinceLastCleanup,
    quoteData.areasToClean,
  ]);

  // Get dynamic steps based on frequency and commercial status
  const STEPS = useMemo(
    () => getSteps(quoteData.frequency, quoteData.serviceType === "commercial"),
    [quoteData.frequency, quoteData.serviceType],
  );

  const isFinalStep = currentStep === STEPS.length - 1;

  // Calculate price asynchronously via API
  useEffect(() => {
    const calculatePricingAsync = async () => {
      // For basics/customization step, we can estimate price with just dogs and yardSize
      if (quoteData.dogs && quoteData.yardSize) {
        try {
          // Use selected frequency or default to weekly for estimation
          const frequencyToUse = quoteData.frequency || "weekly";

          // Call the pricing API endpoint
          console.log("Making pricing API call with data:", {
            dogs: quoteData.dogs,
            yardSize: quoteData.yardSize,
            frequency: frequencyToUse,
            addons: transformAddOnsForPricing(quoteData.addOns || {}),
            businessId: userOrgId,
          });

          const response = await fetch("/api/quote/calculate-price", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dogs: quoteData.dogs,
              yardSize: quoteData.yardSize,
              frequency: frequencyToUse,
              addons: transformAddOnsForPricing(quoteData.addOns || {}),
              initialClean: quoteData.initialClean,
              premiumOnboarding: quoteData.premiumOnboarding,
              deepCleanAssessment: quoteData.deepCleanAssessment,
              propertyType: quoteData.propertyType,
              address: quoteData.address || "", // Provide empty string if not set
              lastCleanedBucket:
                quoteData.deepCleanAssessment?.daysSinceLastCleanup?.toString(),
              lastCleanedDate: quoteData.lastCleanedDate,
              zoneMultiplier, // Add zone multiplier for pricing
              areasToClean: quoteData.areasToClean,
              businessId: userOrgId, // Add business ID for multi-tenancy
            }),
          });

          if (response.ok) {
            const result = await response.json();
            setPricing(result);
          } else {
            console.error("Price calculation API error:", response.statusText);
            setPricing(null);
          }
        } catch (error) {
          console.error("Price calculation error:", error);
          setPricing(null);
        }
      } else {
        setPricing(null);
      }
    };

    calculatePricingAsync();
  }, [
    quoteData.dogs,
    quoteData.yardSize,
    quoteData.frequency,
    quoteData.zipCode, // Add zipCode to dependencies
    quoteData.addOns,
    quoteData.initialClean,
    quoteData.premiumOnboarding,
    quoteData.deepCleanAssessment,
    quoteData.propertyType,
    quoteData.address,
    quoteData.areasToClean,
    zoneMultiplier, // Add zoneMultiplier to dependencies
    userOrgId, // Add userOrgId for business-specific pricing
  ]);

  // Extract pricing display values
  const _estimatedPrice = useMemo(() => {
    if (!pricing) return null;

    // Handle commercial properties - show contact message instead of pricing
    if (pricing.requiresCustomQuote) {
      return {
        perVisit: "Contact Us",
        monthly: "Custom Quote",
        oneTime: "Contact Us",
        requiresCustomQuote: true,
        commercialMessage: pricing.commercialMessage,
        showContactStep: true,
      };
    }

    return {
      perVisit: (pricing.perVisit / 100).toFixed(2),
      monthly: (pricing.monthly / 100).toFixed(2),
      oneTime: (pricing.oneTime / 100).toFixed(2),
      initialClean: pricing.initialClean
        ? (pricing.initialClean / 100).toFixed(2)
        : "0.00",
      initialCleanBucket: pricing.initialCleanBucket,
      visitsPerMonth: pricing.visitsPerMonth,
      breakdown: pricing.breakdown,
      showContactStep: false,
    };
  }, [pricing]);

  // Auto-hide trust signals after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowTrustSignals(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Enhanced analytics tracking for step progression
  useEffect(() => {
    track("quote_step_view", {
      step: currentStep + 1,
      step_name: STEPS[currentStep]?.id || "unknown",
      has_estimate: !!_estimatedPrice,
      dogs: quoteData.dogs || null,
      frequency: quoteData.frequency || null,
      property_type: quoteData.propertyType || null,
    });
  }, [
    currentStep,
    _estimatedPrice,
    quoteData.dogs,
    quoteData.frequency,
    quoteData.propertyType,
  ]);

  // Load saved quote from localStorage
  useEffect(() => {
    const resume = searchParams.get("resume");
    if (resume === "1") {
      const savedQuote = localStorage.getItem("yardura_pending_quote_v2");
      if (savedQuote) {
        try {
          const parsedQuote = JSON.parse(savedQuote);
          if (parsedQuote && typeof parsedQuote === "object") {
            setQuoteData(parsedQuote);
            // Smart step progression based on data completeness
            if (
              parsedQuote.dogs &&
              parsedQuote.yardSize &&
              parsedQuote.frequency
            ) {
              if (parsedQuote.contact?.name && parsedQuote.contact?.email) {
                setCurrentStep(4); // Go to review step
              } else {
                setCurrentStep(3); // Go to contact step
              }
            } else if (
              parsedQuote.dogs ||
              parsedQuote.yardSize ||
              parsedQuote.frequency
            ) {
              setCurrentStep(1); // Go to basics step
            }
          }
        } catch (error) {
          console.error("Error loading saved quote:", error);
          localStorage.removeItem("yardura_pending_quote_v2");
        }
      }
    }
  }, [searchParams]);

  // Auto-save quote data
  useEffect(() => {
    if (
      quoteData.dogs ||
      quoteData.yardSize ||
      quoteData.frequency ||
      quoteData.contact?.name
    ) {
      try {
        localStorage.setItem(
          "yardura_pending_quote_v2",
          JSON.stringify(quoteData),
        );
      } catch (error) {
        console.error("Error saving quote to localStorage:", error);
      }
    }
  }, [quoteData]);

  // (removed duplicate STEPS declaration)

  // Initialize completedSteps when STEPS is available
  useEffect(() => {
    setCompletedSteps((prev) =>
      prev.length === 0 ? new Array(STEPS.length).fill(false) : prev,
    );
  }, [STEPS.length]);

  // Analytics tracking
  useEffect(() => {
    track("quote_step_view", {
      step: currentStep + 1,
      step_name: STEPS[currentStep]?.id || "unknown",
      has_estimate: !!_estimatedPrice,
      dogs: quoteData.dogs || null,
      frequency: quoteData.frequency || null,
    });
  }, [
    currentStep,
    _estimatedPrice,
    quoteData.dogs,
    quoteData.frequency,
    STEPS,
  ]);

  // Simplified data update function
  const updateQuoteData = (field: keyof QuoteInput, value: any) => {
    setQuoteData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear _errors for this field
    if (_errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Real-time field validation handler
  const validateFieldOnBlur = (fieldName: string, value: any) => {
    const steps = getSteps(
      quoteData.frequency,
      quoteData.serviceType === "commercial",
    );
    const currentStepData = steps[currentStep];

    if (!currentStepData) return;

    const validationResult = validateField(
      currentStepData.id,
      fieldName,
      value,
      quoteData,
    );

    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      if (validationResult.valid) {
        delete newErrors[fieldName];
      } else {
        newErrors[fieldName] = validationResult.error || "Invalid value";
      }
      return newErrors;
    });

    // Track field validation events
    track("field_blur_validation", {
      step: currentStep + 1,
      step_name: currentStepData.id,
      field: fieldName,
      valid: validationResult.valid,
      error: validationResult.error || null,
    });
  };

  // Simplified validation function
  const validateCurrentStep = () => {
    const newErrors: Record<string, string[]> = {};
    const currentStepData = STEPS[currentStep];

    switch (currentStepData?.id) {
      case "basics":
        // Default to residential if not set (shouldn't happen but safety check)
        const serviceType = quoteData.serviceType || "residential";

        // Dog validation - different limits for residential vs commercial
        if (serviceType === "residential") {
          if (!quoteData.dogs || quoteData.dogs < 1 || quoteData.dogs > 4) {
            newErrors.dogs = ["Please select between 1-4 dogs"];
          }
        } else if (serviceType === "commercial") {
          if (!quoteData.dogs || quoteData.dogs < 1) {
            newErrors.dogs = ["Please enter the expected number of dogs"];
          }
          if (!quoteData.businessType) {
            newErrors.businessType = ["Please select your business type"];
          }
        }

        if (!quoteData.yardSize) {
          newErrors.yardSize = [
            "Please select your service area size for accurate pricing",
          ];
        }

        // Require last cleanup selection
        if (!quoteData.deepCleanAssessment?.daysSinceLastCleanup) {
          newErrors.deepCleanAssessment = [
            "Please select when the last cleanup occurred",
          ];
        }

        // Require at least one area to be selected
        if (
          !quoteData.areasToClean ||
          !Object.values(quoteData.areasToClean).some((v) => v)
        ) {
          newErrors.areasToClean = [
            "Please select at least one area that needs service",
          ];
        }
        break;

      case "service-type":
        if (!quoteData.frequency) {
          newErrors.frequency = [
            "Please choose your preferred service frequency",
          ];
        }
        // Address validation moved to basics step
        break;

      case "onboarding":
        // Onboarding step is optional - no validation required
        break;

      case "commercial-contact":
        if (!quoteData.contact?.name?.trim()) {
          newErrors.contact = ["Please enter your full name"];
        }
        if (!quoteData.contact?.email?.trim()) {
          newErrors.contact = [
            ...(newErrors.contact || []),
            "Please enter your email address",
          ];
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(quoteData.contact.email)) {
            newErrors.contact = [
              ...(newErrors.contact || []),
              "Please enter a valid email address",
            ];
          }
        }
        if (!quoteData.contact?.phone?.trim()) {
          newErrors.contact = [
            ...(newErrors.contact || []),
            "Please enter your phone number",
          ];
        }
        break;

      case "contact-review":
        // Address validation
        if (!quoteData.address?.trim()) {
          newErrors.address = ["Please enter your complete service address"];
        } else {
          // Use addressValidated if available (from Google Places autocomplete)
          if (quoteData.addressValidated) {
            // Address was validated by Google Places - trust it
            console.log(
              "Address validation: Using validated address from Google Places",
            );
          } else {
            // Fallback to manual validation for addresses entered without autocomplete
            const address = quoteData.address.trim();
            const hasNumber = /\d+/.test(address);
            const inState = /\bmn\b|minnesota/.test(address.toLowerCase());
            const serviceCities = [
              "minneapolis",
              "bloomington",
              "edina",
              "richfield",
              "eagan",
              "apple valley",
              "lakeville",
              "burnsville",
              "st cloud",
              "st. cloud",
              "sartell",
              "sauk rapids",
              "waite park",
              "st joseph",
              "cold spring",
              "rockville",
            ];
            const inCities = serviceCities.some((c) =>
              address.toLowerCase().includes(c),
            );

            if (!hasNumber || address.length < 8) {
              newErrors.address = [
                "Please enter a valid street address with a number",
              ];
            } else if (!inState) {
              newErrors.address = ["We currently only serve Minnesota"];
            } else if (!inCities) {
              newErrors.address = [
                "Please enter a valid address in our service area",
              ];
            }
          }
        }

        break;

      default:
        // Handle any remaining step-specific validations
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Simplified navigation
  const handleNext = () => {
    const currentStepData = STEPS[currentStep];
    const validationResult = validateStep(currentStepData.id, quoteData);

    if (validationResult.valid) {
      // Mark current step as completed
      setCompletedSteps((prev) => {
        const next = [...prev];
        next[currentStep] = true;
        return next;
      });

      // Track successful validation
      track("quote_step_valid", { step: currentStep + 1 });

      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);

        // Focus on the step heading for accessibility
        setTimeout(() => {
          const stepHeading = document.querySelector(
            `[data-step="${currentStep + 1}"] h2`,
          );
          if (stepHeading) {
            (stepHeading as HTMLElement).focus();
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 100);
      }
    } else {
      // Set field errors and announce to screen readers
      setErrors(validationResult.issues);
      announceValidationErrors(liveRegionRef, "Please fix the fields below");

      // Track validation error
      track("quote_step_error", {
        step: currentStep + 1,
        firstErrorField: validationResult.firstInvalidKey || null,
      });

      // Scroll to and focus first error
      setTimeout(() => {
        scrollToFirstError(fieldRefs, validationResult.firstInvalidKey);
      }, 100);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Direct step navigation
  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < STEPS.length) {
      // Allow navigation to any step, validation will happen when proceeding
      setCurrentStep(stepIndex);
    }
  };

  // Enhanced submission with form protection
  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    // Check form protection (temporarily disabled)
    /*
    if (!recaptchaToken && env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      setFormProtectionErrors(['Please complete the security verification']);
      return;
    }
    */

    setIsSubmitting(true);
    setFormProtectionErrors([]);

    try {
      // Enhanced analytics tracking
      track("quote_complete", {
        dogs: quoteData.dogs || null,
        yard_size: quoteData.yardSize || null,
        frequency: quoteData.frequency || null,
        property_type: quoteData.propertyType || null,
        estimated_price:
          quoteData.propertyType === "commercial"
            ? 0
            : quoteData.frequency === "onetime"
              ? parseFloat(_estimatedPrice?.oneTime || "0")
              : parseFloat(_estimatedPrice?.monthly || "0"),
        addons: JSON.stringify(quoteData.addOns) || null,
        has_health_insights: quoteData.consent?.stoolPhotosOptIn || false,
        has_recaptcha: !!recaptchaToken,
        is_commercial: quoteData.propertyType === "commercial",
      });

      // Prepare submission data with form protection
      const submissionData = {
        ...quoteData,
        businessId: userOrgId,
        pricingSnapshot: pricing,
        recaptchaToken,
        submittedAt: new Date().toISOString(),
        // Honeypot field (should be empty)
        honeypot: "",
      };

      const response = await fetch("/api/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setFormProtectionErrors([
            "Too many requests. Please wait a moment and try again.",
          ]);
        } else if (result.errors) {
          setFormProtectionErrors(result.errors);
        } else {
          setFormProtectionErrors([
            "Failed to submit quote. Please try again.",
          ]);
        }
        return;
      }

      // Success - clean up and redirect
      localStorage.removeItem("yardura_pending_quote_v2");

      // Track successful conversion
      track("quote_conversion", {
        lead_id: result.leadId,
        protection_score: result.protectionScore || 0,
        dogs: quoteData.dogs || null,
        estimated_value:
          quoteData.propertyType === "commercial" ? 0 : pricing?.total || 0,
        is_commercial: quoteData.propertyType === "commercial",
      });

      // Handle commercial vs residential success flow
      const successParams = new URLSearchParams({
        leadId: result.leadId,
        businessId: userOrgId,
      });
      if (
        quoteData.propertyType === "commercial" ||
        quoteData.serviceType === "commercial"
      ) {
        successParams.set("commercial", "true");
      }

      const successUrl = `/quote/success?${successParams.toString()}`;

      router.push(successUrl);
    } catch (error) {
      console.error("Quote submission failed:", error);
      setFormProtectionErrors([
        "Network error. Please check your connection and try again.",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enhanced step rendering with better component structure
  const renderStep = () => {
    const step = STEPS[currentStep];

    let stepContent: React.ReactNode = null;

    switch (step.id) {
      case "zip-check":
        stepContent = (
          <StepZipCheck
            quoteData={quoteData as any}
            updateQuoteData={updateQuoteData}
            _errors={_errors}
            onNext={handleNext}
            userOrgId={userOrgId}
          />
        );
        break;
      case "service-type":
        stepContent = (
          <StepServiceType
            quoteData={quoteData as any}
            updateQuoteData={updateQuoteData}
            onNext={handleNext}
          />
        );
        break;
      case "basics":
        stepContent = (
          <StepBasics
            quoteData={quoteData as any}
            updateQuoteData={updateQuoteData}
            _errors={_errors}
            _estimatedPrice={_estimatedPrice || undefined}
          />
        );
        break;
      case "frequency":
        stepContent = (
          <StepFrequency
            quoteData={quoteData as any}
            updateQuoteData={updateQuoteData}
            _errors={_errors}
            _estimatedPrice={_estimatedPrice || undefined}
          />
        );
        break;
      case "customization":
        stepContent = (
          <ExternalStepCustomization
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              setQuoteData((prev) => ({ ...prev, ...updates }));
            }}
            errors={{}}
            onNext={handleNext}
          />
        );
        break;
      case "wellness":
        stepContent = (
          <StepWellness
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              Object.entries(updates).forEach(([field, value]) => {
                updateQuoteData(field as any, value);
              });
            }}
            _errors={_errors}
            onNext={handleNext}
          />
        );
        break;
      case "onboarding":
        stepContent = (
          <StepOnboarding
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              Object.entries(updates).forEach(([field, value]) => {
                updateQuoteData(field as any, value);
              });
            }}
            _errors={_errors}
            _estimatedPrice={_estimatedPrice || undefined}
          />
        );
        break;
      case "commercial-contact":
        stepContent = (
          <StepCommercialContact
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              Object.entries(updates).forEach(([field, value]) => {
                updateQuoteData(field as any, value);
              });
            }}
            _errors={_errors}
            _estimatedPrice={_estimatedPrice || undefined}
          />
        );
        break;
      case "contact-review":
        stepContent = (
          <ExternalStepContactReview
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              setQuoteData((prev) => ({ ...prev, ...updates }));
            }}
            errors={_errors as any}
            estimatedPrice={_estimatedPrice as any}
            onNext={() => handleNext()}
          />
        );
        break;
      default:
        stepContent = null;
    }

    return <div data-step={currentStep}>{stepContent}</div>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/20 pt-20 pb-24">
      {/* Enhanced Trust Signals Bar */}
      <AnimatePresence>
        {showTrustSignals && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="hidden md:block bg-white/95 backdrop-blur-xl border-b border-green-200/60 shadow-lg overflow-hidden"
          >
            <div className="container py-6 relative">
              <div className="flex items-center justify-center gap-12 text-sm">
                {TRUST_SIGNALS.map((signal, index) => (
                  <motion.div
                    key={signal.text}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="flex items-center gap-3 group cursor-pointer"
                  >
                    <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl group-hover:from-green-200 group-hover:to-green-300 transition-all duration-200 shadow-sm">
                      <signal.icon className="size-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-green-700 transition-colors">
                        {signal.text}
                      </div>
                      <div className="text-xs text-slate-500 max-w-32 leading-tight">
                        {signal.description}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center py-4 px-4">
        {/* Enhanced Header with Modern Design */}
        <motion.div
          className="w-full max-w-screen-xl mb-4 mt-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div>
                <motion.h1
                  className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-900 to-green-700 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  {currentStep === 0 ? "Let's Get Started!" : "Get Your Quote"}
                </motion.h1>
                <motion.p
                  className="text-muted mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  Step {currentStep + 1} of {STEPS.length}:{" "}
                  {STEPS[currentStep].title}
                </motion.p>
              </div>
            </div>

            {/* Quick Stats for Steps 2+ */}
            {currentStep >= 2 &&
              _estimatedPrice &&
              !_estimatedPrice.requiresCustomQuote && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="hidden sm:flex items-center gap-4 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl border border-green-700/20"
                >
                  <div className="text-center">
                    <div className="text-sm font-bold text-green-700">
                      ${_estimatedPrice.oneTime}
                    </div>
                    <div className="text-xs text-slate-500">One-time</div>
                  </div>
                  <div className="w-px h-6 bg-green-700/20"></div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-green-700">
                      ${_estimatedPrice.monthly}
                    </div>
                    <div className="text-xs text-slate-500">Monthly</div>
                  </div>
                </motion.div>
              )}
          </div>
        </motion.div>

        {/* Enhanced Progress Bar with Better UX (hidden on mobile) */}
        <div className="relative mb-0.5 hidden md:block">
          {/* Step Counter */}
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-muted">
              Step {currentStep + 1} of {STEPS.length}
            </div>
            <div className="text-xs font-medium text-green-700">
              {Math.round(((currentStep + 1) / STEPS.length) * 100)}% Complete
            </div>
          </div>

          <div className="flex items-center justify-between mb-1 overflow-x-auto pb-1">
            <div className="flex items-center gap-2 sm:gap-3 min-w-max px-1">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                const isUpcoming = index > currentStep;
                const isClickable = completedSteps[index - 1] || index === 0; // Step 0 is always clickable, others require previous step completion

                return (
                  <motion.button
                    key={step.id}
                    onClick={() => isClickable && goToStep(index)}
                    className={`relative flex flex-col items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 rounded-lg transition-all duration-300 flex-shrink-0 ${
                      isCompleted
                        ? "bg-gradient-to-r from-green-700 to-green-600 text-white shadow-sm"
                        : isCurrent
                          ? "bg-gradient-to-br from-green-50 to-green-100 text-green-700 shadow-sm border border-green-700/30"
                          : isClickable
                            ? "bg-white border border-gray-200 text-gray-700 hover:bg-green-700/5 hover:text-green-700 hover:border-green-700/30"
                            : "bg-white/50 border border-gray-200 text-gray-400"
                    }`}
                    whileHover={isClickable ? { scale: 1.02 } : {}}
                    whileTap={isClickable ? { scale: 0.98 } : {}}
                    disabled={!isClickable}
                  >
                    {/* Step Number Badge */}
                    <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-r from-green-700 to-green-600 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-white z-20">
                      {index + 1}
                    </div>

                    <div
                      className={`p-1 rounded-md transition-colors ${
                        isCompleted || isCurrent ? "bg-white/20" : "bg-muted"
                      }`}
                    >
                      <StepIcon className="size-2.5 sm:size-3" />
                    </div>

                    <div className="text-center">
                      <div className="text-[10px] font-medium whitespace-nowrap truncate max-w-[4rem] sm:max-w-[8rem]">
                        {step.title}
                      </div>
                      <div className="text-[9px] opacity-60 hidden sm:block whitespace-nowrap truncate max-w-[4rem] sm:max-w-[7rem]">
                        {step.description}
                      </div>
                    </div>

                    {/* Completion Checkmark */}
                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm border border-white z-30"
                      >
                        <Check className="w-2.5 h-2.5 text-white" />
                      </motion.div>
                    )}

                    {/* Current Step Pulse */}
                    {isCurrent && (
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-green-700/5"
                        animate={{
                          boxShadow: [
                            "0 0 0 0px rgba(59, 130, 246, 0.2)",
                            "0 0 0 4px rgba(59, 130, 246, 0.1)",
                            "0 0 0 0px rgba(59, 130, 246, 0.2)",
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Enhanced Progress Bar with Gradient */}
          <div className="relative w-full bg-muted rounded-full h-3 overflow-hidden shadow-inner">
            <motion.div
              className="bg-gradient-to-r from-green-700 via-green-600 to-green-700 h-3 rounded-full shadow-sm"
              initial={{ width: 0 }}
              animate={{
                width: `${((currentStep + 1) / STEPS.length) * 100}%`,
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            {/* Progress Text Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-white drop-shadow-sm">
                {currentStep + 1}/{STEPS.length}
              </span>
            </div>
          </div>

          {/* Step Names Below Progress Bar */}
          <div className="flex justify-between mt-1 text-xs text-muted">
            <span className="truncate max-w-[80px]">{STEPS[0]?.title}</span>
            <span className="truncate max-w-[80px] text-center">
              {STEPS[Math.floor(STEPS.length / 2)]?.title}
            </span>
            <span className="truncate max-w-[80px] text-right">
              {STEPS[STEPS.length - 1]?.title}
            </span>
          </div>
        </div>
      </div>

      {/* Step Content with Responsive Two-Column Layout */}
      <div className="w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Main Form Content - Conditional Layout */}
          <div
            className={
              currentStep >= 2
                ? "lg:col-span-7"
                : "lg:col-span-12 flex justify-center"
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{
                  opacity: 0,
                  y: 30,
                  scale: 0.98,
                  filter: "blur(4px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  y: -30,
                  scale: 1.02,
                  filter: "blur(2px)",
                }}
                transition={{
                  duration: 0.4,
                  ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth animation
                  filter: { duration: 0.2 },
                }}
              >
                {currentStep >= 2 ? (
                  renderStep()
                ) : (
                  <div className="max-w-4xl w-full">{renderStep()}</div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Enhanced Pricing Display - Right Sidebar */}
          {currentStep >= 2 && (
            <div className="lg:col-span-5 hidden md:block">
              {_estimatedPrice && (
                <ExternalPricingSummary
                  pricing={_estimatedPrice as any}
                  quoteData={quoteData as any}
                  frequency={quoteData.frequency as any}
                />
              )}
            </div>
          )}
          {/* Mobile: show full pricing summary only on final confirm step */}
          {isFinalStep && (
            <div className="md:hidden">
              {_estimatedPrice && (
                <ExternalPricingSummary
                  pricing={_estimatedPrice as any}
                  quoteData={quoteData as any}
                  frequency={quoteData.frequency as any}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop/tablet sticky footer */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200">
        <div className="max-w-screen-xl mx-auto px-4 py-3">
          <QuoteStepFooter
            currentStep={currentStep}
            totalSteps={STEPS.length}
            onBack={handleBack}
            onContinue={
              currentStep === STEPS.length - 1 ? handleSubmit : handleNext
            }
            continueDisabled={isSubmitting}
            continueLoading={isSubmitting}
            showBack={currentStep > 0}
            isFinalStep={currentStep === STEPS.length - 1}
          />
        </div>
      </div>

      {/* Mobile sticky action bar: pricing + nav buttons */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
          {_estimatedPrice && hasPropertyDetails ? (
            <div className="flex items-center gap-4">
              {quoteData.frequency !== "onetime" && (
                <div className="text-sm">
                  <div className="text-slate-500">Per visit</div>
                  <div className="font-semibold">
                    ${_estimatedPrice.perVisit}
                  </div>
                </div>
              )}
              {quoteData.frequency !== "onetime" ? (
                <div className="text-sm text-right">
                  <div className="text-slate-500">Monthly</div>
                  <div className="font-semibold">
                    ${_estimatedPrice.monthly}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-right">
                  <div className="text-slate-500">One-time</div>
                  <div className="font-semibold">
                    ${_estimatedPrice.oneTime}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={
                currentStep === STEPS.length - 1 ? handleSubmit : handleNext
              }
              disabled={isSubmitting}
            >
              {currentStep === STEPS.length - 1 ? "Confirm" : "Continue"}
            </Button>
          </div>
        </div>
      </div>

      {/* Accessibility Live Region */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Auto-save indicator */}
      {(quoteData.dogs || quoteData.contact?.name) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-xs text-muted text-center"
        >
          <Zap className="size-3 inline mr-1" />
          Progress automatically saved
        </motion.div>
      )}
    </div>
  );
}

// Enhanced Step Components

function StepBasics({
  quoteData,
  updateQuoteData,
  _errors,
  _estimatedPrice,
}: any) {
  const isCommercial = quoteData.serviceType === "commercial";

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-green-700" />
            Property Details
          </CardTitle>
          <p className="text-muted">
            {isCommercial
              ? "Tell us about your commercial property and service needs"
              : "Tell us about your home and pets"}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Service Type Display (DoodyCalls style) */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-700 to-green-600 rounded-full flex items-center justify-center">
                {isCommercial ? (
                  <Building className="w-5 h-5 text-white" />
                ) : (
                  <Home className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <p className="font-semibold text-green-800">
                  {isCommercial ? "Commercial Service" : "Residential Service"}
                </p>
                <p className="text-sm text-green-600">
                  {isCommercial
                    ? "Pet waste stations and common-area cleanup for businesses"
                    : "Professional pet waste removal for your home"}
                </p>
              </div>
            </div>
          </div>

          {/* Conditional Fields Based on Service Type */}
          <>
            {/* Commercial Property Info */}
            {isCommercial && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Commercial Property Service
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Perfect for dog parks, veterinary clinics, hotels,
                      grooming salons, boarding facilities, and other
                      businesses. We'll provide a custom quote based on your
                      specific needs.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Dog Count - Different for Residential vs Commercial */}
            <div>
              <Label htmlFor="dogs" className="text-base font-medium">
                {isCommercial
                  ? "Expected Number of Dogs *"
                  : "Number of Dogs *"}
              </Label>
              <p className="text-sm text-muted mt-1">
                {isCommercial
                  ? "How many dogs do you typically serve or expect to have on your property?"
                  : "How many dogs live in your home?"}
              </p>

              {isCommercial ? (
                // Free-form input for commercial
                <Input
                  id="dogs"
                  type="number"
                  min="1"
                  max="500"
                  value={quoteData.dogs || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateQuoteData("dogs", parseInt(e.target.value) || 0)
                  }
                  placeholder="Enter number of dogs (e.g., 50)"
                  className="mt-2 bg-white border-2 border-gray-200 hover:border-green-700/30 focus:ring-2 focus:ring-green-700 focus:ring-offset-2 focus:outline-none"
                />
              ) : (
                // Slider for residential (1-4+)
                <div className="mt-4">
                  <Slider
                    min={1}
                    max={4}
                    step={1}
                    value={Math.min(quoteData.dogs || 1, 4)}
                    onValueChange={(value) => updateQuoteData("dogs", value)}
                    valueFormatter={(value) =>
                      value === 4
                        ? "4+ dogs"
                        : `${value} dog${value > 1 ? "s" : ""}`
                    }
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-muted mt-2">
                    <span>1 dog</span>
                    <span>4+ dogs</span>
                  </div>
                </div>
              )}

              {_errors.dogs && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-red-600 mt-1"
                  data-error="true"
                >
                  {_errors.dogs[0]}
                </motion.p>
              )}
            </div>

            {/* Property Type - Clickable Cards */}
            <div>
              <Label className="text-base font-medium">
                {isCommercial
                  ? "Service Area Size *"
                  : "What's your place like? *"}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {(isCommercial
                  ? [
                      {
                        value: "small",
                        label: "Small Property",
                        desc: "Townhouse, condo, or small attached home",
                        icon: "🏠",
                      },
                      {
                        value: "medium",
                        label: "Medium Property",
                        desc: "Standard single-family home (under ½ acre)",
                        icon: "🏡",
                      },
                      {
                        value: "large",
                        label: "Large Property",
                        desc: "Spacious home or property (½ to 2 acres)",
                        icon: "🏘️",
                      },
                      {
                        value: "xl",
                        label: "Extra Large",
                        desc: "Estate or very large property (2+ acres)",
                        icon: "🏰",
                      },
                    ]
                  : [
                      {
                        value: "small",
                        label: "Small Property",
                        desc: "Townhouse, condo, or small attached home",
                        icon: "🏠",
                      },
                      {
                        value: "medium",
                        label: "Medium Property",
                        desc: "Standard single-family home (under ½ acre)",
                        icon: "🏡",
                      },
                      {
                        value: "large",
                        label: "Large Property",
                        desc: "Spacious home or property (½ to 2 acres)",
                        icon: "🏘️",
                      },
                      {
                        value: "xl",
                        label: "Extra Large",
                        desc: "Estate or very large property (2+ acres)",
                        icon: "🏰",
                      },
                    ]
                ).map((option) => (
                  <motion.div
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`cursor-pointer border-2 transition-all duration-200 ${
                        quoteData.yardSize === option.value
                          ? "border-green-700 bg-green-700/5 shadow-md"
                          : "border-gray-200 hover:border-green-700/50 hover:shadow-sm"
                      }`}
                      onClick={() => updateQuoteData("yardSize", option.value)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl mb-2">{option.icon}</div>
                        <div className="font-medium text-sm mb-1">
                          {option.label}
                        </div>
                        <div className="text-xs text-muted leading-tight">
                          {option.desc}
                        </div>
                        {quoteData.yardSize === option.value && (
                          <div className="mt-2">
                            <Check className="w-4 h-4 text-green-700 mx-auto" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
              {_errors.yardSize && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-red-600 mt-1"
                  data-error="true"
                >
                  {_errors.yardSize[0]}
                </motion.p>
              )}
            </div>

            {/* Commercial-specific questions */}
            {isCommercial && (
              <>
                <div>
                  <Label
                    htmlFor="businessType"
                    className="text-base font-medium"
                  >
                    Business Type *
                  </Label>
                  <Select
                    value={quoteData.businessType || ""}
                    onValueChange={(value) =>
                      updateQuoteData("businessType", value)
                    }
                  >
                    <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-green-700/30 focus:ring-2 focus:ring-green-700 focus:ring-offset-2 focus:outline-none">
                      <SelectValue placeholder="Select your business type" />
                    </SelectTrigger>
                    <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-green-700 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                      <SelectItem value="dog-park">
                        🏞️ Dog Park or Recreation Area
                      </SelectItem>
                      <SelectItem value="veterinary">
                        🏥 Veterinary Clinic or Hospital
                      </SelectItem>
                      <SelectItem value="grooming">
                        ✂️ Grooming Salon
                      </SelectItem>
                      <SelectItem value="boarding">
                        🏠 Boarding or Daycare Facility
                      </SelectItem>
                      <SelectItem value="hotel">
                        🏨 Pet Hotel or Resort
                      </SelectItem>
                      <SelectItem value="training">
                        🎾 Training Facility
                      </SelectItem>
                      <SelectItem value="retail">
                        🛍️ Pet Retail Store
                      </SelectItem>
                      <SelectItem value="other">
                        🏢 Other Commercial Facility
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {_errors.businessType && (
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-sm text-red-600 mt-1"
                      data-error="true"
                    >
                      {_errors.businessType[0]}
                    </motion.p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="serviceFrequency"
                    className="text-base font-medium"
                  >
                    Typical Service Frequency
                  </Label>
                  <p className="text-sm text-muted mt-1">
                    How often do you need waste removal services?
                  </p>
                  <Select
                    value={quoteData.serviceFrequency || ""}
                    onValueChange={(value) =>
                      updateQuoteData("serviceFrequency", value)
                    }
                  >
                    <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-green-700/30 focus:ring-2 focus:ring-green-700 focus:ring-offset-2 focus:outline-none">
                      <SelectValue placeholder="Select service frequency" />
                    </SelectTrigger>
                    <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-green-700 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                      <SelectItem value="daily">
                        Daily - High-traffic facility
                      </SelectItem>
                      <SelectItem value="multiple-daily">
                        Multiple times daily - Very busy operation
                      </SelectItem>
                      <SelectItem value="weekly">
                        Weekly - Standard maintenance
                      </SelectItem>
                      <SelectItem value="as-needed">
                        As needed - Variable traffic
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Cleanup Assessment - Different for residential vs commercial */}
            <div>
              <Label htmlFor="lastCleanup" className="text-base font-medium">
                {isCommercial
                  ? "Current Cleanup Situation *"
                  : "When was your yard last cleaned? *"}
              </Label>
              <p className="text-sm text-muted mt-1 mb-3">
                {isCommercial
                  ? "How often is waste currently being removed from your property?"
                  : "This helps us provide the most accurate pricing for your specific needs"}
              </p>
              <div className="grid grid-cols-1 gap-3 mt-3">
                {(isCommercial
                  ? [
                      {
                        value: 1,
                        label: "Daily - Well maintained",
                        desc: "Professional cleanup daily",
                      },
                      {
                        value: 3,
                        label: "Every few days - Moderate traffic",
                        desc: "3-4 days between cleanups",
                      },
                      {
                        value: 7,
                        label: "Weekly - Standard facility",
                        desc: "Weekly maintenance",
                      },
                      {
                        value: 14,
                        label: "Every 2 weeks - Lower traffic",
                        desc: "Bi-weekly service",
                      },
                      {
                        value: 30,
                        label: "Monthly - Minimal use",
                        desc: "Monthly cleanup only",
                      },
                      {
                        value: 90,
                        label: "Over 3 months - Needs attention",
                        desc: "Significant accumulation",
                      },
                    ]
                  : [
                      {
                        value: 14,
                        label: "< 2 weeks (It's spotless)",
                        desc: "Recently cleaned",
                      },
                      {
                        value: 42,
                        label: "2–6 weeks (It's pretty neglected)",
                        desc: "Moderate accumulation",
                      },
                      {
                        value: 999,
                        label: "> 6 weeks (Watch your step!)",
                        desc: "Significant cleanup needed",
                      },
                    ]
                ).map((option) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 text-left border-2 rounded-lg transition-all duration-200 ${
                      quoteData.deepCleanAssessment?.daysSinceLastCleanup ===
                      option.value
                        ? "border-green-700 bg-green-700/5 shadow-md"
                        : "border-gray-200 hover:border-green-700/50 hover:shadow-sm bg-white"
                    }`}
                    onClick={() =>
                      updateQuoteData("deepCleanAssessment", {
                        ...quoteData.deepCleanAssessment,
                        daysSinceLastCleanup: option.value,
                      })
                    }
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm mb-1">
                          {option.label}
                        </div>
                        <div className="text-xs text-muted">{option.desc}</div>
                      </div>
                      {quoteData.deepCleanAssessment?.daysSinceLastCleanup ===
                        option.value && (
                        <Check className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                {isCommercial
                  ? "💼 This helps us understand your current maintenance needs"
                  : "🧹 This sets the one-time initial clean price"}
              </p>
            </div>

            {/* Areas to Clean (DoodyCalls inspired) */}
            {!isCommercial && (
              <div>
                <Label className="text-base font-medium">Areas to Clean</Label>
                <p className="text-sm text-muted mt-1 mb-3">
                  Which areas of your property need service? (Select all that
                  apply)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "frontYard", label: "Front Yard", icon: "🌳" },
                    { id: "backYard", label: "Back Yard", icon: "🏡" },
                    { id: "sideYard", label: "Side Yard", icon: "🌿" },
                    { id: "dogRun", label: "Dog Run", icon: "🏃" },
                    {
                      id: "fencedArea",
                      label: "Additional Fenced Area",
                      icon: "🔒",
                    },
                  ].map((area) => (
                    <motion.div
                      key={area.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className={`cursor-pointer border-2 transition-all duration-200 ${
                          quoteData.areasToClean?.[area.id]
                            ? "border-green-700 bg-green-700/5"
                            : "border-gray-200 hover:border-green-700/50"
                        }`}
                        onClick={() => {
                          const currentAreas = quoteData.areasToClean || {};
                          updateQuoteData("areasToClean", {
                            ...currentAreas,
                            [area.id]: !currentAreas[area.id],
                          });
                        }}
                      >
                        <CardContent className="p-3 text-center">
                          <div className="text-xl mb-1">{area.icon}</div>
                          <p className="text-sm font-medium">{area.label}</p>
                          {quoteData.areasToClean?.[area.id] && (
                            <CheckCircle className="w-4 h-4 text-green-700 mx-auto mt-1" />
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-3">
                  <Label htmlFor="otherArea" className="text-sm">
                    Other areas:
                  </Label>
                  <Input
                    id="otherArea"
                    placeholder="e.g., Deck, Patio, Driveway"
                    value={quoteData.areasToClean?.other || ""}
                    onChange={(e) => {
                      const currentAreas = quoteData.areasToClean || {};
                      updateQuoteData("areasToClean", {
                        ...currentAreas,
                        other: e.target.value,
                      });
                    }}
                    className="mt-1 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </>
        </CardContent>
      </Card>
    </div>
  );
}

// Step 5.5: Commercial Contact Step

// Step 1: Zip Code Check (DoodyCalls inspired)
function StepZipCheck({
  quoteData,
  updateQuoteData,
  _errors,
  onNext,
  userOrgId,
}: any) {
  const [zipCode, setZipCode] = useState(quoteData.zipCode || "");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    location?: string;
  } | null>(null);

  // ZIP validation is now handled by the configurable business system

  const validateZipCode = async () => {
    if (!zipCode.trim()) {
      setValidationResult({ valid: false, message: "Please enter a zip code" });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      // Use API route instead of direct function call to avoid Prisma client in browser
      const response = await fetch("/api/admin/zip-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zipCode: zipCode.trim(),
          businessId: userOrgId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to validate ZIP code");
      }

      const eligibilityResult = await response.json();

      setValidationResult({
        valid: eligibilityResult.eligible,
        message: eligibilityResult.message,
        location: eligibilityResult.zone?.name || "Outside Service Area",
      });

      if (eligibilityResult.eligible) {
        updateQuoteData("zipCode", zipCode.trim());
      }

      track("zip_check", {
        zip: zipCode.trim(),
        inArea: eligibilityResult.eligible,
        location: eligibilityResult.zone?.name || "Outside Service Area",
        zone: eligibilityResult.zone?.zoneId || null,
        estimatedDelivery: eligibilityResult.estimatedDelivery || null,
      });
    } catch (error) {
      console.error("ZIP validation error:", error);
      setValidationResult({
        valid: false,
        message: "Unable to validate ZIP code. Please try again.",
      });
    }

    setIsValidating(false);
  };

  const handleContinue = () => {
    if (validationResult?.valid) {
      updateQuoteData("zipCode", zipCode.trim());
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-green-700" />
            Service Area Check
          </CardTitle>
          <p className="text-muted">
            Let's make sure we can provide service in your area. Enter your zip
            code below.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Location Display */}
          <div className="bg-green-700/5 border border-green-700/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-700 to-green-600 rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-700">
                  {validationResult?.location || "Twin Cities Metro Area"}
                </p>
                <p className="text-sm text-muted">Minnesota</p>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Serving Minneapolis, Richfield, Edina, Bloomington, and
              surrounding areas
            </p>
          </div>

          {/* Zip Code Input */}
          <div>
            <Label htmlFor="zipCode" className="text-base font-medium">
              Zip Code *
            </Label>
            <div className="flex gap-3 mt-2">
              <Input
                id="zipCode"
                type="text"
                placeholder="55401"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="flex-1 bg-white border-2 border-gray-200 hover:border-teal-700/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
                maxLength={5}
              />
              <Button
                onClick={validateZipCode}
                disabled={!zipCode.trim() || isValidating}
                className="px-6"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Check"
                )}
              </Button>
            </div>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                validationResult.valid
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-yellow-50 border-yellow-200 text-yellow-800"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    validationResult.valid ? "bg-green-500" : "bg-yellow-500"
                  }`}
                >
                  {validationResult.valid ? (
                    <CheckCircle className="w-3 h-3 text-white" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{validationResult.message}</p>
                  {validationResult.location && (
                    <p className="text-sm mt-1 opacity-80">
                      {validationResult.location}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Step 3: Service Frequency Selection (DoodyCalls inspired)
function StepFrequency({
  quoteData,
  updateQuoteData,
  _errors,
  _estimatedPrice,
}: any) {
  // Use the same options from priceEstimator for consistency
  const serviceTypeOptions = getServiceTypeOptions();

  const frequencyOptions = serviceTypeOptions.map((option) => ({
    id: option.value,
    title: option.label,
    subtitle: option.isPopular
      ? "Most Popular"
      : option.description.split(" - ")[0] || "",
    visits: option.description,
    description: option.description,
    icon:
      option.value === "weekly"
        ? "📅"
        : option.value === "biweekly"
          ? "📆"
          : option.value === "twice-weekly"
            ? "⚡"
            : option.value === "monthly"
              ? "📊"
              : option.value === "onetime"
                ? "🧹"
                : "📅",
    popular: option.isPopular || false,
  }));

  const handleFrequencySelect = (frequency: string) => {
    updateQuoteData("frequency", frequency);
    track("frequency_selected", { frequency, _estimatedPrice });
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-green-700" />
            Service Frequency
          </CardTitle>
          <p className="text-muted">
            How often do you need service? We'll match your needs with the right
            frequency.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {frequencyOptions.map((option) => (
              <motion.div
                key={option.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className={`cursor-pointer border-2 transition-all duration-200 hover:shadow-md ${
                    quoteData.frequency === option.id
                      ? "border-green-700 bg-green-700/8 shadow-md"
                      : "border-gray-200 hover:border-green-700/60"
                  }`}
                  onClick={() => handleFrequencySelect(option.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">{option.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base">
                              {option.title}
                            </h3>
                            {option.popular && (
                              <span className="bg-gradient-to-r from-green-700 to-green-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                Most Popular
                              </span>
                            )}
                          </div>
                          <p className="text-muted text-xs">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {quoteData.frequency === option.id && (
                          <CheckCircle className="w-5 h-5 text-green-700" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Estimated Monthly Cost - Show prominently for recurring services */}
      {_estimatedPrice &&
        quoteData.frequency &&
        quoteData.frequency !== "onetime" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-700/30 rounded-xl p-6 text-center shadow-lg"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-700 rounded-full"></div>
              <p className="text-sm font-medium text-green-700">
                Estimated Monthly Cost
              </p>
              <div className="w-2 h-2 bg-green-700 rounded-full"></div>
            </div>
            <p className="text-3xl font-bold text-green-700 mb-1">
              ${_estimatedPrice.monthly}
            </p>
            <p className="text-sm text-muted">
              {_estimatedPrice.visitsPerMonth} visits per month • Best value for
              consistent service
            </p>
          </motion.div>
        )}
    </div>
  );
}

// Step 2: Service Type Selection (DoodyCalls inspired)
function StepServiceType({ quoteData, updateQuoteData, onNext }: any) {
  const handleServiceTypeSelect = (
    serviceType: "residential" | "commercial",
  ) => {
    updateQuoteData("serviceType", serviceType);
    track("service_type_selected", { serviceType });
    onNext();
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="size-5 text-green-700" />
            Service Type
          </CardTitle>
          <p className="text-muted">What type of service do you need?</p>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Residential Service */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="cursor-pointer border-2 hover:border-green-700 transition-all duration-200 hover:shadow-lg"
                onClick={() => handleServiceTypeSelect("residential")}
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-700/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Home className="w-8 h-8 text-green-700" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Residential</h3>
                  <p className="text-muted text-base leading-relaxed">
                    We clean up after your dog in your own yard. Perfect for
                    homes and apartments.
                  </p>
                  <div className="mt-4 text-xs text-muted">
                    Most popular choice
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Commercial Service */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="cursor-pointer border-2 hover:border-green-700 transition-all duration-200 hover:shadow-lg"
                onClick={() => handleServiceTypeSelect("commercial")}
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-700/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building className="w-8 h-8 text-green-700" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Community</h3>
                  <p className="text-muted text-base leading-relaxed">
                    Pet waste stations and common-area cleanup for HOAs,
                    apartments, and businesses.
                  </p>
                  <div className="mt-4 text-xs text-muted">
                    Custom quote required
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuoteWizard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-white via-accent-soft/10 to-accent-soft/20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700 mx-auto mb-4"></div>
            <p className="text-muted">
              Loading your enhanced quote experience...
            </p>
          </div>
        </div>
      }
    >
      <QuoteWizardComponent />
    </Suspense>
  );
}
