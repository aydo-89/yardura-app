import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle,
  Heart,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Share2,
  ArrowRight
} from "lucide-react";

import TableOfContents from "@/components/articles/TableOfContents";
import RelatedArticles from "@/components/articles/RelatedArticles";
import { MOCK_ARTICLES, getRelatedArticles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Dog Poop Color Chart: What Your Dog's Stool Says About Health | Minneapolis Vets",
  description: "Complete dog poop color guide: brown, black, green, yellow stool meanings. Learn when to consult Minneapolis veterinarians about concerning stool changes. Non-diagnostic health insights.",
  keywords: [
    "dog poop color meaning",
    "dog stool color chart",
    "dog poop health indicators",
    "Minneapolis dog health",
    "dog digestive health",
    "when to call vet for dog poop"
  ],
  openGraph: {
    title: "Dog Poop Color Chart: What Your Dog's Stool Says About Health",
    description: "Complete guide to dog stool colors and what they mean for your pet's health. Know when to consult your Minneapolis vet.",
    type: "article",
    url: "https://www.yardura.com/insights/dog-poop-color-health",
    publishedTime: "2024-01-15T10:00:00.000Z",
    modifiedTime: "2024-01-15T10:00:00.000Z",
    authors: ["Dr. Sarah Johnson"],
    images: [
      {
        url: "/api/og?type=insights&title=Dog%20Poop%20Color%20Chart&subtitle=What%20Your%20Dog%27s%20Stool%20Says%20About%20Health",
        width: 1200,
        height: 630,
        alt: "Guide to dog poop colors and what they mean for health - complete stool analysis guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dog Poop Color Chart: What Your Dog's Stool Says About Health",
    description: "Complete guide to dog stool colors and what they mean for your pet's health.",
    images: ["/api/og?type=insights&title=Dog%20Poop%20Color%20Chart"],
  },
  alternates: {
    canonical: "https://www.yardura.com/insights/dog-poop-color-health",
  },
  authors: [{ name: "Dr. Sarah Johnson" }],
};

const stoolColors = [
  {
    color: "Brown",
    hex: "#8B4513",
    description: "Normal healthy stool color",
    causes: ["Normal digestion", "Balanced diet", "Healthy gut bacteria"],
    whenToWorry: "Usually not concerning unless very pale or very dark brown",
    urgency: "low"
  },
  {
    color: "Black/Tarry",
    hex: "#2F2F2F",
    description: "Digested blood from upper GI tract",
    causes: ["Bleeding in stomach or small intestine", "Certain medications", "Ingestion of blood"],
    whenToWorry: "Always concerning - indicates digested blood",
    urgency: "high"
  },
  {
    color: "Bright Red",
    hex: "#DC143C",
    description: "Fresh blood from lower GI tract",
    causes: ["Colitis", "Hemorrhoids", "Anal gland issues", "Rectal bleeding"],
    whenToWorry: "Concerning if persistent or accompanied by other symptoms",
    urgency: "medium"
  },
  {
    color: "Green",
    hex: "#228B22",
    description: "Bile or rapid transit through intestines",
    causes: ["Eating grass", "Bile reflux", "Rapid intestinal transit", "Certain foods"],
    whenToWorry: "Usually not serious unless chronic or with other symptoms",
    urgency: "low"
  },
  {
    color: "Yellow/Gray",
    hex: "#F0E68C",
    description: "Lack of bile or malabsorption",
    causes: ["Liver issues", "Pancreatic insufficiency", "Malabsorption disorders"],
    whenToWorry: "Concerning if persistent - indicates digestive issues",
    urgency: "medium"
  },
  {
    color: "White/Gray",
    hex: "#D3D3D3",
    description: "Complete lack of bile",
    causes: ["Bile duct obstruction", "Liver disease", "Gallbladder issues"],
    whenToWorry: "Always concerning - seek veterinary attention immediately",
    urgency: "high"
  }
];

const whenToCallVet = [
  "Black or tarry stools (melena)",
  "Bright red blood in stool",
  "Pale or white stools",
  "Chronic diarrhea or constipation",
  "Blood in stool for more than 24 hours",
  "Stool changes accompanied by lethargy, vomiting, or loss of appetite",
  "Sudden changes in stool consistency lasting more than 48 hours"
];

export default function DogPoopColorArticle() {
  return (
    <article className="min-h-screen bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20">
      {/* Article Header */}
      <div className="bg-white border-b border-accent/10">
        <div className="container py-8">
          <div className="max-w-4xl mx-auto">
            <Link href="/insights" className="inline-flex items-center gap-2 text-accent hover:text-accent/80 mb-6">
              <ArrowLeft className="size-4" />
              Back to Insights
            </Link>

            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Badge variant="secondary">Health</Badge>
              <Badge variant="outline">Veterinary Care</Badge>
              <Badge variant="outline">Minneapolis</Badge>
              <div className="flex items-center gap-1 text-sm text-muted">
                <Calendar className="size-4" />
                January 15, 2024
              </div>
              <div className="flex items-center gap-1 text-sm text-muted">
                <Clock className="size-4" />
                5 min read
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-ink mb-6">
              Dog Poop Color Chart: What Your Dog's Stool Says About Health
            </h1>

            <p className="text-lg text-muted mb-6">
              Understanding dog poop colors and what they mean for your pet's health.
              Learn when to consult your Minneapolis veterinarian about concerning stool changes.
              <strong className="text-orange-600">This is not veterinary advice.</strong>
            </p>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted" />
                <span className="text-sm font-medium">Dr. Sarah Johnson</span>
                <span className="text-sm text-muted">Veterinary Consultant</span>
              </div>
              <Button variant="outline" size="sm">
                <Share2 className="size-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        <div className="max-w-4xl mx-auto">
          {/* Introduction */}
          <div className="prose prose-lg max-w-none mb-12">
            <p>
              As a Minneapolis veterinarian, I'm often asked about dog poop colors and what they might
              indicate about a dog's health. While stool color alone isn't definitive for diagnosis,
              it can provide important clues about your dog's digestive health and help you know when
              to seek professional veterinary care.
            </p>

            <p>
              <strong>Important Disclaimer:</strong> This guide is for informational purposes only and
              does not constitute veterinary advice. Always consult a licensed veterinarian for health
              concerns. In Minneapolis, I recommend <Link href="#" className="text-accent hover:underline">
              Animal Humane Society</Link> or <Link href="#" className="text-accent hover:underline">
              Minneapolis Veterinary Center</Link> for professional care.
            </p>
          </div>

          {/* Color Chart */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-ink mb-6">Dog Poop Color Chart</h2>
            <div className="grid gap-4">
              {stoolColors.map((color) => (
                <Card key={color.color} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div
                        className="size-8 rounded-full border-2 border-white shadow-md"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div>
                        <CardTitle className="text-lg">{color.color} Stools</CardTitle>
                        <p className="text-sm text-muted">{color.description}</p>
                      </div>
                      {color.urgency === 'high' && (
                        <Badge variant="destructive" className="ml-auto">
                          <AlertTriangle className="size-3 mr-1" />
                          Urgent
                        </Badge>
                      )}
                      {color.urgency === 'medium' && (
                        <Badge variant="secondary" className="ml-auto">
                          Monitor
                        </Badge>
                      )}
                      {color.urgency === 'low' && (
                        <Badge variant="outline" className="ml-auto">
                          <CheckCircle className="size-3 mr-1" />
                          Normal
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Common Causes</h4>
                        <ul className="text-sm text-muted space-y-1">
                          {color.causes.map((cause, index) => (
                            <li key={index}>• {cause}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">When to Worry</h4>
                        <p className="text-sm text-muted">{color.whenToWorry}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* When to Call the Vet */}
          <Card className="mb-12 border-orange-200 bg-orange-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="size-5" />
                When to Call Your Minneapolis Vet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-800 mb-4">
                Contact a veterinarian immediately if you notice:
              </p>
              <ul className="space-y-2">
                {whenToCallVet.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-orange-700">
                    <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 p-4 bg-orange-100 rounded-lg">
                <p className="text-sm text-orange-800">
                  <strong>Emergency Signs:</strong> If your dog shows lethargy, vomiting, fever,
                  or pale gums along with stool changes, seek immediate veterinary care.
                  In Minneapolis, contact <strong>BluePearl Pet Hospital</strong> at (952) 922-0006 for emergencies.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Professional Monitoring */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-ink mb-6">Professional Health Monitoring</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="size-5 text-accent" />
                    Regular Veterinary Care
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted mb-4">
                    Schedule annual wellness exams and fecal tests. Early detection of parasites
                    and digestive issues can prevent serious health problems.
                  </p>
                  <p className="text-sm text-muted">
                    <strong>Minneapolis Recommendation:</strong> Annual wellness exams at
                    local veterinary clinics help catch issues before they become serious.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="size-5 text-accent" />
                    Preventive Care
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted mb-4">
                    Keep up with flea/tick prevention, heartworm medication, and regular deworming.
                    These prevent many digestive issues that can affect stool quality.
                  </p>
                  <p className="text-sm text-muted">
                    <strong>Local Resources:</strong> Minneapolis area pet stores and veterinary
                    clinics offer comprehensive preventive care programs.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Local Resources */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Minneapolis Veterinary Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Emergency Veterinary Care</h4>
                  <ul className="space-y-2 text-sm">
                    <li><strong>BluePearl Pet Hospital:</strong> (952) 922-0006</li>
                    <li><strong>Emergency Pet Center:</strong> (612) 875-1888</li>
                    <li><strong>Animal Humane Society:</strong> (952) 435-7738</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">General Veterinary Care</h4>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Minneapolis Veterinary Center:</strong> (612) 721-0077</li>
                    <li><strong>Lyndale Animal Hospital:</strong> (612) 871-3626</li>
                    <li><strong>Midwest Veterinary Supply:</strong> Resources & education</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <Card className="bg-gradient-to-r from-accent-soft/30 via-white to-accent-soft/30 border-accent/20">
            <CardContent className="p-8 text-center">
              <Heart className="size-12 text-accent mx-auto mb-4" />
              <h3 className="text-xl font-bold text-ink mb-3">
                Professional Minneapolis Dog Waste Removal
              </h3>
              <p className="text-muted mb-6 max-w-2xl mx-auto">
                While monitoring your dog's health at home is important, professional waste removal
                services in Minneapolis can help maintain a clean environment and provide optional
                health insights through regular monitoring.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/quote">
                  <Button className="btn-gradient">
                    Get Free Minneapolis Quote
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/facts">
                  <Button variant="outline">
                    Learn About Health Insights
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Article Footer */}
          <div className="mt-12 pt-8 border-t border-accent/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-muted">
                Published January 15, 2024 • Updated January 15, 2024
              </div>
              <div className="flex items-center gap-4">
                <Link href="/insights" className="text-accent hover:text-accent/80 text-sm">
                  ← Back to Insights
                </Link>
                <Button variant="ghost" size="sm">
                  <Share2 className="size-4 mr-2" />
                  Share Article
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
