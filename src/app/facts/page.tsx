import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  MapPin,
  Clock,
  DollarSign,
  Leaf,
  Heart,
  Users,
  Award,
  Phone,
  Mail,
  Calendar
} from "lucide-react";

export const metadata: Metadata = {
  title: "Yardura Facts & Service Details | Minneapolis Dog Waste Removal",
  description: "Complete fact sheet about Yardura's eco-friendly dog waste removal services in Minneapolis, Richfield, Edina & Bloomington. Pricing, coverage, and service details.",
  keywords: [
    "yardura facts",
    "dog waste removal Minneapolis facts",
    "yardura service details",
    "minneapolis pooper scooper pricing"
  ],
  openGraph: {
    title: "Yardura Facts & Service Details",
    description: "Complete information about Yardura's eco-friendly dog waste removal services in the Twin Cities.",
    type: "website",
    images: [
      {
        url: "/api/og?type=facts",
        width: 1200,
        height: 630,
        alt: "Yardura service facts - Licensing, insurance, service areas, pricing, and eco-friendly practices",
      },
    ],
    url: "https://www.yardura.com/facts",
  },
  alternates: {
    canonical: "https://www.yardura.com/facts",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function FactsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20">
      <div className="container py-16 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Official Fact Sheet
          </Badge>
          <h1 className="text-4xl font-extrabold text-ink mb-4">
            Yardura Service Facts
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Complete, accurate information about our eco-friendly dog waste removal services
            in the Twin Cities area.
          </p>
        </div>

        <div className="grid gap-8">
          {/* Company Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="size-5 text-accent" />
                Company Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Business Information</h3>
                  <ul className="space-y-1 text-sm">
                    <li><strong>Founded:</strong> 2024</li>
                    <li><strong>Service Area:</strong> Twin Cities (MN)</li>
                    <li><strong>License:</strong> Fully licensed and insured</li>
                    <li><strong>Insurance:</strong> General liability coverage</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Service Philosophy</h3>
                  <ul className="space-y-1 text-sm">
                    <li><strong>Approach:</strong> Tech-enabled, eco-friendly</li>
                    <li><strong>Focus:</strong> Clean yards + health insights</li>
                    <li><strong>Values:</strong> Transparency, reliability, sustainability</li>
                    <li><strong>Technology:</strong> AI-powered analysis</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5 text-accent" />
                Service Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Current Service Areas</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <div className="size-2 bg-accent rounded-full"></div>
                      <span>South Minneapolis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-2 bg-accent rounded-full"></div>
                      <span>Richfield</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-2 bg-accent rounded-full"></div>
                      <span>Edina</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-2 bg-accent rounded-full"></div>
                      <span>Bloomington</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Service Requirements</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Gate access required for service</li>
                    <li>• Clear path to waste areas</li>
                    <li>• Dogs must be contained during service</li>
                    <li>• 24-hour notice for schedule changes</li>
                    <li>• Weather-dependent (extreme conditions)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Structure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="size-5 text-accent" />
                Pricing Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Base Pricing by Yard Size</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Small (&lt; 2,500 sq ft)</span>
                      <span className="font-medium">$25/visit</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Medium (2,500-5,000 sq ft)</span>
                      <span className="font-medium">$35/visit</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Large (5,000-10,000 sq ft)</span>
                      <span className="font-medium">$45/visit</span>
                    </div>
                    <div className="flex justify-between">
                      <span>XL (&gt; 10,000 sq ft)</span>
                      <span className="font-medium">$60/visit</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Additional Fees</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>2nd dog</span>
                      <span className="font-medium">+20%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>3rd dog</span>
                      <span className="font-medium">+40%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>4th dog</span>
                      <span className="font-medium">+60%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bi-weekly discount</span>
                      <span className="font-medium">-5%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-accent-soft/30 rounded-lg">
                <h4 className="font-semibold mb-2">Add-on Services</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Deodorize & Sanitize</span>
                    <span className="font-medium">+$15</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Litter Box Service</span>
                    <span className="font-medium">+$10</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-accent" />
                Service Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Weekly Service Includes</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Complete yard scan and cleanup</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Double-bagging and secure disposal</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Gate check and security</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Photo documentation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Text/email confirmations</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Optional Health Insights</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>3 C's analysis (Color, Consistency, Content)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Weekly trend reports</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Early change alerts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Data privacy controls</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="size-1.5 bg-accent rounded-full"></div>
                      <span>Non-diagnostic insights only</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eco Impact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="size-5 text-accent" />
                Environmental Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Waste Diversion</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Compost waste where permitted</li>
                    <li>• Track methane reduction</li>
                    <li>• Partner with local facilities</li>
                    <li>• Monitor environmental impact</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Sustainable Practices</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Eco-friendly cleaning products</li>
                    <li>• Minimal plastic usage</li>
                    <li>• Local transportation</li>
                    <li>• Carbon offset tracking</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Impact per dog per year:</strong> ~250 lbs diverted from landfills,
                  ~0.5 metric tons CO2 equivalent reduced through composting.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact & Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5 text-accent" />
                Contact & Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-accent" />
                      <span>(888) 915-9273</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-accent" />
                      <span>hello@yardura.com</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Service Hours</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-accent" />
                      <span>Monday - Friday: 8:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-accent" />
                      <span>Same-day booking available</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Health Insights Disclaimer */}
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Heart className="size-5 text-orange-600" />
                Health Insights Important Notice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-orange-800">
                <p>
                  <strong>Our health insights are informational only and do not constitute veterinary advice.</strong>
                </p>
                <ul className="space-y-1 ml-4">
                  <li>• We analyze Color, Consistency, and Content changes</li>
                  <li>• Early detection may help with timely veterinary care</li>
                  <li>• All insights are non-diagnostic</li>
                  <li>• Always consult a licensed veterinarian for health concerns</li>
                  <li>• Data is anonymized and privacy-protected</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
