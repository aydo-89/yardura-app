'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import { CheckCircle, CreditCard, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LeadData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceType: string;
  dogs: number;
  yardSize: string;
  frequency: string;
  address: string;
  city: string;
  zipCode: string;
  addOns: {
    deodorize?: boolean;
    deodorizeMode?: string;
    sprayDeck?: boolean;
    sprayDeckMode?: string;
    divertMode?: string;
  };
  submittedAt: string;
}

interface SetupIntentData {
  clientSecret: string;
  pricing: {
    perVisit: number;
    monthly: number;
    firstVisit: number;
    breakdown: any;
  };
}

function PaymentForm({ setupIntentData, leadData, onComplete }: {
  setupIntentData: SetupIntentData;
  leadData: LeadData;
  onComplete: () => void;
}) {
  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initializeStripe = async () => {
      const stripe = await stripePromise;
      if (!stripe) return;

      const elements = stripe.elements();
      const paymentElement = elements.create('payment');
      paymentElement.mount('#payment-element');

      // Handle form submission
      const form = document.getElementById('payment-form') as HTMLFormElement;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        setError('');

        const { error: submitError } = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/onboarding/complete?leadId=${leadData.id}`,
          },
        });

        if (submitError) {
          setError(submitError.message || 'Payment setup failed');
          setIsProcessing(false);
        }
      });
    };

    initializeStripe();
  }, [stripePromise, leadData.id]);

  return (
    <form id="payment-form" className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Method
        </label>
        <div id="payment-element" className="border border-gray-300 rounded-md p-3" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Billing Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Service:</span>
            <span className="capitalize">{leadData.frequency?.replace('-', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span>Monthly Amount:</span>
            <span>${(setupIntentData.pricing.monthly / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>First Visit:</span>
            <span>${(setupIntentData.pricing.firstVisit / 100).toFixed(2)}</span>
          </div>
          <hr className="my-2" />
          <div className="flex justify-between font-medium">
            <span>Today&apos;s Charge:</span>
            <span>${(setupIntentData.pricing.firstVisit / 100).toFixed(2)}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          You will be charged ${(setupIntentData.pricing.monthly / 100).toFixed(2)} monthly starting next month.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            Complete Setup
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </form>
  );
}

function OnboardingSetupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [setupIntentData, setSetupIntentData] = useState<SetupIntentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const leadId = searchParams.get('leadId');

  useEffect(() => {
    if (!leadId) {
      router.push('/quote?businessId=yardura');
      return;
    }

    initializeSetup();
  }, [leadId, router]);

  const initializeSetup = async () => {
    try {
      // Fetch lead data
      const leadResponse = await fetch(`/api/leads/${leadId}`);
      if (!leadResponse.ok) throw new Error('Failed to fetch lead');

      const leadData = await leadResponse.json();
      setLead(leadData);

      // Create Stripe SetupIntent
      const setupResponse = await fetch('/api/stripe/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });

      if (!setupResponse.ok) throw new Error('Failed to create setup intent');

      const setupData = await setupResponse.json();
      setSetupIntentData(setupData);
    } catch (err) {
      console.error('Setup error:', err);
      setError('Failed to initialize payment setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (error || !lead || !setupIntentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Error</h1>
          <p className="text-gray-600 mb-6">
            {error || 'We encountered an issue setting up your account.'}
          </p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/10 rounded-full mb-6">
              <CreditCard className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Complete Your Setup, {lead.firstName}
            </h1>
            <p className="text-xl text-gray-600">
              Just one more step to start your Yardura service
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Quote Summary */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Your Service Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Service:</span>
                    <p className="font-medium capitalize">{lead.serviceType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Frequency:</span>
                    <p className="font-medium capitalize">{lead.frequency?.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dogs:</span>
                    <p className="font-medium">{lead.dogs}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Property:</span>
                    <p className="font-medium capitalize">{lead.yardSize}</p>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground text-sm">Address:</span>
                  <p className="font-medium">
                    {lead.address}, {lead.city}, {lead.zipCode}
                  </p>
                </div>

                {lead.addOns?.deodorize && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Enhanced Deodorizing</span>
                  </div>
                )}

                {lead.addOns?.sprayDeck && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Deck & Patio Cleaning</span>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="bg-accent/5 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">What&apos;s Next</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Your first visit will be scheduled within 24 hours</li>
                      <li>• You&apos;ll receive a confirmation email with details</li>
                      <li>• Access your dashboard to manage your service</li>
                      <li>• Track your environmental impact</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Setup */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret: setupIntentData.clientSecret }}>
                  <PaymentForm
                    setupIntentData={setupIntentData}
                    leadData={lead}
                    onComplete={() => {
                      // Handle completion - will be redirected by Stripe
                    }}
                  />
                </Elements>

                <div className="mt-6 text-center">
                  <p className="text-xs text-gray-500">
                    Your payment information is secure and encrypted.
                    You can cancel or modify your service anytime.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <OnboardingSetupContent />
    </Suspense>
  );
}

