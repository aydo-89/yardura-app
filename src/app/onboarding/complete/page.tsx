"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Calendar,
  MapPin,
  Phone,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SubscriptionData {
  subscriptionId: string;
  customerId: string;
  nextBillingDate: string;
  firstVisitDate: string;
  firstVisitTime: string;
  serviceAddress: string;
}

function OnboardingCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const leadId = searchParams.get("leadId");
  const setupIntentId = searchParams.get("setup_intent");

  useEffect(() => {
    if (!leadId) {
      router.push("/quote?businessId=yardura");
      return;
    }

    completeOnboarding();
  }, [leadId, setupIntentId, router]);

  const completeOnboarding = async () => {
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          setupIntentId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete onboarding");
      }

      const data = await response.json();
      setSubscriptionData(data);

      // Redirect to dashboard after showing success for a few seconds
      setTimeout(() => {
        router.push("/dashboard");
      }, 5000);
    } catch (err) {
      console.error("Onboarding completion error:", err);
      setError(
        "There was an issue completing your setup. Please contact support.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Completing your setup...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Setup Incomplete
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()}>Try Again</Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Yardura!
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              Your account is all set up and your first service is scheduled.
            </p>
            <p className="text-gray-500">
              Redirecting you to your dashboard in a few seconds...
            </p>
          </div>

          {subscriptionData && (
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Service Details */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-accent" />
                    Your First Visit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {new Date(
                          subscriptionData.firstVisitDate,
                        ).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {subscriptionData.firstVisitTime}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Service Address</p>
                      <p className="text-sm text-gray-600">
                        {subscriptionData.serviceAddress}
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">
                      What to Expect
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Professional, uniformed technician</li>
                      <li>• Eco-friendly cleaning process</li>
                      <li>• Waste diversion and recycling</li>
                      <li>• Service completion photos</li>
                      <li>• Environmental impact tracking</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Account Details */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    Your Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Subscription</span>
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700"
                      >
                        Active
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Next Billing</span>
                      <span className="font-medium">
                        {new Date(
                          subscriptionData.nextBillingDate,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Customer ID</span>
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {subscriptionData.customerId.slice(-8)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2">
                      Dashboard Features
                    </h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Service history and scheduling</li>
                      <li>• Payment method management</li>
                      <li>• Environmental impact reports</li>
                      <li>• Service customization options</li>
                      <li>• Support ticket system</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Next Steps */}
          <Card className="shadow-lg mb-8">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold text-center mb-6">
                What Happens Next
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-accent text-xl">📧</span>
                  </div>
                  <h4 className="font-semibold mb-2">Confirmation Email</h4>
                  <p className="text-sm text-gray-600">
                    Check your email for detailed service information
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-accent text-xl">📱</span>
                  </div>
                  <h4 className="font-semibold mb-2">Text Updates</h4>
                  <p className="text-sm text-gray-600">
                    Receive SMS updates about your service
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-accent text-xl">🏠</span>
                  </div>
                  <h4 className="font-semibold mb-2">Dashboard Access</h4>
                  <p className="text-sm text-gray-600">
                    Manage your account and view service history
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-accent hover:bg-accent/90"
              >
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/services">Learn More About Services</Link>
              </Button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Questions? Call us at{" "}
                <a
                  href="tel:1-888-915-YARD"
                  className="text-accent hover:underline font-medium"
                >
                  1-888-915-YARD (9273)
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <OnboardingCompleteContent />
    </Suspense>
  );
}
