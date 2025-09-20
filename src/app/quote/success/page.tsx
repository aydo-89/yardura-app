"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function QuoteSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  const leadId = searchParams.get("leadId");
  const isCommercial = searchParams.get("commercial") === "true";
  const businessId =
    searchParams.get("businessId") ||
    searchParams.get("org") ||
    searchParams.get("tenant") ||
    searchParams.get("tenantId") ||
    "yardura";

  useEffect(() => {
    // If no leadId, redirect back to quote page
    if (!leadId) {
      router.push(`/quote?businessId=${businessId}`);
      return;
    }

    // Simulate loading time for better UX
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [leadId, router, businessId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing your quote...</p>
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
              Quote Submitted Successfully!
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              Thank you for choosing Yardura. Your quote request has been
              received.
            </p>
            <p className="text-gray-500">
              Confirmation #:{" "}
              <span className="font-mono text-sm bg-green-100 text-green-800 px-3 py-1 rounded font-semibold">
                {leadId?.slice(-8).toUpperCase()}
              </span>
            </p>
          </div>

          {/* Next Steps */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent" />
                  What Happens Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Review & Qualification</p>
                    <p className="text-sm text-gray-600">
                      Our team reviews your quote within 24 hours
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Custom Proposal</p>
                    <p className="text-sm text-gray-600">
                      Receive a tailored service proposal with pricing
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Schedule Service</p>
                    <p className="text-sm text-gray-600">
                      Book your first service visit at your convenience
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-accent" />
                  Get in Touch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">Call Us</p>
                    <a
                      href="tel:1-888-915-YARD"
                      className="text-accent hover:underline"
                    >
                      1-888-915-YARD (9273)
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">Email Us</p>
                    <a
                      href="mailto:info@yardura.com"
                      className="text-accent hover:underline"
                    >
                      info@yardura.com
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">Service Area</p>
                    <p className="text-sm text-gray-600">
                      Minneapolis, Richfield, Edina & Bloomington
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commercial vs Residential Content */}
          {isCommercial ? (
            <Card className="border-0 shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="text-accent">
                  Commercial Property Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Thank you for your commercial property quote request. Our
                  commercial division specializes in tailored waste management
                  solutions for businesses, HOAs, and property managers.
                </p>
                <p className="text-gray-600">
                  A commercial account specialist will contact you within 24
                  hours to discuss your specific needs and provide a customized
                  proposal.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="text-accent">
                  Ready for Cleaner Yards?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  You're just one step away from having the cleanest yard on the
                  block! Our professional team uses eco-friendly methods and
                  advanced equipment to keep your yard pristine.
                </p>
                <p className="text-gray-600">
                  We'll be in touch soon to schedule your service and answer any
                  questions you may have.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="text-center space-y-6">
            {/* Self-service messaging */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-3xl mx-auto mb-8">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Ready to Get Started Right Now?
              </h3>
              <p className="text-blue-800 mb-4">
                If everything looks correct and you're ready to set up your
                account and schedule your first service, you can proceed with
                self-service onboarding. We'll collect payment information and
                schedule your service immediately.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-blue-700">
                <CheckCircle className="w-4 h-4" />
                <span>No need to wait for manual confirmation</span>
              </div>
            </div>

            {/* Primary choices */}
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* Self-serve onboarding */}
              <Button
                asChild
                size="lg"
                className="bg-accent hover:bg-accent/90"
              >
                <Link
                  href={`/onboarding/start?${(() => {
                    const params = new URLSearchParams({
                      leadId: leadId || "",
                    });
                    if (isCommercial) params.set("commercial", "true");
                    if (businessId) params.set("businessId", businessId);
                    return params.toString();
                  })()}`}
                >
                  Create Account & Schedule Service
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>

              {/* Send quote only (no account yet) */}
              <Button asChild variant="outline" size="lg">
                <Link
                  href={`/quote/sent?${(() => {
                    const params = new URLSearchParams({
                      leadId: leadId || "",
                    });
                    if (businessId) params.set("businessId", businessId);
                    return params.toString();
                  })()}`}
                >
                  Just Email Me the Quote
                </Link>
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="ghost">
                <Link href="/services">Learn More About Our Services</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/contact">Contact Us Directly</Link>
              </Button>
            </div>

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
  );
}

export default function QuoteSuccessPage() {
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
      <QuoteSuccessContent />
    </Suspense>
  );
}
