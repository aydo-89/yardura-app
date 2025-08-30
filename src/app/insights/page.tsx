import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  User,
  ArrowRight,
  Search,
  Heart,
  Leaf,
  MapPin,
  TrendingUp
} from "lucide-react";

export const metadata = {
  title: "Dog Health & Eco Insights | Minneapolis Dog Waste Removal",
  description: "Expert insights on dog health, eco-friendly waste management, and Minneapolis pet care. Professional dog waste removal tips and local Twin Cities resources.",
  keywords: [
    "dog poop health insights Minneapolis",
    "dog waste color meaning",
    "eco-friendly dog waste disposal",
    "Minneapolis pet health tips",
    "dog stool analysis",
    "Twin Cities dog care"
  ],
  openGraph: {
    title: "Dog Health & Eco Insights | Minneapolis Dog Waste Removal",
    description: "Expert insights on dog health, eco-friendly waste management, and Minneapolis pet care.",
    type: "website",
    url: "https://www.yardura.com/insights",
    images: [
      {
        url: "/api/og?type=insights&title=Dog%20Health%20%26%20Eco%20Insights&subtitle=Professional%20insights%20on%20dog%20health%20and%20waste%20management",
        width: 1200,
        height: 630,
        alt: "Dog health insights and eco-friendly waste management articles from Yardura",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dog Health & Eco Insights | Minneapolis Dog Waste Removal",
    description: "Expert insights on dog health, eco-friendly waste management, and Minneapolis pet care.",
    images: ["/api/og?type=insights&title=Dog%20Health%20%26%20Eco%20Insights"],
  },
  alternates: {
    canonical: "https://www.yardura.com/insights",
  },
};

const insights = [
  {
    slug: "dog-poop-color-health",
    title: "Dog Poop Color Chart: What Your Dog's Stool Says About Health",
    excerpt: "Understanding dog poop colors and what they mean for your pet's health. Learn when to consult your vet about stool changes.",
    author: "Dr. Sarah Johnson",
    date: "2024-01-15",
    readTime: "5 min read",
    category: "Health",
    tags: ["dog health", "stool analysis", "veterinary care", "Minneapolis vets"],
    featured: true,
  },
  {
    slug: "weekly-vs-biweekly-scooping",
    title: "Weekly vs Bi-Weekly Dog Waste Removal: Cost, Cleanliness & Health Tradeoffs",
    excerpt: "Compare weekly and bi-weekly dog waste removal services. Understand the impact on yard cleanliness, costs, and pet health monitoring.",
    author: "Mike Chen",
    date: "2024-01-10",
    readTime: "4 min read",
    category: "Service",
    tags: ["dog waste removal", "weekly service", "bi-weekly service", "Minneapolis"],
  },
  {
    slug: "minneapolis-dog-waste-laws",
    title: "Minneapolis Dog Waste Laws: What Pet Owners Need to Know",
    excerpt: "Complete guide to Minneapolis dog waste ordinances, penalties, and proper disposal methods. Stay compliant and keep our city clean.",
    author: "City of Minneapolis",
    date: "2024-01-05",
    readTime: "6 min read",
    category: "Local",
    tags: ["Minneapolis laws", "dog waste disposal", "Twin Cities", "pet regulations"],
  },
  {
    slug: "methane-dog-waste",
    title: "The Environmental Impact of Dog Waste: Methane, Landfills & Solutions",
    excerpt: "How dog waste contributes to methane emissions and landfill pollution. Learn about eco-friendly disposal and composting solutions.",
    author: "Environmental Team",
    date: "2023-12-20",
    readTime: "7 min read",
    category: "Eco",
    tags: ["eco-friendly", "methane reduction", "composting", "environmental impact"],
  },
];

const categories = [
  { name: "Health", count: 12, icon: Heart, color: "text-red-600" },
  { name: "Eco", count: 8, icon: Leaf, color: "text-green-600" },
  { name: "Local", count: 15, icon: MapPin, color: "text-blue-600" },
  { name: "Service", count: 6, icon: TrendingUp, color: "text-purple-600" },
];

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20">
      {/* Header */}
      <div className="bg-white border-b border-accent/10">
        <div className="container py-12">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              Dog Health & Eco Insights
            </Badge>
            <h1 className="text-4xl font-extrabold text-ink mb-4">
              Minneapolis Dog Care Insights
            </h1>
            <p className="text-lg text-muted mb-6">
              Expert advice on dog health, eco-friendly waste management, and local Minneapolis
              pet care resources. Professional insights from veterinarians and environmental experts.
            </p>

            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted" />
              <input
                type="text"
                placeholder="Search dog health tips, eco tips..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-accent/20 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.name} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <Icon className={`size-8 mx-auto mb-2 ${category.color}`} />
                  <h3 className="font-semibold text-ink">{category.name}</h3>
                  <p className="text-sm text-muted">{category.count} articles</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Featured Article */}
        {insights[0] && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <div className="size-2 bg-accent rounded-full"></div>
              <span className="text-sm font-medium text-accent">Featured Article</span>
            </div>

            <Card className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="md:flex">
                <div className="md:w-1/2 p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <Badge variant="secondary">{insights[0].category}</Badge>
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <Clock className="size-3" />
                      {insights[0].readTime}
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-ink mb-4">
                    {insights[0].title}
                  </h2>

                  <p className="text-muted mb-6">
                    {insights[0].excerpt}
                  </p>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted" />
                      <span className="text-sm text-muted">{insights[0].author}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-muted" />
                      <span className="text-sm text-muted">
                        {new Date(insights[0].date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Link href={`/insights/${insights[0].slug}`}>
                    <Button className="btn-gradient">
                      Read Full Article
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </Link>
                </div>

                <div className="md:w-1/2 bg-gradient-to-br from-accent-soft/30 to-accent/10 flex items-center justify-center p-8">
                  <div className="text-center">
                    <Heart className="size-16 text-accent mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-ink mb-2">
                      Dog Health Matters
                    </h3>
                    <p className="text-sm text-muted">
                      Understanding your dog's health through waste analysis
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Article Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.slice(1).map((article) => (
            <Card key={article.slug} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{article.category}</Badge>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3" />
                    {article.readTime}
                  </div>
                </div>
                <CardTitle className="text-lg leading-tight">
                  {article.title}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted mb-4 line-clamp-3">
                  {article.excerpt}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="size-3 text-muted" />
                    <span className="text-xs text-muted">{article.author}</span>
                  </div>

                  <Link href={`/insights/${article.slug}`}>
                    <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
                      Read More
                      <ArrowRight className="size-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-accent-soft/30 via-white to-accent-soft/30 border-accent/20 max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-ink mb-3">
                Ready for Professional Minneapolis Dog Waste Removal?
              </h3>
              <p className="text-muted mb-6">
                Get a free quote for eco-friendly weekly service with optional health insights.
                Serving Minneapolis, Richfield, Edina & Bloomington.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/quote">
                  <Button className="btn-gradient">
                    Get My Free Quote
                  </Button>
                </Link>
                <Link href="/facts">
                  <Button variant="outline">
                    Learn More About Our Service
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
