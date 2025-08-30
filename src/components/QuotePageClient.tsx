"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Calculator, CheckCircle, Phone, Mail, MapPin, Clock, Loader2 } from "lucide-react";
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
  formatPrice
} from "@/lib/priceEstimator";

const STEPS = [
  { id: 'basics', title: 'Service Details', description: 'Tell us about your property' },
  { id: 'contact', title: 'Contact Info', description: 'How can we reach you?' },
  { id: 'account', title: 'Create Account', description: 'Secure your quote' }
];

function QuotePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { prefersReducedMotion } = useReducedMotionSafe();
  const { data: session, status } = useSession();

  const [currentStep, setCurrentStep] = useState(0);
  const [quoteData, setQuoteData] = useState<Partial<QuoteInput>>({
    dogs: 1,
    frequency: 'weekly',
    addOns: {},
    consent: { stoolPhotosOptIn: false, terms: false }
  });
  const [errors, setErrors] = useState<Partial<Record<keyof QuoteInput | 'auth', string[]>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<any>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Update price estimate when relevant data changes
  useEffect(() => {
    if (quoteData.dogs && quoteData.yardSize && quoteData.frequency) {
      const price = calculatePrice({
        dogs: quoteData.dogs,
        yardSize: quoteData.yardSize,
        frequency: quoteData.frequency,
        addons: quoteData.addOns
      });
      setEstimatedPrice(price.breakdown);
    }
  }, [quoteData.dogs, quoteData.yardSize, quoteData.frequency, quoteData.addOns]);

  // Load quote data from localStorage if resuming
  useEffect(() => {
    const resume = searchParams.get('resume');
    if (resume === '1') {
      const savedQuote = localStorage.getItem('yardura_pending_quote');
      if (savedQuote) {
        try {
          const parsedQuote = JSON.parse(savedQuote);
          setQuoteData(parsedQuote);
          // If user has basic info, skip to step 2 (contact)
          if (parsedQuote.dogs && parsedQuote.yardSize && parsedQuote.frequency) {
            setCurrentStep(1);
          }
        } catch (error) {
          console.error('Error loading saved quote:', error);
        }
      }
    }
  }, [searchParams]);

  // Save quote data to localStorage
  useEffect(() => {
    if (quoteData.dogs || quoteData.yardSize || quoteData.frequency) {
      localStorage.setItem('yardura_pending_quote', JSON.stringify(quoteData));
    }
  }, [quoteData]);

  // Handle authentication flow
  const handleSignIn = async (provider?: string) => {
    setIsSigningIn(true);
    try {
      if (provider) {
        await signIn(provider, { callbackUrl: window.location.href });
      } else {
        // Email magic link
        const email = quoteData.contact?.email;
        if (!email) {
          setErrors({ auth: ['Please enter your email first'] });
          return;
        }
        await signIn('email', { email, callbackUrl: window.location.href });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setErrors({ auth: ['Sign in failed. Please try again.'] });
    } finally {
      setIsSigningIn(false);
    }
  };

  // Track step changes
  useEffect(() => {
    track('quote_step_view', { step: currentStep + 1, step_name: STEPS[currentStep].id });
  }, [currentStep]);

  const updateQuoteData = (field: keyof QuoteInput, value: any) => {
    setQuoteData((prev: Partial<QuoteInput>) => ({ ...prev, [field]: value }));
    // Clear errors for this field
    if (errors[field]) {
      setErrors((prev: Partial<Record<keyof QuoteInput, string[]>>) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleNext = async () => {
    // Basic validation
    const newErrors: Record<string, string[]> = {};

    if (currentStep === 0) {
      if (!quoteData.dogs) newErrors.dogs = ['Please select number of dogs'];
      if (!quoteData.yardSize) newErrors.yardSize = ['Please select yard size'];
      if (!quoteData.frequency) newErrors.frequency = ['Please select service frequency'];
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Final validation
    const newErrors: Record<string, string[]> = {};

    if (!quoteData.contact?.name) newErrors.contact = ['Name is required'];
    if (!quoteData.contact?.email) newErrors.contact = [...(newErrors.contact || []), 'Email is required'];
    if (!quoteData.contact?.phone) newErrors.contact = [...(newErrors.contact || []), 'Phone is required'];
    if (!quoteData.consent?.terms) newErrors.consent = ['You must accept the terms'];

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Track conversion
      track('quote_complete', {
        dogs: quoteData.dogs,
        yard_size: quoteData.yardSize,
        frequency: quoteData.frequency,
        estimated_price: estimatedPrice?.total
      });

      // Simulate account creation
      await new Promise(resolve => setTimeout(resolve, 2000));

      router.push('/quote/success');
    } catch (error) {
      console.error('Quote submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'basics':
        return <StepBasics quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} />;
      case 'contact':
        return <StepContact quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} />;
      case 'account':
        return <StepAccount quoteData={quoteData} updateQuoteData={updateQuoteData} errors={errors} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20 flex flex-col items-center justify-center py-12 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-accent rounded-xl flex items-center justify-center">
              <Calculator className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Get Your Quote</h1>
              <p className="text-sm text-muted">Step {currentStep + 1} of {STEPS.length}</p>
            </div>
          </div>

          {/* Price Estimate */}
          {estimatedPrice && (
            <div className="text-right">
              <div className="text-sm text-muted">Estimated</div>
              <div className="text-xl font-bold text-accent">
                ${estimatedPrice.total}/visit
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-accent-soft rounded-full h-2 mb-8">
          <motion.div
            className="bg-accent h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="w-full max-w-2xl mt-8 flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {currentStep === STEPS.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90"
          >
            {isSubmitting ? 'Creating Account...' : 'Complete Quote'}
            <CheckCircle className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90"
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Step Components
function StepBasics({ quoteData, updateQuoteData, errors }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="dogs">Number of Dogs</Label>
          <Select value={quoteData.dogs?.toString()} onValueChange={(value) => updateQuoteData('dogs', parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Select number of dogs" />
            </SelectTrigger>
            <SelectContent>
              {[1,2,3,4].map(num => (
                <SelectItem key={num} value={num.toString()}>{num} dog{num > 1 ? 's' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.dogs && <p className="text-sm text-red-600 mt-1">{errors.dogs[0]}</p>}
        </div>

        <div>
          <Label htmlFor="yardSize">Yard Size</Label>
          <Select value={quoteData.yardSize} onValueChange={(value) => updateQuoteData('yardSize', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select yard size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small (&lt; 2,500 sq ft)</SelectItem>
              <SelectItem value="medium">Medium (2,500-5,000 sq ft)</SelectItem>
              <SelectItem value="large">Large (5,000-10,000 sq ft)</SelectItem>
              <SelectItem value="xl">XL (&gt; 10,000 sq ft)</SelectItem>
            </SelectContent>
          </Select>
          {errors.yardSize && <p className="text-sm text-red-600 mt-1">{errors.yardSize[0]}</p>}
        </div>

        <div>
          <Label>Service Frequency</Label>
          <RadioGroup
            value={quoteData.frequency}
            onValueChange={(value) => updateQuoteData('frequency', value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekly" id="weekly" />
              <Label htmlFor="weekly">Weekly Service</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="biweekly" id="biweekly" />
              <Label htmlFor="biweekly">Bi-weekly Service (5% discount)</Label>
            </div>
          </RadioGroup>
          {errors.frequency && <p className="text-sm text-red-600 mt-1">{errors.frequency[0]}</p>}
        </div>

        <div>
          <Label>Add-on Services</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="deodorize"
                checked={quoteData.addons?.deodorize}
                onCheckedChange={(checked) => updateQuoteData('addons', { ...quoteData.addons, deodorize: checked })}
              />
              <Label htmlFor="deodorize">Deodorize & Sanitize (+$15)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="litterBox"
                checked={quoteData.addons?.litterBox}
                onCheckedChange={(checked) => updateQuoteData('addons', { ...quoteData.addons, litterBox: checked })}
              />
              <Label htmlFor="litterBox">Litter Box Service (+$10)</Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StepContact({ quoteData, updateQuoteData, errors }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={quoteData.contact?.name || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('contact', { ...quoteData.contact, name: e.target.value })}
            placeholder="John Smith"
          />
          {errors.contact && <p className="text-sm text-red-600 mt-1">{errors.contact.find(e => e.includes('Name')) || ''}</p>}
        </div>

        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={quoteData.contact?.email || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('contact', { ...quoteData.contact, email: e.target.value })}
            placeholder="john@example.com"
          />
          {errors.contact && <p className="text-sm text-red-600 mt-1">{errors.contact.find(e => e.includes('Email')) || ''}</p>}
        </div>

        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={quoteData.contact?.phone || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('contact', { ...quoteData.contact, phone: e.target.value })}
            placeholder="(612) 555-0123"
          />
          {errors.contact && <p className="text-sm text-red-600 mt-1">{errors.contact.find(e => e.includes('Phone')) || ''}</p>}
        </div>

        <div>
          <Label htmlFor="address">Service Address</Label>
          <Input
            id="address"
            value={quoteData.address || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuoteData('address', e.target.value)}
            placeholder="123 Main St, Minneapolis, MN"
          />
        </div>

        <div>
          <Label htmlFor="schedule">Preferred Service Day</Label>
          <Select value={quoteData.schedulePref?.day} onValueChange={(value) => updateQuoteData('schedulePref', { ...quoteData.schedulePref, day: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select preferred day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monday">Monday</SelectItem>
              <SelectItem value="tuesday">Tuesday</SelectItem>
              <SelectItem value="wednesday">Wednesday</SelectItem>
              <SelectItem value="thursday">Thursday</SelectItem>
              <SelectItem value="friday">Friday</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function StepAccount({ quoteData, updateQuoteData, errors }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your Account</CardTitle>
        <p className="text-sm text-muted">Secure your quote and manage your service online.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 mt-0.5">
              <svg className="size-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <p className="font-medium text-blue-900">Passwordless Login</p>
              <p className="text-blue-700">We'll send a secure link to your email for easy access.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="stoolPhotosOptIn"
              checked={quoteData.consent?.stoolPhotosOptIn}
              onCheckedChange={(checked) => updateQuoteData('consent', { ...quoteData.consent, stoolPhotosOptIn: checked })}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="stoolPhotosOptIn" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Health Insights Photos (Optional)
              </Label>
              <p className="text-xs text-muted">
                Allow anonymized photos of waste for AI health analysis. Non-diagnostic, privacy-protected.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={quoteData.consent?.terms}
              onCheckedChange={(checked) => updateQuoteData('consent', { ...quoteData.consent, terms: checked })}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Terms & Privacy Policy
              </Label>
              <p className="text-xs text-muted">
                I agree to the terms of service and privacy policy. Data is encrypted and secure.
              </p>
            </div>
          </div>
          {errors.consent && <p className="text-sm text-red-600 mt-1">{errors.consent[0]}</p>}
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="size-5 text-green-600" />
            <div className="text-sm">
              <p className="font-medium text-green-900">What happens next?</p>
              <p className="text-green-700">Account created → Quote confirmed → Service scheduled → Welcome email</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function QuotePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">Loading your quote...</p>
        </div>
      </div>
    }>
      <QuotePageClient />
    </Suspense>
  );
}
