'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

function OnboardingStartContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const leadId = searchParams.get('leadId');
  const isCommercial = searchParams.get('commercial') === 'true';

  useEffect(() => {
    if (!leadId) {
      router.push('/quote?businessId=yardura');
      return;
    }

    // Fetch lead data
    fetchLeadData();
  }, [leadId, router]);

  const fetchLeadData = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}`);
      if (response.ok) {
        const leadData = await response.json();
        setLead(leadData);
        setEmail(leadData.email);
      } else {
        console.error('Failed to fetch lead data');
        router.push('/quote?businessId=yardura');
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
      router.push('/quote?businessId=yardura');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!email || !lead) return;

    setIsSendingMagicLink(true);
    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          leadId: lead.id,
          callbackUrl: `/onboarding/setup?leadId=${lead.id}`,
        }),
      });

      if (response.ok) {
        setMagicLinkSent(true);
      } else {
        console.error('Failed to send magic link');
      }
    } catch (error) {
      console.error('Error sending magic link:', error);
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Not Found</h1>
          <p className="text-gray-600 mb-6">We couldn't find your quote. Please start over.</p>
          <Button asChild>
            <Link href="/quote?businessId=yardura">Start New Quote</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/10 rounded-full mb-6">
              <CheckCircle className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Yardura, {lead.firstName}!
            </h1>
            <p className="text-xl text-gray-600">
              Your quote is ready. Let's set up your account to get started.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Quote Summary */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Your Quote Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Service:</span>
                    <p className="font-medium capitalize">{lead.serviceType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dogs:</span>
                    <p className="font-medium">{lead.dogs}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Yard Size:</span>
                    <p className="font-medium capitalize">{lead.yardSize}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Frequency:</span>
                    <p className="font-medium capitalize">{lead.frequency?.replace('-', ' ')}</p>
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
                  <p className="text-sm text-muted-foreground">
                    Quote created: {new Date(lead.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Account Setup */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-accent" />
                  Create Your Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-gray-600 mb-4">
                    Create a free account to manage your service, view your dashboard, and track your environmental impact.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                {!magicLinkSent ? (
                  <Button
                    onClick={handleSendMagicLink}
                    disabled={!email || isSendingMagicLink}
                    className="w-full"
                    size="lg"
                  >
                    {isSendingMagicLink ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending Magic Link...
                      </>
                    ) : (
                      <>
                        Send Magic Link
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="text-center p-6 bg-green-50 rounded-lg">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="font-semibold text-green-800 mb-2">Magic Link Sent!</h3>
                    <p className="text-sm text-green-700">
                      Check your email and click the link to complete your account setup.
                    </p>
                  </div>
                )}

                <div className="text-center">
                  <Button variant="ghost" asChild>
                    <Link href={`/quote/sent?leadId=${lead.id}`}>
                      Just email me the quote instead
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benefits */}
          <Card className="mt-8 shadow-lg">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold text-center mb-6">What You'll Get With Your Account</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-accent text-xl">📅</span>
                  </div>
                  <h4 className="font-semibold mb-2">Easy Scheduling</h4>
                  <p className="text-sm text-gray-600">Reschedule visits and manage your service preferences</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-accent text-xl">📊</span>
                  </div>
                  <h4 className="font-semibold mb-2">Service Dashboard</h4>
                  <p className="text-sm text-gray-600">Track your service history and view upcoming visits</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-accent text-xl">🌱</span>
                  </div>
                  <h4 className="font-semibold mb-2">Environmental Impact</h4>
                  <p className="text-sm text-gray-600">Monitor your carbon footprint and compost contributions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingStartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <OnboardingStartContent />
    </Suspense>
  );
}
