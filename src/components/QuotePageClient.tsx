"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle,
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
  User
} from "lucide-react";
import Reveal from "@/components/Reveal";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { track } from "@/lib/analytics";
import { useSession, signIn } from "next-auth/react";
import {
  QuoteInput,
  calculatePrice,
  getYardSizeOptions,
  getAddonOptions,
  getFrequencyOptions,
  getPremiumOnboardingOptions,
  getServiceTypeOptions,
  formatPrice,
  getFrequencyDisplayName,
  getVisitRange,
  getCalendarPricingNote,
  Frequency,
  PremiumOnboarding
} from "@/lib/priceEstimator";
import { FormProtection, HoneypotField } from "@/components/ui/recaptcha";
import { env } from "@/lib/env";

// DoodyCalls-style pricing summary sidebar component
const PricingSummary = ({ pricing, frequency, currentStep, quoteData }: { pricing: any, frequency?: string, currentStep?: number, quoteData?: any }) => {
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
              {pricing.commercialMessage || 'Please contact us for a custom quote based on your property details.'}
            </p>
            <div className="space-y-2">
              <a
                href="tel:1-888-915-9273"
                className="flex items-center gap-2 text-accent hover:text-accent-dark"
              >
                <Phone className="size-4" />
                <span>Call 1-888-915-YARD</span>
              </a>
              <a
                href="/contact"
                className="flex items-center gap-2 text-accent hover:text-accent-dark"
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
    if (frequency === 'onetime') return null; // No discount for one-time

    const initialCleanAmount = parseFloat(pricing.initialClean || '0');
    if (initialCleanAmount === 0) return null; // No initial clean needed

    if (frequency === 'monthly') {
      return {
        discountPercent: 50,
        discountAmount: initialCleanAmount * 0.5,
        finalAmount: initialCleanAmount * 0.5
      };
    } else if (['weekly', 'biweekly', 'twice-weekly'].includes(frequency || '')) {
      return {
        discountPercent: 100,
        discountAmount: initialCleanAmount,
        finalAmount: 0
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
        {frequency === 'onetime' ? (
          // One-time service: only show initial clean cost
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">One-time service cost</div>
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
              <span className="text-sm text-gray-600">Total for first visit</span>
              <span className="font-semibold text-lg">${pricing.oneTime}</span>
            </div>
            {/* Free initial visit indicator for property details step */}
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
              <p className="text-xs text-green-700 text-center">
                💚 <strong>First visit FREE</strong> with weekly, bi-weekly, or twice-weekly subscriptions!
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
              <span className="text-sm text-gray-600">Total for first visit</span>
              <span className="font-semibold text-lg">
                {discount ? `$${discount.finalAmount.toFixed(2)}` : `$${pricing.oneTime}`}
              </span>
            </div>
            {/* Show discount explanation if applicable */}
            {discount && discount.discountPercent === 100 && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                <p className="text-xs text-green-700 text-center">
                  💚 First visit FREE with recurring service!
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
          {frequency === 'onetime' ? (
            // One-time service: focus on the service details
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">One-time service</span>
                <span className="text-sm font-medium">${pricing.oneTime}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1 ml-2">
                <div>• Complete yard cleanup</div>
                <div>• {quoteData?.dogs || 2} Dog{quoteData?.dogs > 1 ? 's' : ''}</div>
                <div>• {quoteData?.yardSize ? quoteData.yardSize.charAt(0).toUpperCase() + quoteData.yardSize.slice(1) : 'Medium'} property</div>
                {quoteData?.areasToClean && Object.values(quoteData.areasToClean).some(v => v) && (
                  <div>• Service areas: {(() => {
                    const areas = [];
                    if (quoteData.areasToClean.frontYard) areas.push('Front');
                    if (quoteData.areasToClean.backYard) areas.push('Back');
                    if (quoteData.areasToClean.sideYard) areas.push('Side');
                    if (quoteData.areasToClean.dogRun) areas.push('Dog Run');
                    if (quoteData.areasToClean.fencedArea) areas.push('Fenced');
                    if (quoteData.areasToClean.other) areas.push(quoteData.areasToClean.other);
                    return areas.length > 0 ? areas.join(', ') : 'Standard areas';
                  })()}</div>
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
                <div>• {quoteData?.dogs || 2} Dog{quoteData?.dogs > 1 ? 's' : ''}</div>
                <div>• {quoteData?.yardSize ? quoteData.yardSize.charAt(0).toUpperCase() + quoteData.yardSize.slice(1) : 'Medium'} property</div>
                {quoteData?.areasToClean && Object.values(quoteData.areasToClean).some(v => v) && (
                  <div>• Service areas: {(() => {
                    const areas = [];
                    if (quoteData.areasToClean.frontYard) areas.push('Front');
                    if (quoteData.areasToClean.backYard) areas.push('Back');
                    if (quoteData.areasToClean.sideYard) areas.push('Side');
                    if (quoteData.areasToClean.dogRun) areas.push('Dog Run');
                    if (quoteData.areasToClean.fencedArea) areas.push('Fenced');
                    if (quoteData.areasToClean.other) areas.push(quoteData.areasToClean.other);
                    return areas.length > 0 ? areas.join(', ') : 'Standard areas';
                  })()}</div>
                )}
                {(() => {
                  const selectedAreas = quoteData?.areasToClean ? Object.values(quoteData.areasToClean).filter(v => v).length : 0;
                  const extraAreas = Math.max(0, selectedAreas - 1);
                  if (extraAreas > 0) {
                    const costPerArea = frequency === 'onetime' ? 5 : 3;
                    return <div>• +${extraAreas * costPerArea} for {extraAreas} additional area{extraAreas > 1 ? 's' : ''}</div>;
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 my-3" />

          {/* Add-ons */}
          {quoteData?.addOns && (quoteData.addOns.deodorize || quoteData.addOns.deodorizeMode) && (
            <>
              <div>
                <div className="text-sm font-medium mb-2">Add-ons</div>
                {quoteData.addOns.deodorize && (
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span>
                      Deodorize & Sanitize
                      {quoteData.addOns.deodorizeMode === 'first-visit' && ' (First visit only)'}
                      {quoteData.addOns.deodorizeMode === 'each-visit' && ' (Each visit)'}
                      {quoteData.addOns.deodorizeMode === 'every-other' && ' (Every other visit)'}
                      {quoteData.addOns.deodorizeMode === 'onetime' && ' (One-time service)'}
                    </span>
                    <span>
                      {quoteData.addOns.deodorizeMode === 'every-other' ? '+$12.50' : '+$25'}
                      {quoteData.addOns.deodorizeMode === 'first-visit' && ' one-time'}
                      {quoteData.addOns.deodorizeMode === 'each-visit' && ' per visit'}
                      {quoteData.addOns.deodorizeMode === 'every-other' && ' per visit'}
                      {quoteData.addOns.deodorizeMode === 'onetime' && ' one-time'}
                    </span>
                  </div>
                )}

                {/* Spray Deck Add-on */}
                {quoteData.addOns?.sprayDeck && (
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span>
                      Spray Deck/Patio
                      {quoteData.addOns.sprayDeckMode === 'first-visit' && ' (First visit only)'}
                      {quoteData.addOns.sprayDeckMode === 'each-visit' && ' (Each visit)'}
                      {quoteData.addOns.sprayDeckMode === 'onetime' && ' (One-time service)'}
                    </span>
                    <span>
                      +$12
                      {quoteData.addOns.sprayDeckMode === 'first-visit' && ' one-time'}
                      {quoteData.addOns.sprayDeckMode === 'each-visit' && ' per visit'}
                      {quoteData.addOns.sprayDeckMode === 'onetime' && ' one-time'}
                    </span>
                  </div>
                )}

                {/* Divert from Landfill Add-on */}
                {quoteData.addOns?.divertMode && quoteData.addOns.divertMode !== 'none' && (
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span>
                      🌱 Take away
                      {quoteData.addOns.divertMode === 'takeaway' && ' (standard)'}
                      {quoteData.addOns.divertMode === '25' && ' - divert 25%'}
                      {quoteData.addOns.divertMode === '50' && ' - divert 50%'}
                      {quoteData.addOns.divertMode === '100' && ' - divert 100%'}
                    </span>
                    <span>
                      {quoteData.addOns.divertMode === 'takeaway' && '+$3'}
                      {quoteData.addOns.divertMode === '25' && '+$1'}
                      {quoteData.addOns.divertMode === '50' && '+$2'}
                      {quoteData.addOns.divertMode === '100' && '+$6'}
                      {quoteData.frequency === 'onetime' ? ' one-time' : ' per visit'}
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 my-3" />
            </>
          )}

          {/* One-time charges with discount */}
          {parseFloat(pricing.initialClean || '0') > 0 && (
            <>
              <div>
                <div className="text-sm font-medium mb-2">One-time charges</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span>Initial clean ({pricing.initialCleanBucket || '2-6 weeks'})</span>
                    <span>${pricing.initialClean}</span>
                  </div>
                  {discount && (
                    <div className="flex justify-between items-center text-xs text-green-600 bg-green-50 p-2 rounded">
                      <span>🎉 First visit discount ({discount.discountPercent}% off)</span>
                      <span>-${discount.discountAmount.toFixed(2)}</span>
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
              {discount ? `$${discount.finalAmount.toFixed(2)}` : `$${pricing.oneTime}`}
            </span>
          </div>

          {/* Monthly billing note */}
          {frequency !== 'onetime' && pricing.monthly !== pricing.oneTime && pricing.monthly !== '0.00' && (
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
          Call us at <a href="tel:1-888-915-9273" className="text-blue-600 hover:underline">1-888-915-YARD</a> or{' '}
          <a href="/contact" className="text-blue-600 hover:underline">request more information</a>
        </p>
      </div>
    </div>
  );
};

// Enhanced step configuration with conditional flow - inspired by DoodyCalls
const getSteps = (frequency?: string, isCommercial?: boolean) => [
  {
    id: 'zip-check',
    title: 'Service Area',
    description: 'Verify your location for service',
    icon: MapPin,
    color: 'from-blue-500 to-purple-600'
  },
  {
    id: 'service-type',
    title: 'Service Type',
    description: 'Residential or community service',
    icon: Building,
    color: 'from-purple-500 to-pink-600'
  },
  {
    id: 'basics',
    title: 'Property Details',
    description: 'Tell us about your dogs and yard',
    icon: Home,
    color: 'from-green-500 to-emerald-600'
  },
  // Skip service frequency step for commercial properties
  ...(isCommercial ? [] : [{
    id: 'frequency',
    title: 'Service Frequency',
    description: 'How often do you need service?',
    icon: Clock,
    color: 'from-orange-500 to-red-600'
  }]),
  ...(isCommercial ? [] : [{
    id: 'customization',
    title: 'Customize Service',
    description: 'Add extras and preferences',
    icon: Settings,
    color: 'from-yellow-500 to-orange-600'
  }]),
  // Wellness insights step (only for residential, not commercial)
  ...(isCommercial ? [] : [{
    id: 'wellness',
    title: 'Wellness & Health',
    description: 'Basic insights included free - add premium options',
    icon: Star,
    color: 'from-teal-500 to-cyan-600'
  }]),
  ...(isCommercial ? [{
    id: 'commercial-contact',
    title: 'Commercial Contact',
    description: 'Provide your details for custom quote',
    icon: Building,
    color: 'from-indigo-500 to-blue-600'
  }] : []),
  {
    id: 'contact-review',
    title: isCommercial ? 'Review & Submit' : 'Contact & Confirm',
    description: isCommercial ? 'Review your request and submit' : 'Your info and final quote review',
    icon: CheckCircle,
    color: 'from-emerald-500 to-teal-600'
  }
];

// Trust signals data
const TRUST_SIGNALS = [
  { icon: Shield, text: "Licensed & Insured", description: "Fully licensed and insured for your peace of mind" },
  { icon: Award, text: "5-Star Service", description: "Average 4.9-star rating from 500+ happy customers" },
  { icon: Truck, text: "Reliable Service", description: "98% on-time service rate with flexible scheduling" },
  { icon: Heart, text: "Eco-Friendly", description: "Carbon-neutral service with sustainable practices" }
];

function QuotePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { prefersReducedMotion } = useReducedMotionSafe();
  const { data: session, status } = useSession();

  // Simplified state management
  const [currentStep, setCurrentStep] = useState(0);
  const [quoteData, setQuoteData] = useState<Partial<QuoteInput>>({
    serviceType: 'residential', // Default to residential
    dogs: 1,
    yardSize: 'medium',
    frequency: 'weekly',
    addOns: {},
    initialClean: false,
    premiumOnboarding: 'none',
    consent: { stoolPhotosOptIn: false, terms: false }
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showTrustSignals, setShowTrustSignals] = useState(true);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [formProtectionErrors, setFormProtectionErrors] = useState<string[]>([]);

  // Calculate price when needed
  const pricing = useMemo(() => {
    // For basics/customization step, we can estimate price with just dogs and yardSize
    if (quoteData.dogs && quoteData.yardSize) {
      try {
        // Use selected frequency or default to weekly for estimation
        const frequencyToUse = quoteData.frequency || 'weekly';

        return calculatePrice({
          dogs: quoteData.dogs,
          yardSize: quoteData.yardSize,
          frequency: frequencyToUse,
          addons: quoteData.addOns || {},
          initialClean: quoteData.initialClean,
          premiumOnboarding: quoteData.premiumOnboarding,
          deepCleanAssessment: quoteData.deepCleanAssessment,
          propertyType: quoteData.propertyType,
          address: quoteData.address || '', // Provide empty string if not set
          lastCleanedBucket: quoteData.deepCleanAssessment?.daysSinceLastCleanup?.toString(),
          lastCleanedDate: quoteData.lastCleanedDate,
          ...(quoteData.areasToClean && { areasToClean: quoteData.areasToClean })
        } as any);
      } catch (error) {
        console.error('Price calculation error:', error);
        return null;
      }
    }
    return null;
  }, [quoteData.dogs, quoteData.yardSize, quoteData.frequency, quoteData.addOns, quoteData.initialClean, quoteData.premiumOnboarding, quoteData.deepCleanAssessment, quoteData.propertyType, quoteData.address, quoteData.areasToClean]);

  // Extract pricing display values
  const estimatedPrice = useMemo(() => {
    if (!pricing) return null;

    // Handle commercial properties - show contact message instead of pricing
    if (pricing.requiresCustomQuote) {
      return {
        perVisit: 'Contact Us',
        monthly: 'Custom Quote',
        oneTime: 'Contact Us',
        requiresCustomQuote: true,
        commercialMessage: pricing.commercialMessage,
        showContactStep: true
      };
    }

    return {
      perVisit: (pricing.perVisit / 100).toFixed(2),
      monthly: (pricing.monthly / 100).toFixed(2),
      oneTime: (pricing.oneTime / 100).toFixed(2),
      initialClean: pricing.initialClean ? (pricing.initialClean / 100).toFixed(2) : '0.00',
      initialCleanBucket: pricing.initialCleanBucket,
      visitsPerMonth: pricing.visitsPerMonth,
      breakdown: pricing.breakdown,
      showContactStep: false
    };
  }, [pricing]);

  // Auto-hide trust signals after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowTrustSignals(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Load saved quote from localStorage
  useEffect(() => {
    const resume = searchParams.get('resume');
    if (resume === '1') {
      const savedQuote = localStorage.getItem('yardura_pending_quote_v2');
      if (savedQuote) {
        try {
          const parsedQuote = JSON.parse(savedQuote);
          if (parsedQuote && typeof parsedQuote === 'object') {
            setQuoteData(parsedQuote);
            // Smart step progression based on data completeness
            if (parsedQuote.dogs && parsedQuote.yardSize && parsedQuote.frequency) {
              if (parsedQuote.contact?.name && parsedQuote.contact?.email) {
                setCurrentStep(4); // Go to review step
              } else {
                setCurrentStep(3); // Go to contact step
              }
            } else if (parsedQuote.dogs || parsedQuote.yardSize || parsedQuote.frequency) {
              setCurrentStep(1); // Go to basics step
            }
          }
        } catch (error) {
          console.error('Error loading saved quote:', error);
          localStorage.removeItem('yardura_pending_quote_v2');
        }
      }
    }
  }, [searchParams]);

  // Auto-save quote data
  useEffect(() => {
    if (quoteData.dogs || quoteData.yardSize || quoteData.frequency || quoteData.contact?.name) {
      try {
        localStorage.setItem('yardura_pending_quote_v2', JSON.stringify(quoteData));
      } catch (error) {
        console.error('Error saving quote to localStorage:', error);
      }
    }
  }, [quoteData]);

  // Get dynamic steps based on frequency and commercial status
  const STEPS = getSteps(quoteData.frequency, quoteData.serviceType === 'commercial');

  // Analytics tracking
  useEffect(() => {
    track('quote_step_view', {
      step: currentStep + 1,
      step_name: STEPS[currentStep]?.id || 'unknown',
      has_estimate: !!estimatedPrice,
      dogs: quoteData.dogs,
      frequency: quoteData.frequency
    });
  }, [currentStep, estimatedPrice, quoteData.dogs, quoteData.frequency, STEPS]);

  // Simplified data update function
  const updateQuoteData = (field: keyof QuoteInput, value: any) => {
    setQuoteData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear errors for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Simplified validation function
  const validateCurrentStep = () => {
    const newErrors: Record<string, string[]> = {};
    const currentStepData = STEPS[currentStep];

    switch (currentStepData?.id) {
      case 'basics':
        // Default to residential if not set (shouldn't happen but safety check)
        const serviceType = quoteData.serviceType || 'residential';

        // Dog validation - different limits for residential vs commercial
        if (serviceType === 'residential') {
          if (!quoteData.dogs || quoteData.dogs < 1 || quoteData.dogs > 4) {
            newErrors.dogs = ['Please select between 1-4 dogs'];
          }
        } else if (serviceType === 'commercial') {
          if (!quoteData.dogs || quoteData.dogs < 1) {
            newErrors.dogs = ['Please enter the expected number of dogs'];
          }
          if (!quoteData.businessType) {
            newErrors.businessType = ['Please select your business type'];
          }
        }

        if (!quoteData.yardSize) {
          newErrors.yardSize = ['Please select your service area size for accurate pricing'];
        }

        // Require last cleanup selection
        if (!quoteData.deepCleanAssessment?.daysSinceLastCleanup) {
          newErrors.deepCleanAssessment = ['Please select when the last cleanup occurred'];
        }
        break;

      case 'service-type':
        if (!quoteData.frequency) {
          newErrors.frequency = ['Please choose your preferred service frequency'];
        }
        // Address validation moved to basics step
        break;

      case 'onboarding':
        // Onboarding step is optional - no validation required
        break;

      case 'commercial-contact':
        if (!quoteData.contact?.name?.trim()) {
          newErrors.contact = ['Please enter your full name'];
        }
        if (!quoteData.contact?.email?.trim()) {
          newErrors.contact = [...(newErrors.contact || []), 'Please enter your email address'];
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(quoteData.contact.email)) {
            newErrors.contact = [...(newErrors.contact || []), 'Please enter a valid email address'];
          }
        }
        if (!quoteData.contact?.phone?.trim()) {
          newErrors.contact = [...(newErrors.contact || []), 'Please enter your phone number'];
        }
        break;

      case 'contact-review':
        // Address validation
        if (!quoteData.address?.trim()) {
          newErrors.address = ['Please enter your complete service address'];
        } else {
          // Use addressValidated if available (from Google Places autocomplete)
          if (quoteData.addressValidated) {
            // Address was validated by Google Places - trust it
            console.log('Address validation: Using validated address from Google Places');
          } else {
            // Fallback to manual validation for addresses entered without autocomplete
            const address = quoteData.address.trim();
            const hasNumber = /\d+/.test(address);
            const inState = /\bmn\b|minnesota/.test(address.toLowerCase());
            const serviceCities = ['minneapolis','st paul','st. paul','bloomington','eden prairie','plymouth','edina','richfield','minnetonka','wayzata','hopkins','golden valley','robbinsdale','crystal','new hope'];
            const inCities = serviceCities.some(c => address.toLowerCase().includes(c));

            if (!hasNumber || address.length < 8) {
              newErrors.address = ['Please enter a valid street address with a number'];
            } else if (!inState) {
              newErrors.address = ['We currently only serve Minnesota'];
            } else if (!inCities) {
              newErrors.address = ['Please enter a valid Twin Cities area address'];
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
    setErrors({});

    if (validateCurrentStep()) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);

        // Scroll to top for better UX
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    } else {
      // Scroll to first error
      setTimeout(() => {
        const firstErrorElement = document.querySelector('[data-error="true"]');
        if (firstErrorElement) {
          firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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

    // Check form protection
    if (!recaptchaToken && env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      setFormProtectionErrors(['Please complete the security verification']);
      return;
    }

    setIsSubmitting(true);
    setFormProtectionErrors([]);

    try {
      // Enhanced analytics tracking
      track('quote_complete', {
        dogs: quoteData.dogs,
        yard_size: quoteData.yardSize,
        frequency: quoteData.frequency,
        property_type: quoteData.propertyType,
        estimated_price: quoteData.propertyType === 'commercial' ? 0 :
          (quoteData.frequency === 'onetime'
            ? parseFloat(estimatedPrice?.oneTime || '0')
            : parseFloat(estimatedPrice?.monthly || '0')),
        addons: quoteData.addOns,
        has_health_insights: quoteData.consent?.stoolPhotosOptIn,
        has_recaptcha: !!recaptchaToken,
        is_commercial: quoteData.propertyType === 'commercial'
      });

      // Prepare submission data with form protection
      const submissionData = {
        ...quoteData,
        recaptchaToken,
        submittedAt: new Date().toISOString(),
        // Honeypot field (should be empty)
        website: '',
      };

      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setFormProtectionErrors(['Too many requests. Please wait a moment and try again.']);
        } else if (result.errors) {
          setFormProtectionErrors(result.errors);
        } else {
          setFormProtectionErrors(['Failed to submit quote. Please try again.']);
        }
        return;
      }

      // Success - clean up and redirect
      localStorage.removeItem('yardura_pending_quote_v2');

      // Track successful conversion
      track('quote_conversion', {
        protection_score: result.protectionScore,
        dogs: quoteData.dogs,
        estimated_value: quoteData.propertyType === 'commercial' ? 0 : pricing?.total,
        is_commercial: quoteData.propertyType === 'commercial'
      });

      // Handle commercial vs residential success flow
      if (quoteData.propertyType === 'commercial') {
        // For commercial quotes, redirect to success page with commercial flag
        router.push('/quote/success?commercial=true');
      } else {
        router.push('/quote/success');
      }
    } catch (error) {
      console.error('Quote submission failed:', error);
      setFormProtectionErrors(['Network error. Please check your connection and try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enhanced step rendering with better component structure
  const renderStep = () => {
    const step = STEPS[currentStep];

    switch (step.id) {
      case 'zip-check':
        return <StepZipCheck quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} onNext={handleNext} />;
      case 'service-type':
        return <StepServiceType quoteData={quoteData} updateQuoteData={updateQuoteData} onNext={handleNext} />;
      case 'basics':
        return <StepBasics quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} estimatedPrice={estimatedPrice} />;
      case 'frequency':
        return <StepFrequency quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} estimatedPrice={estimatedPrice} />;
      case 'customization':
        return <StepCustomization quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} estimatedPrice={estimatedPrice} />;
      case 'wellness':
        return <StepWellness quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} onNext={handleNext} />;
      case 'onboarding':
        return <StepOnboarding quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} estimatedPrice={estimatedPrice} />;
      case 'commercial-contact':
        return <StepCommercialContact quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} estimatedPrice={estimatedPrice} />;
      case 'contact-review':
        return <StepContactReview quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} estimatedPrice={estimatedPrice} formProtectionErrors={formProtectionErrors} setRecaptchaToken={setRecaptchaToken} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-accent-soft/10 to-accent/5">
      {/* Trust Signals Banner */}
      <AnimatePresence>
        {showTrustSignals && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gradient-to-r from-accent/10 to-accent-soft/20 border-b border-accent/20 overflow-hidden"
          >
            <div className="container py-3">
              <div className="flex items-center justify-center gap-6 text-sm">
                {TRUST_SIGNALS.map((signal, index) => (
                  <motion.div
                    key={signal.text}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-2 text-muted"
                  >
                    <signal.icon className="size-4 text-accent" />
                    <span className="hidden sm:inline">{signal.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center justify-center py-8 px-4 min-h-[calc(100vh-80px)]">
        {/* Enhanced Header */}
        <div className="w-full max-w-4xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <motion.div
                className="size-12 bg-accent rounded-2xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Calculator className="size-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Get Your Quote</h1>
                <p className="text-muted">Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}</p>
              </div>
            </div>


          </div>

          {/* Enhanced Progress Bar */}
          <div className="relative mb-8">
            <div className="flex items-center justify-between mb-4">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                const isClickable = isCompleted || index === currentStep + 1;

                return (
                  <motion.button
                    key={step.id}
                    onClick={() => isClickable && goToStep(index)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                      isCompleted ? 'bg-accent text-white shadow-lg' :
                      isCurrent ? 'bg-accent/10 text-accent border-2 border-accent' :
                      isClickable ? 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-accent/5 hover:text-accent hover:border-accent/30' :
                      'bg-white/50 border-2 border-gray-200 text-gray-500'
                    }`}
                    whileHover={isClickable ? { scale: 1.05 } : {}}
                    whileTap={isClickable ? { scale: 0.95 } : {}}
                  >
                    <div className={`p-2 rounded-lg ${isCompleted || isCurrent ? 'bg-white/20' : 'bg-muted'}`}>
                      <StepIcon className="size-4" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium whitespace-nowrap truncate max-w-[8rem]">{step.title}</div>
                      <div className="text-xs opacity-75 hidden sm:block whitespace-nowrap truncate max-w-[8rem]">{step.description}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-accent to-accent-soft h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Step Content with DoodyCalls-style Layout */}
        <div className="w-full max-w-6xl">
          <div className={`grid gap-8 ${currentStep >= 2 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 max-w-2xl mx-auto'}`}>
            {/* Main Form Content - Left Column */}
            <div className={`${currentStep >= 2 ? 'lg:col-span-2' : ''}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Pricing Summary Sidebar - Right Column - Show on Property Details step and beyond */}
            {currentStep >= 2 && (
              <div className="lg:col-span-1">
                {estimatedPrice && !estimatedPrice.requiresCustomQuote && (
                  <PricingSummary pricing={estimatedPrice} frequency={quoteData.frequency} currentStep={currentStep} quoteData={quoteData} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Navigation */}
        <div className="w-full max-w-4xl mt-8 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {/* Step Indicator */}
          <div className="text-sm text-muted">
            Step {currentStep + 1} of {STEPS.length}
          </div>

          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 shadow-lg"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Preparing Account...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" />
                  Proceed to Account Setup
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 shadow-lg"
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

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
    </div>
  );
}

// Enhanced Step Components

function StepWelcome({ quoteData, updateQuoteData, onNext }: any) {
  return (
    <div className="space-y-8">
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-accent-soft/20">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="size-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-lg border border-gray-200"
            >
              <img
                src="/yardura-logo.png"
                alt="Yardura Logo"
                className="size-12 object-contain"
              />
            </motion.div>

            <div>
              <h2 className="text-3xl font-bold mb-4">Welcome to Yardura!</h2>
              <p className="text-xl text-muted mb-6">
                Let's create a personalized quote for your professional dog waste removal service.
              </p>
              <p className="text-muted">
                This will only take 2-3 minutes and you'll get an instant price estimate.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-8">
              {[
                { icon: Clock, title: "Quick Setup", desc: "2-3 minutes" },
                { icon: Calculator, title: "Instant Quote", desc: "Real-time pricing" },
                { icon: Shield, title: "Secure & Private", desc: "Your data is protected" }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="p-4 bg-white/50 rounded-xl"
                >
                  <item.icon className="size-8 text-accent mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center"
      >
                          <Button
                    size="lg"
                    className="px-8 py-4 text-lg bg-accent hover:bg-accent/90 shadow-lg"
                    onClick={() => {
                      updateQuoteData('started', true);
                      onNext();
                    }}
                  >
                    Get Started
                    <ArrowRight className="size-5 ml-2" />
                  </Button>
      </motion.div>
    </div>
  );
}

function StepBasics({ quoteData, updateQuoteData, errors, estimatedPrice }: any) {
  const isCommercial = quoteData.serviceType === 'commercial';

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-accent" />
            Property Details
          </CardTitle>
          <p className="text-muted">
            {isCommercial
              ? "Tell us about your commercial property and service needs"
              : "Tell us about your home and pets"
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
                          {/* Service Type Display (DoodyCalls style) */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                {isCommercial ? (
                  <Building className="w-5 h-5 text-white" />
                ) : (
                  <Home className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <p className="font-semibold text-teal-800">
                  {isCommercial ? 'Commercial Service' : 'Residential Service'}
                </p>
                <p className="text-sm text-teal-600">
                  {isCommercial
                    ? 'Pet waste stations and common-area cleanup for businesses'
                    : 'Professional pet waste removal for your home'
                  }
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
                  className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-800">Commercial Property Service</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Perfect for dog parks, veterinary clinics, hotels, grooming salons, boarding facilities, and other businesses.
                        We'll provide a custom quote based on your specific needs.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Dog Count - Different for Residential vs Commercial */}
              <div>
                <Label htmlFor="dogs" className="text-base font-medium">
                  {isCommercial ? "Expected Number of Dogs *" : "Number of Dogs *"}
                </Label>
                <p className="text-sm text-muted mt-1">
                  {isCommercial
                    ? "How many dogs do you typically serve or expect to have on your property?"
                    : "How many dogs live in your home?"
                  }
                </p>

                {isCommercial ? (
                  // Free-form input for commercial
                  <Input
                    id="dogs"
                    type="number"
                    min="1"
                    max="500"
                    value={quoteData.dogs || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('dogs', parseInt(e.target.value) || 0)}
                    placeholder="Enter number of dogs (e.g., 50)"
                    className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
                  />
                ) : (
                  // Dropdown for residential (1-4+)
                  <Select
                    value={quoteData.dogs?.toString()}
                    onValueChange={(value) => updateQuoteData('dogs', parseInt(value))}
                  >
                    <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                      <SelectValue placeholder="Select number of dogs" />
                    </SelectTrigger>
                    <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-accent [&_*[data-radix-select-item][data-highlighted]]:text-white">
                      {[1,2,3].map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} dog{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                      <SelectItem value="4">4+ dogs</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {errors.dogs && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm text-red-600 mt-1"
                    data-error="true"
                  >
                    {errors.dogs[0]}
                  </motion.p>
                )}
              </div>

              {/* Property Type - DoodyCalls style */}
              <div>
                <Label htmlFor="yardSize" className="text-base font-medium">
                  {isCommercial ? "Service Area Size *" : "What's your place like? *"}
                </Label>
                <Select
                  value={quoteData.yardSize}
                  onValueChange={(value) => updateQuoteData('yardSize', value)}
                >
                  <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                    <SelectValue placeholder={isCommercial ? "Select service area size" : "Select your property type"} />
                  </SelectTrigger>
                  <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-accent [&_*[data-radix-select-item][data-highlighted]]:text-white">
                    {isCommercial ? (
                      // Commercial size options
                      <>
                        <SelectItem value="small">Small (&lt; 5,000 sq ft) - Small facility or office</SelectItem>
                        <SelectItem value="medium">Medium (5,000-25,000 sq ft) - Standard business or clinic</SelectItem>
                        <SelectItem value="large">Large (25,000-100,000 sq ft) - Large facility or park</SelectItem>
                        <SelectItem value="xl">XL (&gt; 100,000 sq ft) - Major facility or large park</SelectItem>
                      </>
                    ) : (
                      // Residential property type options (DoodyCalls style)
                      <>
                        <SelectItem value="small">Town House</SelectItem>
                        <SelectItem value="medium">Detached (Less than 0.5 acre lot)</SelectItem>
                        <SelectItem value="large">Detached (More than 0.5 acres lot)</SelectItem>
                        <SelectItem value="xl">Multi-family or Large Estate</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {errors.yardSize && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm text-red-600 mt-1"
                    data-error="true"
                  >
                    {errors.yardSize[0]}
                  </motion.p>
                )}
              </div>

              {/* Commercial-specific questions */}
              {isCommercial && (
                <>
                  <div>
                    <Label htmlFor="businessType" className="text-base font-medium">Business Type *</Label>
                    <Select
                      value={quoteData.businessType || ''}
                      onValueChange={(value) => updateQuoteData('businessType', value)}
                    >
                      <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                        <SelectValue placeholder="Select your business type" />
                      </SelectTrigger>
                      <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-accent [&_*[data-radix-select-item][data-highlighted]]:text-white">
                        <SelectItem value="dog-park">🏞️ Dog Park or Recreation Area</SelectItem>
                        <SelectItem value="veterinary">🏥 Veterinary Clinic or Hospital</SelectItem>
                        <SelectItem value="grooming">✂️ Grooming Salon</SelectItem>
                        <SelectItem value="boarding">🏠 Boarding or Daycare Facility</SelectItem>
                        <SelectItem value="hotel">🏨 Pet Hotel or Resort</SelectItem>
                        <SelectItem value="training">🎾 Training Facility</SelectItem>
                        <SelectItem value="retail">🛍️ Pet Retail Store</SelectItem>
                        <SelectItem value="other">🏢 Other Commercial Facility</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.businessType && (
                      <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-sm text-red-600 mt-1"
                        data-error="true"
                      >
                        {errors.businessType[0]}
                      </motion.p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="serviceFrequency" className="text-base font-medium">Typical Service Frequency</Label>
                    <p className="text-sm text-muted mt-1">How often do you need waste removal services?</p>
                    <Select
                      value={quoteData.serviceFrequency || ''}
                      onValueChange={(value) => updateQuoteData('serviceFrequency', value)}
                    >
                      <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                        <SelectValue placeholder="Select service frequency" />
                      </SelectTrigger>
                      <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-accent [&_*[data-radix-select-item][data-highlighted]]:text-white">
                        <SelectItem value="daily">Daily - High-traffic facility</SelectItem>
                        <SelectItem value="multiple-daily">Multiple times daily - Very busy operation</SelectItem>
                        <SelectItem value="weekly">Weekly - Standard maintenance</SelectItem>
                        <SelectItem value="as-needed">As needed - Variable traffic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Cleanup Assessment - Different for residential vs commercial */}
              <div>
                <Label htmlFor="lastCleanup" className="text-base font-medium">
                  {isCommercial ? "Current Cleanup Situation *" : "When was your yard last cleaned? *"}
                </Label>
                <p className="text-sm text-muted mt-1 mb-3">
                  {isCommercial
                    ? "How often is waste currently being removed from your property?"
                    : "This helps us provide the most accurate pricing for your specific needs"
                  }
                </p>
                <Select
                  value={quoteData.deepCleanAssessment?.daysSinceLastCleanup?.toString() || ''}
                  onValueChange={(value) => updateQuoteData('deepCleanAssessment', {
                    ...quoteData.deepCleanAssessment,
                    daysSinceLastCleanup: parseInt(value)
                  })}
                >
                  <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                    <SelectValue placeholder={isCommercial ? "Select cleanup frequency" : "Select time since last cleanup"} />
                  </SelectTrigger>
                  <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-accent [&_*[data-radix-select-item][data-highlighted]]:text-white">
                    {isCommercial ? (
                      // Commercial cleanup options
                      <>
                        <SelectItem value="1">Daily - Well maintained</SelectItem>
                        <SelectItem value="3">Every few days - Moderate traffic</SelectItem>
                        <SelectItem value="7">Weekly - Standard facility</SelectItem>
                        <SelectItem value="14">Every 2 weeks - Lower traffic</SelectItem>
                        <SelectItem value="30">Monthly - Minimal use</SelectItem>
                        <SelectItem value="90">Over 3 months - Needs attention</SelectItem>
                      </>
                    ) : (
                      // Residential cleanup options (DoodyCalls style)
                      <>
                        <SelectItem value="14">&lt; 2 weeks (It's spotless)</SelectItem>
                        <SelectItem value="42">2–6 weeks (It's pretty neglected)</SelectItem>
                        <SelectItem value="999">&gt; 6 weeks (Watch your step!)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted mt-2">
                  {isCommercial
                    ? "💼 This helps us understand your current maintenance needs"
                    : "🧹 This sets the one-time initial clean price"
                  }
                </p>


              </div>









              {/* Areas to Clean (DoodyCalls inspired) */}
              {!isCommercial && (
                <div>
                  <Label className="text-base font-medium">Areas to Clean</Label>
                  <p className="text-sm text-muted mt-1 mb-3">
                    Which areas of your property need service? (Select all that apply)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'frontYard', label: 'Front Yard', icon: '🌳' },
                      { id: 'backYard', label: 'Back Yard', icon: '🏡' },
                      { id: 'sideYard', label: 'Side Yard', icon: '🌿' },
                      { id: 'dogRun', label: 'Dog Run', icon: '🏃' },
                      { id: 'fencedArea', label: 'Fenced Area', icon: '🔒' },
                    ].map((area) => (
                      <motion.div
                        key={area.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={`cursor-pointer border-2 transition-all duration-200 ${
                            quoteData.areasToClean?.[area.id]
                              ? 'border-accent bg-accent/5'
                              : 'border-gray-200 hover:border-accent/50'
                          }`}
                          onClick={() => {
                            const currentAreas = quoteData.areasToClean || {};
                            updateQuoteData('areasToClean', {
                              ...currentAreas,
                              [area.id]: !currentAreas[area.id]
                            });
                          }}
                        >
                          <CardContent className="p-3 text-center">
                            <div className="text-xl mb-1">{area.icon}</div>
                            <p className="text-sm font-medium">{area.label}</p>
                            {quoteData.areasToClean?.[area.id] && (
                              <CheckCircle className="w-4 h-4 text-accent mx-auto mt-1" />
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Label htmlFor="otherArea" className="text-sm">Other areas:</Label>
                    <Input
                      id="otherArea"
                      placeholder="e.g., Deck, Patio, Driveway"
                      value={quoteData.areasToClean?.other || ''}
                      onChange={(e) => {
                        const currentAreas = quoteData.areasToClean || {};
                        updateQuoteData('areasToClean', {
                          ...currentAreas,
                          other: e.target.value
                        });
                      }}
                      className="mt-1 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
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

function StepCustomization({ quoteData, updateQuoteData, errors, estimatedPrice }: any) {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            Customize Your Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium">Add-on Services</Label>
            <p className="text-sm text-muted mt-1">Enhance your service with these optional add-ons</p>

            <div className="space-y-4 mt-4">
              <div className="p-4 border-2 rounded-lg hover:bg-accent/5 transition-all duration-200 hover:border-accent/30 hover:shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Label className="font-semibold text-foreground">Deodorize & Sanitize</Label>
                    <p className="text-sm text-muted-foreground">Professional-grade deodorizing treatment for fresh-smelling yards</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-accent">+$5</div>
                    <div className="text-xs text-muted-foreground">per visit</div>
                  </div>
                </div>

                {/* Radio buttons for deodorize mode */}
                <div className="space-y-2">
                  {quoteData.frequency === 'onetime' ? (
                    // For one-time services, just show yes/no
                    <>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="deodorize-yes"
                          name="deodorize-mode"
                          checked={quoteData.addOns?.deodorize}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, deodorize: true, deodorizeMode: 'onetime' })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="deodorize-yes" className="text-sm cursor-pointer">
                          Yes (+$25 one-time)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="deodorize-none-onetime"
                          name="deodorize-mode"
                          checked={!quoteData.addOns?.deodorize}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, deodorize: false, deodorizeMode: undefined })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="deodorize-none-onetime" className="text-sm cursor-pointer">
                          No deodorizing
                        </Label>
                      </div>
                    </>
                  ) : (
                    // For recurring services, show frequency options
                    <>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="deodorize-first-visit"
                          name="deodorize-mode"
                          checked={quoteData.addOns?.deodorizeMode === 'first-visit'}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, deodorize: true, deodorizeMode: 'first-visit' })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="deodorize-first-visit" className="text-sm cursor-pointer">
                          First visit only (+$25 one-time)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="deodorize-each-visit"
                          name="deodorize-mode"
                          checked={quoteData.addOns?.deodorizeMode === 'each-visit'}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, deodorize: true, deodorizeMode: 'each-visit' })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="deodorize-each-visit" className="text-sm cursor-pointer">
                          Each visit (+$25 per visit)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="deodorize-every-other"
                          name="deodorize-mode"
                          checked={quoteData.addOns?.deodorizeMode === 'every-other'}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, deodorize: true, deodorizeMode: 'every-other' })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="deodorize-every-other" className="text-sm cursor-pointer">
                          Every other visit (+$12.50 per visit)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="deodorize-none"
                          name="deodorize-mode"
                          checked={!quoteData.addOns?.deodorize}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, deodorize: false, deodorizeMode: undefined })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="deodorize-none" className="text-sm cursor-pointer">
                          No deodorizing
                        </Label>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Spray Deck/Patio Add-on */}
              <div className="p-4 border-2 rounded-lg hover:bg-accent/5 transition-all duration-200 hover:border-accent/30 hover:shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Label className="font-semibold text-foreground">Spray Deck/Patio</Label>
                    <p className="text-sm text-muted-foreground">Spray deck/patio with water and eco-friendly deodorizer for complete odor elimination</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-accent">+$12</div>
                    <div className="text-xs text-muted-foreground">per visit</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {quoteData.frequency === 'onetime' ? (
                    <>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="spray-yes"
                          name="spray-mode"
                          checked={quoteData.addOns?.sprayDeck}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, sprayDeck: true, sprayDeckMode: 'onetime' })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="spray-yes" className="text-sm cursor-pointer">
                          Yes (+$12 one-time)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="spray-none-onetime"
                          name="spray-mode"
                          checked={!quoteData.addOns?.sprayDeck}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, sprayDeck: false, sprayDeckMode: undefined })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="spray-none-onetime" className="text-sm cursor-pointer">
                          No deck/patio spraying
                        </Label>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="spray-first-visit"
                          name="spray-mode"
                          checked={quoteData.addOns?.sprayDeckMode === 'first-visit'}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, sprayDeck: true, sprayDeckMode: 'first-visit' })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="spray-first-visit" className="text-sm cursor-pointer">
                          First visit only (+$12 one-time)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="spray-each-visit"
                          name="spray-mode"
                          checked={quoteData.addOns?.sprayDeckMode === 'each-visit'}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, sprayDeck: true, sprayDeckMode: 'each-visit' })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="spray-each-visit" className="text-sm cursor-pointer">
                          Each visit (+$12 per visit)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="spray-none"
                          name="spray-mode"
                          checked={!quoteData.addOns?.sprayDeck}
                          onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, sprayDeck: false, sprayDeckMode: undefined })}
                          className="text-accent focus:ring-accent"
                        />
                        <Label htmlFor="spray-none" className="text-sm cursor-pointer">
                          No deck/patio spraying
                        </Label>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Divert from Landfill Add-on */}
              <div className="p-4 border-2 rounded-lg hover:bg-accent/5 transition-all duration-200 hover:border-accent/30 hover:shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Label className="font-semibold text-foreground">🌱 Divert from Landfill</Label>
                    <p className="text-sm text-muted-foreground">Eco-friendly waste diversion - track your environmental impact on your dashboard</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">+$1-6 per visit</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="divert-none"
                      name="divert-mode"
                      checked={!quoteData.addOns?.divertMode || quoteData.addOns?.divertMode === 'none'}
                      onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, divertMode: 'none' })}
                      className="text-accent focus:ring-accent"
                    />
                    <Label htmlFor="divert-none" className="text-sm cursor-pointer">
                      Leave in bin
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="divert-takeaway"
                      name="divert-mode"
                      checked={quoteData.addOns?.divertMode === 'takeaway'}
                      onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, divertMode: 'takeaway' })}
                      className="text-accent focus:ring-accent"
                    />
                    <Label htmlFor="divert-takeaway" className="text-sm cursor-pointer">
                      Take away (+$3 per visit)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="divert-25"
                      name="divert-mode"
                      checked={quoteData.addOns?.divertMode === '25'}
                      onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, divertMode: '25' })}
                      className="text-accent focus:ring-accent"
                    />
                    <Label htmlFor="divert-25" className="text-sm cursor-pointer">
                      Take away - divert 25% (+$1 per visit)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="divert-50"
                      name="divert-mode"
                      checked={quoteData.addOns?.divertMode === '50'}
                      onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, divertMode: '50' })}
                      className="text-accent focus:ring-accent"
                    />
                    <Label htmlFor="divert-50" className="text-sm cursor-pointer">
                      Take away - divert 50% (+$2 per visit)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="divert-100"
                      name="divert-mode"
                      checked={quoteData.addOns?.divertMode === '100'}
                      onChange={() => updateQuoteData('addOns', { ...quoteData.addOns, divertMode: '100' })}
                      className="text-accent focus:ring-accent"
                    />
                    <Label htmlFor="divert-100" className="text-sm cursor-pointer">
                      Take away - divert 100% (+$6 per visit)
                    </Label>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-green-50 rounded text-xs text-green-700">
                  💚 Track your environmental impact on your dashboard: lbs diverted, methane avoided, compost created
                </div>
              </div>

            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">🌱 Eco-Friendly Practices Included</p>
                <p className="text-sm text-green-700 mt-1">
                  Biodegradable bags and eco-friendly deodorizing practices included with every service.
                  Premium waste diversion options available to maximize your environmental impact.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="specialInstructions" className="text-base font-medium">Special Instructions (Optional)</Label>
            <Textarea
              id="specialInstructions"
              value={quoteData.specialInstructions || ''}
              onChange={(e) => updateQuoteData('specialInstructions', e.target.value)}
              placeholder="Any special requests, accessibility needs, or preferences for your service..."
              className="mt-2 min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {estimatedPrice && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-accent/10 to-accent-soft/20 rounded-2xl p-6 border border-accent/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Updated Estimate</h3>
              <p className="text-muted text-sm">Including your customizations</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-accent">
                {quoteData.frequency === 'onetime' ? `$${estimatedPrice.oneTime}` : `$${estimatedPrice.perVisit}`}
              </div>
              <div className="text-sm text-muted">
                {quoteData.frequency === 'onetime' ? 'one-time service' : 'per visit'}
              </div>
              <div className="text-sm text-muted">
                {quoteData.frequency === 'onetime'
                  ? 'Includes all services'
                  : `$${estimatedPrice.monthly}/month`
                }
              </div>

              {/* Initial Clean Cost */}
              {estimatedPrice.initialClean && parseFloat(estimatedPrice.initialClean) > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Initial Clean (one-time)</span>
                    <span className="font-medium">${estimatedPrice.initialClean}</span>
                  </div>
                  <button
                    className="text-xs text-accent hover:text-accent/80 underline mt-1"
                    onClick={() => {
                      // Show popover or tooltip with explanation
                      alert('Initial clean is a deeper service to catch up on accumulation since your last cleanup. The price depends on how long it\'s been.');
                    }}
                  >
                    What's this?
                  </button>
                </div>
              )}

              {/* Warning for significant backlog */}
              {estimatedPrice.initialCleanBucket && ['60', '90', '999'].includes(estimatedPrice.initialCleanBucket) && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  <span className="font-medium">Note:</span> Your initial clean may require extra time due to significant accumulation.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StepContact({ quoteData, updateQuoteData, errors }: any) {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-accent" />
            Contact Information
          </CardTitle>
          <p className="text-muted">We'll use this to schedule your service and send updates</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-base font-medium">Full Name *</Label>
              <Input
                id="name"
                value={quoteData.contact?.name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('contact', { ...quoteData.contact, name: e.target.value })}
                placeholder="John Smith"
                className="mt-2"
              />
              {errors.contact && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-red-600 mt-1"
                  data-error="true"
                >
                  {errors.contact.find((e: string) => e.includes('Name')) || ''}
                </motion.p>
              )}
            </div>

            <div>
              <Label htmlFor="phone" className="text-base font-medium">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={quoteData.contact?.phone || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('contact', { ...quoteData.contact, phone: e.target.value })}
                placeholder="(612) 555-0123"
                className="mt-2"
              />
              {errors.contact && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-red-600 mt-1"
                  data-error="true"
                >
                  {errors.contact.find((e: string) => e.includes('Phone')) || ''}
                </motion.p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-base font-medium">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={quoteData.contact?.email || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('contact', { ...quoteData.contact, email: e.target.value })}
              placeholder="john@example.com"
              className="mt-2"
            />
            {errors.contact && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-red-600 mt-1"
                data-error="true"
              >
                {errors.contact.find((e: string) => e.includes('Email')) || ''}
              </motion.p>
            )}
          </div>

          <div>
            <Label htmlFor="schedule" className="text-base font-medium">Preferred Service Day</Label>
            <Select
              value={quoteData.schedulePref?.day}
              onValueChange={(value) => updateQuoteData('schedulePref', { ...quoteData.schedulePref, day: value })}
            >
              <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                <SelectValue placeholder="Select preferred day" />
              </SelectTrigger>
              <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-accent [&_*[data-radix-select-item][data-highlighted]]:text-white">
                <SelectItem value="monday">Monday (Most Popular)</SelectItem>
                <SelectItem value="tuesday">Tuesday</SelectItem>
                <SelectItem value="wednesday">Wednesday</SelectItem>
                <SelectItem value="thursday">Thursday</SelectItem>
                <SelectItem value="friday">Friday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="scheduleTime" className="text-base font-medium">Preferred Time Window</Label>
            <Select
              value={quoteData.schedulePref?.time}
              onValueChange={(value) => updateQuoteData('schedulePref', { ...quoteData.schedulePref, time: value })}
            >
              <SelectTrigger className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
                <SelectValue placeholder="Select preferred time" />
              </SelectTrigger>
              <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-accent [&_*[data-radix-select-item][data-highlighted]]:text-white">
                <SelectItem value="morning">Morning (8am - 12pm)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12pm - 5pm)</SelectItem>
                <SelectItem value="anytime">Anytime (Most Flexible)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepReview({ quoteData, updateQuoteData, errors, estimatedPrice, formProtectionErrors, setRecaptchaToken }: any) {
  const serviceDetails = [
    { label: 'Dogs', value: `${quoteData.dogs} dog${quoteData.dogs > 1 ? 's' : ''}` },
    { label: 'Property Type', value: quoteData.yardSize?.charAt(0).toUpperCase() + quoteData.yardSize?.slice(1) },
    { label: 'Frequency', value: quoteData.frequency?.charAt(0).toUpperCase() + quoteData.frequency?.slice(1) },
    { label: 'Service Address', value: quoteData.address || 'Not provided' },
    { label: 'Preferred Day', value: quoteData.schedulePref?.day || 'Not specified' },
  ];

  const addOns = [];
  if (quoteData.addOns?.deodorize) addOns.push('Enhanced Deodorizing (+$5)');

  return (
    <div className="space-y-6">
      {/* Quote Summary */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-accent/5 to-accent-soft/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-accent" />
            Quote Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estimatedPrice && (
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-accent mb-2">
                {quoteData.frequency === 'onetime' ? `$${estimatedPrice.oneTime}` : `$${estimatedPrice.perVisit}`}
              </div>
              <div className="text-muted">
                {quoteData.frequency === 'onetime' ? 'one-time service' : 'per visit'}
              </div>
              <div className="text-sm text-muted mt-1">
                {quoteData.frequency === 'onetime'
                  ? `$${estimatedPrice.oneTime} one-time`
                  : `$${estimatedPrice.monthly} per month`
                }
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="bg-white/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-lg mb-4">Cost Breakdown</h3>

            {/* One-Time Costs */}
            {(quoteData.frequency === 'onetime' || quoteData.initialClean || (quoteData.premiumOnboarding && quoteData.premiumOnboarding !== 'none')) && (
              <div className="mb-4">
                <h4 className="font-medium text-accent mb-2">One-Time Costs</h4>
                <div className="space-y-1 text-sm">
                  {quoteData.frequency === 'onetime' && (
                    <div className="flex justify-between">
                      <span>Service Fee:</span>
                      <span className="font-medium">${estimatedPrice.perVisit}</span>
                    </div>
                  )}
                  {quoteData.initialClean && (
                    <div className="flex justify-between">
                      <span>Initial Deep Clean:</span>
                      <span className="font-medium">${(estimatedPrice.initialClean / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {quoteData.premiumOnboarding && quoteData.premiumOnboarding !== 'none' && (
                    <div className="flex justify-between">
                      <span>Welcome Package:</span>
                      <span className="font-medium">${((estimatedPrice.premiumOnboarding || 0) / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-1 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total One-Time:</span>
                      <span className="text-accent">${estimatedPrice.oneTime}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recurring Costs */}
            {quoteData.frequency !== 'onetime' && (
              <div className="mb-4">
                <h4 className="font-medium text-accent mb-2">Monthly Recurring</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Base Service:</span>
                    <span className="font-medium">${estimatedPrice.perVisit}/visit</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frequency:</span>
                    <span className="font-medium">{getFrequencyDisplayName(quoteData.frequency)} ({estimatedPrice.visitsPerMonth} visits)</span>
                  </div>
                  <div className="border-t border-gray-200 pt-1 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Monthly Total:</span>
                      <span className="text-accent">${estimatedPrice.monthly}/month</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add-ons */}
            {addOns.length > 0 && (
              <div>
                <h4 className="font-medium text-accent mb-2">Add-on Services</h4>
                <div className="space-y-1 text-sm">
                  {addOns.map((addon) => (
                    <div key={addon} className="flex justify-between">
                      <span>{addon}</span>
                      <span className="font-medium text-accent">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold">Service Details</h3>
              {serviceDetails.map((detail) => (
                <div key={detail.label} className="flex justify-between">
                  <span className="text-muted">{detail.label}:</span>
                  <span className="font-medium">{detail.value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Contact Information</h3>
              <div className="flex justify-between">
                <span className="text-muted">Name:</span>
                <span className="font-medium">{quoteData.contact?.name || 'Not provided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Email:</span>
                <span className="font-medium">{quoteData.contact?.email || 'Not provided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Phone:</span>
                <span className="font-medium">{quoteData.contact?.phone || 'Not provided'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Protection */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5 text-accent" />
            Security Verification
          </CardTitle>
          <p className="text-muted text-sm">
            Complete the security verification to protect your information and prevent spam.
          </p>
        </CardHeader>
        <CardContent>
          <FormProtection
            onVerify={(token) => setRecaptchaToken(token)}
            recaptchaSiteKey={env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
            honeypotName="confirm_email"
          />

          {/* Form Protection Errors */}
          {formProtectionErrors && formProtectionErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Verification Required</p>
                  <ul className="text-sm text-red-700 mt-1">
                    {formProtectionErrors.map((error: string, index: number) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-accent" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted">Name</div>
              <div className="font-medium">{quoteData.contact?.name || 'Not provided'}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Phone</div>
              <div className="font-medium">{quoteData.contact?.phone || 'Not provided'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-muted">Email</div>
              <div className="font-medium">{quoteData.contact?.email || 'Not provided'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms and Consent */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle>Terms & Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={quoteData.consent?.terms}
                onCheckedChange={(checked) => updateQuoteData('consent', { ...quoteData.consent, terms: checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Terms & Privacy Policy *
                </Label>
                <p className="text-xs text-muted">
                  I agree to the terms of service and privacy policy. Data is encrypted and secure.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="stoolPhotosOptIn"
                checked={quoteData.consent?.stoolPhotosOptIn}
                onCheckedChange={(checked) => updateQuoteData('consent', { ...quoteData.consent, stoolPhotosOptIn: checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="stoolPhotosOptIn" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Health Insights (Optional)
                </Label>
                <p className="text-xs text-muted">
                  Allow anonymized photos for AI health analysis. Non-diagnostic, privacy-protected.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="marketingOptIn"
                checked={quoteData.consent?.marketingOptIn}
                onCheckedChange={(checked) => updateQuoteData('consent', { ...quoteData.consent, marketingOptIn: checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="marketingOptIn" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Marketing Communications (Optional)
                </Label>
                <p className="text-xs text-muted">
                  Receive tips, promotions, and yard care advice via email.
                </p>
              </div>
            </div>
          </div>

          {errors.consent && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-red-600"
              data-error="true"
            >
              {errors.consent[0]}
            </motion.p>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200"
      >
        <div className="flex items-start gap-4">
          <div className="size-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Heart className="size-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>✓ Account created with secure login</li>
              <li>✓ Service scheduled based on your preferences</li>
              <li>✓ Welcome email with service details</li>
              <li>✓ First visit confirmation within 24 hours</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}



// Step 5: Premium Onboarding Selection
function StepOnboarding({ quoteData, updateQuoteData, errors, estimatedPrice }: any) {
  const onboardingOptions = getPremiumOnboardingOptions();

  // Separate DNA vs microbiome services (both coming soon)
  const dnaServices = onboardingOptions.filter(option =>
    option.value === 'premium-dna'
  );

  const microbiomeServices = onboardingOptions.filter(option =>
    option.value === 'wellness-microbiome'
  );

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-5 text-accent" />
            Wellness & Health Insights
          </CardTitle>
          <p className="text-muted">All subscriptions include FREE basic wellness insights. Add premium testing options below.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Free Basic Insights Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800">✅ Basic Wellness Insights Included FREE</p>
                <p className="text-sm text-blue-700 mt-1">All subscriptions automatically include non-diagnostic health trend monitoring, 3C's tracking (Color, Consistency, Content), and basic wellness insights - no additional cost required.</p>
              </div>
            </div>
          </div>

          {/* Premium Add-on Options */}
          <div className="text-center mb-4">
            <p className="text-sm text-muted">Optional premium testing for advanced health insights</p>
          </div>

          <RadioGroup
            value={quoteData.premiumOnboarding}
            onValueChange={(value) => updateQuoteData('premiumOnboarding', value)}
            className="space-y-6"
          >
            {/* DNA Testing Services */}
            {dnaServices.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"></div>
                  <Label className="text-base font-medium text-blue-800">Genetic Health Testing</Label>
                </div>
                <div className="grid gap-3">
                  {dnaServices.map((option) => (
                    <div key={option.value} className={`flex items-start space-x-3 p-4 border-2 rounded-lg transition-all duration-200 bg-gradient-to-r from-gray-50/30 to-gray-100/20 border-gray-200 ${option.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-50/50 hover:border-blue-300 hover:shadow-sm'}`}>
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-1"
                        disabled={option.disabled}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={option.value} className={`font-medium ${option.disabled ? 'cursor-not-allowed text-gray-500' : 'cursor-pointer text-blue-900'}`}>
                            {option.label}
                          </Label>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-500">Coming Soon</div>
                          </div>
                        </div>
                        <p className={`text-sm mt-1 ${option.disabled ? 'text-gray-500' : 'text-blue-700'}`}>
                          {option.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Microbiome Services */}
            {microbiomeServices.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-teal-500 rounded-full"></div>
                  <Label className="text-base font-medium text-teal-800">Gut Health Analysis</Label>
                </div>
                <div className="grid gap-3">
                  {microbiomeServices.map((option) => (
                    <div key={option.value} className={`flex items-start space-x-3 p-4 border-2 rounded-lg transition-all duration-200 bg-gradient-to-r from-gray-50/30 to-gray-100/20 border-gray-200 ${option.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-teal-50/50 hover:border-teal-300 hover:shadow-sm'}`}>
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-1"
                        disabled={option.disabled}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={option.value} className={`font-medium ${option.disabled ? 'cursor-not-allowed text-gray-500' : 'cursor-pointer text-teal-900'}`}>
                            {option.label}
                          </Label>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-500">Coming Soon</div>
                          </div>
                        </div>
                        <p className={`text-sm mt-1 ${option.disabled ? 'text-gray-500' : 'text-teal-700'}`}>
                          {option.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </RadioGroup>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">Coming Soon Features</p>
                <p className="text-sm text-amber-700 mt-1">These premium health testing options will be available soon. You'll be notified when they launch, and we'll help you get started with your pet's health journey.</p>
              </div>
            </div>
          </div>

          {/* Service Summary */}
          {quoteData.premiumOnboarding && quoteData.premiumOnboarding !== 'none' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-r from-accent/10 to-accent-soft/20 rounded-2xl p-6 border border-accent/20"
            >
              <div className="text-sm text-muted">Welcome Package Investment</div>
              <div className="text-2xl font-bold text-accent">
                ${((onboardingOptions.find(opt => opt.value === quoteData.premiumOnboarding)?.price || 0) / 100).toFixed(2)}
              </div>
              <div className="text-xs text-muted">
                Ships after your first visit
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}





// Step 4.5: Wellness & Health Step (DoodyCalls inspired - simple, clean UI)
function StepWellness({ quoteData, updateQuoteData, errors, onNext }: any) {
  const handleWellnessChoice = (choice: 'basic' | 'premium-dna' | 'wellness-microbiome' | 'none') => {
    updateQuoteData('premiumOnboarding', choice);
    track('wellness_choice_selected', { choice });
    onNext();
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-5 text-teal-600" />
            Wellness & Health Insights
          </CardTitle>
          <p className="text-muted">
            Get valuable insights about your dog's health and wellness through our stool analysis.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Insights (Included) */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="cursor-pointer border-2 border-teal-200 bg-teal-50/50 hover:border-teal-300 transition-all duration-200"
              onClick={() => handleWellnessChoice('basic')}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Star className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">Basic Wellness Insights</h3>
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                        FREE - Included
                      </span>
                    </div>
                    <p className="text-muted mb-3">
                      Get simple, non-diagnostic insights about your dog's stool health including consistency, color, and basic wellness indicators.
                    </p>
                    <ul className="text-sm text-muted space-y-1">
                      <li>• Stool consistency analysis</li>
                      <li>• Color and texture observations</li>
                      <li>• Basic wellness trend tracking</li>
                      <li>• Monthly health summary</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Premium DNA Testing */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="cursor-pointer border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
              onClick={() => handleWellnessChoice('premium-dna')}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">Premium DNA Testing</h3>
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-muted mb-3">
                      Advanced genetic testing for breed identification, health predispositions, and ancestry information.
                    </p>
                    <ul className="text-sm text-muted space-y-1 opacity-60">
                      <li>• Complete breed breakdown</li>
                      <li>• Health predisposition insights</li>
                      <li>• Ancestry and lineage analysis</li>
                      <li>• Genetic health markers</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Microbiome Analysis */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="cursor-pointer border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
              onClick={() => handleWellnessChoice('wellness-microbiome')}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">Gut Microbiome Analysis</h3>
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-muted mb-3">
                      Comprehensive analysis of your dog's gut microbiome for digestive health and nutritional insights.
                    </p>
                    <ul className="text-sm text-muted space-y-1 opacity-60">
                      <li>• Microbiome diversity analysis</li>
                      <li>• Digestive health indicators</li>
                      <li>• Nutritional recommendations</li>
                      <li>• Long-term health trends</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Skip Option */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="cursor-pointer border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
              onClick={() => handleWellnessChoice('none')}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Skip Wellness Features</h3>
                    <p className="text-muted">
                      Continue with standard service without wellness insights.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Trust Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Privacy & Safety</p>
                <p className="text-xs text-blue-700">
                  All wellness insights are non-diagnostic and for informational purposes only.
                  We never share your data with third parties without explicit consent.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Step 5.5: Commercial Contact Step
function StepCommercialContact({ quoteData, updateQuoteData, errors, estimatedPrice }: any) {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="size-5 text-accent" />
            Commercial Property Contact
          </CardTitle>
          <p className="text-muted">Provide your contact details for a personalized commercial quote</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800">Custom Commercial Quote</p>
                <p className="text-sm text-blue-700 mt-1">Commercial properties require personalized pricing based on property size, usage patterns, and specific needs. We'll contact you within 24 hours with a detailed quote.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactName" className="text-base font-medium">Contact Name *</Label>
              <Input
                id="contactName"
                type="text"
                value={quoteData.contact?.name || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, name: e.target.value })}
                placeholder="Your full name"
                className="mt-2"
              />
              {errors.contact?.name && (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-red-600 mt-1">
                  {errors.contact.name[0]}
                </motion.p>
              )}
            </div>

            <div>
              <Label htmlFor="contactTitle" className="text-base font-medium">Job Title</Label>
              <Input
                id="contactTitle"
                type="text"
                value={quoteData.contact?.title || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, title: e.target.value })}
                placeholder="Property manager, owner, etc."
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactEmail" className="text-base font-medium">Email Address *</Label>
              <Input
                id="contactEmail"
                type="email"
                value={quoteData.contact?.email || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, email: e.target.value })}
                placeholder="your@email.com"
                className="mt-2"
              />
              {errors.contact?.email && (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-red-600 mt-1">
                  {errors.contact.email[0]}
                </motion.p>
              )}
            </div>

            <div>
              <Label htmlFor="contactPhone" className="text-base font-medium">Phone Number *</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={quoteData.contact?.phone || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="mt-2"
              />
              {errors.contact?.phone && (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-red-600 mt-1">
                  {errors.contact.phone[0]}
                </motion.p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="commercialNotes" className="text-base font-medium">Additional Details</Label>
            <Textarea
              id="commercialNotes"
              value={quoteData.commercialNotes || ''}
              onChange={(e) => updateQuoteData('commercialNotes', e.target.value)}
              placeholder="Tell us about your property - number of units, daily usage, special requirements, etc."
              className="mt-2 min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Step 1: Zip Code Check (DoodyCalls inspired)
function StepZipCheck({ quoteData, updateQuoteData, errors, onNext }: any) {
  const [zipCode, setZipCode] = useState(quoteData.zipCode || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    location?: string;
  } | null>(null);

  // Twin Cities service area zip codes
  const SERVICE_AREA_ZIPS = [
    '55401', '55402', '55403', '55404', '55405', '55406', '55407', '55408', '55409', '55410',
    '55411', '55412', '55413', '55414', '55415', '55416', '55417', '55418', '55419', '55420',
    '55421', '55422', '55423', '55424', '55425', '55426', '55427', '55428', '55429', '55430',
    '55111', '55116', '55117', '55118', '55119', '55120', '55121', '55122', '55123', '55124',
    '55305', '55306', '55337', '55343', '55344', '55345', '55346', '55347', '55356', '55369',
    '55391', '55431', '55432', '55433', '55434', '55435', '55436', '55437', '55438', '55439',
    '55441', '55442', '55443', '55444', '55445', '55446', '55447', '55448', '55449', '55450'
  ];

  const validateZipCode = async () => {
    if (!zipCode.trim()) {
      setValidationResult({ valid: false, message: 'Please enter a zip code' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const isInServiceArea = SERVICE_AREA_ZIPS.includes(zipCode.trim());

    if (isInServiceArea) {
      setValidationResult({
        valid: true,
        message: 'Great! We service your area.',
        location: 'Twin Cities Metro'
      });
      updateQuoteData('zipCode', zipCode.trim());
      track('zip_check', { zip: zipCode, inArea: true, location: 'Twin Cities Metro' });
    } else {
      setValidationResult({
        valid: false,
        message: 'We\'re not in your area yet, but we\'re expanding! Would you like to join our waitlist?',
        location: 'Outside Service Area'
      });
      track('zip_check', { zip: zipCode, inArea: false, location: 'Outside Service Area' });
    }

    setIsValidating(false);
  };

  const handleContinue = () => {
    if (validationResult?.valid) {
      updateQuoteData('zipCode', zipCode.trim());
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-accent" />
            Service Area Check
          </CardTitle>
          <p className="text-muted">
            Let's make sure we can provide service in your area. Enter your zip code below.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Location Display */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-accent">Twin Cities Metro Area</p>
                <p className="text-sm text-muted">Minnesota</p>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Serving Minneapolis, Richfield, Edina, Bloomington, and surrounding areas
            </p>
          </div>

          {/* Zip Code Input */}
          <div>
            <Label htmlFor="zipCode" className="text-base font-medium">Zip Code *</Label>
            <div className="flex gap-3 mt-2">
              <Input
                id="zipCode"
                type="text"
                placeholder="55401"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="flex-1 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
                maxLength={5}
              />
              <Button
                onClick={validateZipCode}
                disabled={!zipCode.trim() || isValidating}
                className="px-6"
              >
                {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
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
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  validationResult.valid ? 'bg-green-500' : 'bg-yellow-500'
                }`}>
                  {validationResult.valid ? (
                    <CheckCircle className="w-3 h-3 text-white" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{validationResult.message}</p>
                  {validationResult.location && (
                    <p className="text-sm mt-1 opacity-80">{validationResult.location}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Trust Signals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {TRUST_SIGNALS.map((signal, index) => (
              <div key={index} className="text-center p-4 bg-white/50 rounded-lg border border-gray-100">
                <signal.icon className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="font-medium text-sm">{signal.text}</p>
                <p className="text-xs text-muted mt-1">{signal.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={!validationResult?.valid}
          className="px-8 py-3"
          size="lg"
        >
          Continue to Service Type
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Step 3: Service Frequency Selection (DoodyCalls inspired)
function StepFrequency({ quoteData, updateQuoteData, errors, estimatedPrice }: any) {
  // Use the same options from priceEstimator for consistency
  const serviceTypeOptions = getServiceTypeOptions();

  const frequencyOptions = serviceTypeOptions.map(option => ({
    id: option.value,
    title: option.label,
    subtitle: option.isPopular ? 'Most Popular' : option.description.split(' - ')[0] || '',
    visits: option.description,
    description: option.description,
    icon: option.value === 'weekly' ? '📅' :
          option.value === 'biweekly' ? '📆' :
          option.value === 'twice-weekly' ? '⚡' :
          option.value === 'monthly' ? '📊' :
          option.value === 'onetime' ? '🧹' : '📅',
    popular: option.isPopular || false
  }));

  const handleFrequencySelect = (frequency: string) => {
    updateQuoteData('frequency', frequency);
    track('frequency_selected', { frequency, estimatedPrice });
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-accent" />
            Service Frequency
          </CardTitle>
          <p className="text-muted">
            How often do you need service? We'll match your needs with the right frequency.
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
                      ? 'border-accent bg-accent/8 shadow-md'
                      : 'border-gray-200 hover:border-accent/60'
                  }`}
                  onClick={() => handleFrequencySelect(option.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">{option.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base">{option.title}</h3>
                            {option.popular && (
                              <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                Most Popular
                              </span>
                            )}
                          </div>
                          <p className="text-muted text-xs">{option.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {quoteData.frequency === option.id && (
                          <CheckCircle className="w-5 h-5 text-accent" />
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
      {estimatedPrice && quoteData.frequency && quoteData.frequency !== 'onetime' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-accent/10 to-accent/5 border-2 border-accent/30 rounded-xl p-6 text-center shadow-lg"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <p className="text-sm font-medium text-accent">Estimated Monthly Cost</p>
            <div className="w-2 h-2 bg-accent rounded-full"></div>
          </div>
          <p className="text-3xl font-bold text-accent mb-1">
            ${estimatedPrice.monthly}
          </p>
          <p className="text-sm text-muted">
            {estimatedPrice.visitsPerMonth} visits per month • Best value for consistent service
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Step 2: Service Type Selection (DoodyCalls inspired)
function StepServiceType({ quoteData, updateQuoteData, onNext }: any) {
  const handleServiceTypeSelect = (serviceType: 'residential' | 'commercial') => {
    updateQuoteData('serviceType', serviceType);
    track('service_type_selected', { serviceType });
    onNext();
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="size-5 text-accent" />
            Service Type
          </CardTitle>
          <p className="text-muted">
            What type of service do you need?
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Residential Service */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="cursor-pointer border-2 hover:border-accent transition-all duration-200 hover:shadow-lg"
                onClick={() => handleServiceTypeSelect('residential')}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Home className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Residential</h3>
                  <p className="text-muted text-sm">
                    We clean up after your dog in your own yard. Perfect for homes and apartments.
                  </p>
                  <div className="mt-4 text-xs text-muted">
                    Most popular choice
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Commercial Service */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="cursor-pointer border-2 hover:border-accent transition-all duration-200 hover:shadow-lg"
                onClick={() => handleServiceTypeSelect('commercial')}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Community</h3>
                  <p className="text-muted text-sm">
                    Pet waste stations and common-area cleanup for HOAs, apartments, and businesses.
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

// Step 5: Combined Contact & Review (Final Step)
function StepContactReview({ quoteData, updateQuoteData, errors, estimatedPrice, formProtectionErrors, setRecaptchaToken }: any) {
  // Add-ons information
  const addOns = [];
  if (quoteData.addOns?.deodorize) {
    addOns.push('Enhanced Deodorizing (+$5)');
  }
  const addOnsText = addOns.length > 0 ? addOns.join(', ') : 'None';

  // Areas to clean information
  const areasToClean = [];
  if (quoteData.areasToClean) {
    if (quoteData.areasToClean.frontYard) areasToClean.push('Front Yard');
    if (quoteData.areasToClean.backYard) areasToClean.push('Back Yard');
    if (quoteData.areasToClean.sideYard) areasToClean.push('Side Yard');
    if (quoteData.areasToClean.dogRun) areasToClean.push('Dog Run');
    if (quoteData.areasToClean.fencedArea) areasToClean.push('Fenced Area');
    if (quoteData.areasToClean.other) areasToClean.push(quoteData.areasToClean.other);
  }
  const areasText = areasToClean.length > 0 ? areasToClean.join(', ') : 'Standard areas';

  const serviceDetails = [
    { label: 'Dogs', value: `${quoteData.dogs} dog${quoteData.dogs > 1 ? 's' : ''}` },
    { label: 'Property Type', value: quoteData.yardSize?.charAt(0).toUpperCase() + quoteData.yardSize?.slice(1) },
    { label: 'Service Type', value: getFrequencyDisplayName(quoteData.frequency) },
    { label: 'Areas to Clean', value: areasText },
    { label: 'Add-ons', value: addOnsText },
    { label: 'Service Address', value: quoteData.address || 'Not provided' },
  ];

  // Additional details for summary
  const additionalDetails = [
    quoteData.howDidYouHear && { label: 'How did you hear about us?', value: quoteData.howDidYouHear.replace(/([A-Z])/g, ' $1').toLowerCase() },
    quoteData.specialInstructions && { label: 'Special Instructions', value: quoteData.specialInstructions },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Service Address */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-accent" />
            Service Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddressAutocomplete
            value={quoteData.address || ''}
            onSelect={(data) => {
              updateQuoteData('address', data.formattedAddress);
              updateQuoteData('addressMeta', data);
              updateQuoteData('addressValidated', true);
            }}
            onChange={(value) => updateQuoteData('address', value)}
            placeholder="Enter your complete service address"
          />
          {errors.address && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-red-600 mt-2"
              data-error="true"
            >
              {errors.address[0]}
            </motion.p>
          )}
        </CardContent>
      </Card>

      {/* Error display for preferred start date */}
      {errors.preferredStartDate && (
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm text-red-600"
          data-error="true"
        >
          {errors.preferredStartDate[0]}
        </motion.p>
      )}

      {/* Error display for preferred contact methods */}
      {errors.preferredContactMethods && (
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm text-red-600"
          data-error="true"
        >
          {errors.preferredContactMethods[0]}
        </motion.p>
      )}

      {/* Preferred Start Date */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5 text-accent" />
            Preferred Start Date
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">Select your preferred start date</p>
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
                  formatted: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                  value: date.toISOString().split('T')[0]
                });
              }
              return dates.map((dateOption, index) => (
                <label key={index} className={`cursor-pointer border-2 rounded-lg p-3 transition-all duration-200 ${
                  quoteData.preferredStartDate === dateOption.value
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-gray-200 hover:border-teal-300'
                }`}>
                  <input
                    type="radio"
                    name="preferredStartDate"
                    value={dateOption.value}
                    checked={quoteData.preferredStartDate === dateOption.value}
                    onChange={(e) => updateQuoteData('preferredStartDate', e.target.value)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className="font-medium">{dateOption.formatted}</div>
                  </div>
                </label>
              ));
            })()}
          </div>

          {/* Date picker for other dates */}
          <div>
            <Label htmlFor="customStartDate" className="text-sm font-medium">Or select another date</Label>
            <Input
              id="customStartDate"
              type="date"
              value={quoteData.customStartDate || ''}
              onChange={(e) => {
                updateQuoteData('customStartDate', e.target.value);
                updateQuoteData('preferredStartDate', e.target.value);
              }}
              className="mt-2 bg-white border-2 border-gray-200 hover:border-teal-300 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none"
              min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Minimum tomorrow
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5 text-accent" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactName" className="text-sm font-medium">Full Name *</Label>
              <Input
                id="contactName"
                type="text"
                value={quoteData.contact?.name || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, name: e.target.value })}
                placeholder="Enter your full name"
                className="mt-1"
                required
              />
              {errors.contact && errors.contact.some((err: string) => err.includes('name')) && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-red-600 mt-1"
                  data-error="true"
                >
                  {errors.contact.find((err: string) => err.includes('name'))}
                </motion.p>
              )}
            </div>
            <div>
              <Label htmlFor="contactPhone" className="text-sm font-medium">Phone Number *</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={quoteData.contact?.phone || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="mt-1"
                required
              />
              {errors.contact && errors.contact.some((err: string) => err.includes('phone')) && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-red-600 mt-1"
                  data-error="true"
                >
                  {errors.contact.find((err: string) => err.includes('phone'))}
                </motion.p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="contactEmail" className="text-sm font-medium">Email Address *</Label>
            <Input
              id="contactEmail"
              type="email"
              value={quoteData.contact?.email || ''}
              onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, email: e.target.value })}
              placeholder="your.email@example.com"
              className="mt-1"
              required
            />
            {errors.contact && errors.contact.some((err: string) => err.includes('email')) && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-red-600 mt-1"
                data-error="true"
              >
                {errors.contact.find((err: string) => err.includes('email'))}
              </motion.p>
            )}
          </div>

          {/* Preferred Contact Method */}
          <div>
            <Label className="text-base font-medium">Preferred contact method <span className="text-red-500">*</span></Label>
            <p className="text-sm text-muted mb-4">Select all that apply</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'text', label: 'Text', icon: '📱' },
                { id: 'mobile', label: 'Mobile', icon: '📞' },
                { id: 'email', label: 'Email', icon: '✉️' }
              ].map((method) => (
                <label key={method.id} className={`cursor-pointer border-2 rounded-lg p-4 transition-all duration-200 ${
                  quoteData.preferredContactMethods?.includes(method.id)
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-gray-200 hover:border-teal-300'
                }`}>
                  <input
                    type="checkbox"
                    name="preferredContactMethods"
                    value={method.id}
                    checked={quoteData.preferredContactMethods?.includes(method.id) || false}
                    onChange={(e) => {
                      const current = quoteData.preferredContactMethods || [];
                      const updated = e.target.checked
                        ? [...current, method.id]
                        : current.filter((m: string) => m !== method.id);
                      updateQuoteData('preferredContactMethods', updated);
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
            {quoteData.preferredContactMethods?.includes('text') && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quoteData.smsConsent || false}
                    onChange={(e) => updateQuoteData('smsConsent', e.target.checked)}
                    className="mt-1 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-blue-800">
                    Send SMS updates about my service to this number. (Additional carrier rates may apply)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* How did you hear about us? */}
          <div>
            <Label htmlFor="howDidYouHear" className="text-base font-medium">How did you hear about us?</Label>
            <p className="text-sm text-muted mt-1 mb-3">
              Help us understand how you found Yardura
            </p>
            <Select
              value={quoteData.howDidYouHear || ''}
              onValueChange={(value) => updateQuoteData('howDidYouHear', value)}
            >
              <SelectTrigger className="bg-white border-2 border-gray-200 hover:border-teal-300 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none">
                <SelectValue placeholder="Select how you found us" />
              </SelectTrigger>
              <SelectContent className="[&_*[data-radix-select-item]]:text-gray-900 [&_*[data-radix-select-item][data-highlighted]]:bg-teal-500 [&_*[data-radix-select-item][data-highlighted]]:text-white">
                <SelectItem value="social-media">Social Media</SelectItem>
                <SelectItem value="referral-business">Referral - Business</SelectItem>
                <SelectItem value="referral-family">Referral - Family/Friend</SelectItem>
                <SelectItem value="yard-sign">Yard Sign</SelectItem>
                <SelectItem value="search-engine">Search Engine</SelectItem>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="direct-mail">Direct Mail</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Service Summary */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-accent/5 to-accent-soft/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-accent" />
            Service Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estimatedPrice && (
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-accent mb-2">
                {quoteData.frequency === 'onetime' ? `$${estimatedPrice.oneTime}` : `$${estimatedPrice.monthly}/month`}
              </div>
              <div className="text-muted">
                {quoteData.frequency === 'onetime' ? 'One-time deep clean' : `${estimatedPrice.visitsPerMonth} visits per month`}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold">Service Details</h3>
              {serviceDetails.map((detail) => (
                <div key={detail.label} className="flex justify-between">
                  <span className="text-muted">{detail.label}:</span>
                  <span className="font-medium">{detail.value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Contact Preferences</h3>
              <div className="flex justify-between">
                <span className="text-muted">Preferred methods:</span>
                <span className="font-medium">{quoteData.preferredContactMethods?.join(', ') || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Start date:</span>
                <span className="font-medium">{quoteData.preferredStartDate ? new Date(quoteData.preferredStartDate).toLocaleDateString() : 'Not selected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">How heard:</span>
                <span className="font-medium">{quoteData.howDidYouHear || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          {additionalDetails.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Additional Details</h3>
              <div className="space-y-2">
                {additionalDetails.map((detail: any) => (
                  <div key={detail.label} className="flex justify-between">
                    <span className="text-muted text-sm">{detail.label}:</span>
                    <span className="font-medium text-sm">{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Form */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-accent" />
            Contact Information
          </CardTitle>
          <p className="text-muted text-sm">
            Please provide your contact details so we can prepare your personalized quote
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={quoteData.contact?.name || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, name: e.target.value })}
                className={errors.contact ? 'border-red-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={quoteData.contact?.phone || ''}
                onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, phone: e.target.value })}
                className={errors.contact ? 'border-red-500' : ''}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={quoteData.contact?.email || ''}
              onChange={(e) => updateQuoteData('contact', { ...quoteData.contact, email: e.target.value })}
              className={errors.contact ? 'border-red-500' : ''}
            />
          </div>

          {/* Display errors */}
          {errors.contact && (
            <div className="text-sm text-red-600 space-y-1">
              {errors.contact.map((error: string, index: number) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Protection */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5 text-accent" />
            Security Verification
          </CardTitle>
          <p className="text-muted text-sm">
            Complete the security verification to protect your information and prevent spam.
          </p>
        </CardHeader>
        <CardContent>
          <FormProtection
            onVerify={(token) => setRecaptchaToken(token)}
            recaptchaSiteKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''}
            honeypotName="confirm_email"
          />

          {/* Form Protection Errors */}
          {formProtectionErrors && formProtectionErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Verification Required</p>
                  <ul className="text-sm text-red-700 mt-1">
                    {formProtectionErrors.map((error: string, index: number) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuotePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-white via-accent-soft/10 to-accent-soft/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">Loading your enhanced quote experience...</p>
        </div>
      </div>
    }>
      <QuotePageClient />
    </Suspense>
  );
}