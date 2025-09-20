'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function QuoteSentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const leadId = searchParams.get('leadId');
  const businessId =
    searchParams.get('businessId') ||
    searchParams.get('org') ||
    searchParams.get('tenant') ||
    searchParams.get('tenantId') ||
    'yardura';

  useEffect(() => {
    if (!leadId) {
      router.push(`/quote?businessId=${businessId}`);
      return;
    }

    setErrorMessage(null);
  }, [leadId, router, businessId]);

  const sendQuoteEmail = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/send-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data?.error || 'We could not deliver the quote email.';
        throw new Error(message);
      }

      setEmailSent(true);
    } catch (error) {
      console.error('Error sending quote email:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected error sending quote email.');
      setEmailSent(false);
    } finally {
      setIsLoading(false);
    }
  }, [leadId, businessId]);

  useEffect(() => {
    if (!leadId) return;
    sendQuoteEmail();
  }, [leadId, sendQuoteEmail]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Sending your quote...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4">
        <div className="max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">We hit a snag</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <div className="space-y-3">
            <Button className="bg-accent hover:bg-accent/90 w-full" onClick={sendQuoteEmail}>
              Try Again
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/quote?businessId=${businessId}`}>
                Back to Quote
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!leadId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Not Found</h1>
          <p className="text-gray-600 mb-6">We couldn't process your quote. Please try again.</p>
          <Button asChild>
            <Link href="/quote?businessId=yardura">Start New Quote</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <Mail className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Quote Sent!
            </h1>
            <p className="text-xl text-gray-600">
              We've emailed your personalized quote and next steps.
            </p>
          </div>

          {/* Status Card */}
          <Card className="shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Email Sent Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Your quote has been sent to your email address. The email includes:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 ml-4">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Detailed service breakdown and pricing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Service area coverage confirmation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Next steps and contact information
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Link to create an account for service management
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="shadow-lg mb-8">
            <CardHeader>
              <CardTitle>What Happens Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Review Your Quote</p>
                    <p className="text-sm text-gray-600">Check your email and review the detailed quote we sent you.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Contact Our Team</p>
                    <p className="text-sm text-gray-600">Call us or reply to the email if you have questions or want to proceed.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Schedule Service</p>
                    <p className="text-sm text-gray-600">Once you're ready, we'll help you set up your first service visit.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
                <Link href="/services">
                  Learn More About Our Services
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link
                  href={`/onboarding/start?${(() => {
                    const params = new URLSearchParams({ leadId: leadId || '' });
                    if (businessId) params.set('businessId', businessId);
                    return params.toString();
                  })()}`}
                >
                  Actually, I want to create an account
                </Link>
              </Button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Questions? Call us at{' '}
                <a href="tel:1-888-915-YARD" className="text-accent hover:underline font-medium">
                  1-888-915-YARD (9273)
                </a>
              </p>
            </div>
          </div>

          {/* Lead ID for reference */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">
              Reference ID: <span className="font-mono">{leadId}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuoteSentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <QuoteSentContent />
    </Suspense>
  );
}
