import {
  getCityData,
  getCitySlugs,
  getNeighborhoodDetails,
  type CityData,
} from "@/lib/cityData";
import { INSIGHT_ARTICLES } from "@/data/insightsArticles";
import AnimatedHeader from "@/components/site/AnimatedHeader";
import Footer from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Users,
  Star,
  ArrowRight,
  CheckCircle,
  Shield,
  Leaf,
  Phone,
  Clock,
  Award,
  Sparkles,
  ArrowUpRight,
  Compass,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import StructuredData from "@/components/seo/StructuredData";

// These pages are content-heavy and can create thousands of prerender targets.
// During deploy builds, we keep them dynamic to avoid `next build` hanging for hours.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CityPageProps {
  params: Promise<{
    slug: string;
  }>;
}

const fallbackStats = (city: CityData) => [
  {
    label: "Households with dogs",
    value: city.population > 0 ? `${Math.round(city.population * 0.39).toLocaleString()}+` : "Thousands",
  },
  {
    label: "Weekly pickups",
    value: "20k+ bags diverted",
  },
  {
    label: "AI wellness alerts",
    value: "Hundreds per quarter",
  },
];

const defaultFaqs = (cityName: string) => [
  {
    question: `How often does InsightScoop clean yards in ${cityName}?`,
    answer: `Weekly service keeps most ${cityName} yards guest-ready. Busy multi-dog homes can add a mid-week visit so nothing piles up.`,
  },
  {
    question: `Does InsightScoop bring AI stool analysis to ${cityName}?`,
    answer: `Yes. Every InsightScoop technician captures stool images, scores them for color, consistency, and content, and notes trends so you can loop in your vet when it matters.`,
  },
  {
    question: `Can I request proof photos and gated entry logs in ${cityName}?`,
    answer: `Absolutely. Each visit ends with proof-of-service photos, locked gate confirmation, and timestamped logs so property managers and pet parents have a clean audit trail.`,
  },
];

export async function generateStaticParams() {
  if (process.env.GENERATE_STATIC_PARAMS !== "true") {
    return [];
  }
  const citySlugs = getCitySlugs();
  return citySlugs.map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({ params }: CityPageProps) {
  const { slug } = await params;
  const city = getCityData(slug);

  if (!city) {
    return {
      title: "City Not Found | InsightScoop",
      description: "The requested city page could not be found.",
    };
  }

  return {
    title: city.seo.title,
    description: city.seo.description,
    keywords: city.seo.keywords.join(", "),
    openGraph: {
      title: city.seo.title,
      description: city.seo.description,
      type: "website",
      url: `https://www.getinsightscoop.com/city/${city.name}`,
    },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { slug } = await params;
  const city = getCityData(slug);

  if (!city) {
    notFound();
  }

  const neighborhoodsDetailed = getNeighborhoodDetails(city);
  const faqs = city.faqs ?? defaultFaqs(city.displayName);
  const stats = city.stats ?? fallbackStats(city);

  const structuredDataPayload = {
    city: city.displayName,
    state: city.state,
    description: city.description,
    population: city.population,
    zipCodes: city.zipCodes,
    neighborhoods: neighborhoodsDetailed.map((n) => n.name),
    areaServed: city.serviceAreas,
    geo: city.geo,
    faqs,
    reviewSummary: city.reviewSummary,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <AnimatedHeader />

      <main>
        {/* Hero Section with Dog Background */}
        <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
          {/* Background Image - Light Mode */}
          <div className="absolute inset-0 dark:hidden">
            <Image
              src="/hero_backgrounds/retriever_teal_left_light.jpeg"
              alt="Golden retriever in a clean yard"
              fill
              className="object-cover object-center"
              priority
            />
            {/* Dark gradient overlay for white text readability in light mode */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/60 to-slate-900/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-slate-900/50" />
          </div>
          {/* Background Image - Dark Mode */}
          <div className="absolute inset-0 hidden dark:block">
            <Image
              src="/hero_backgrounds/retriever_teal_left_dark.jpeg"
              alt="Golden retriever in a clean yard"
              fill
              className="object-cover object-center"
              priority
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/40" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 container mx-auto px-6 py-20 text-center space-y-6 drop-shadow-[0_20px_45px_rgba(0,0,0,0.35)] dark:drop-shadow-[0_20px_45px_rgba(0,0,0,0.65)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/90 backdrop-blur dark:border-white/20 dark:bg-black/40">
              <Sparkles className="h-4 w-4 text-[#f3a433]" />
              {city.tagline ?? "AI-powered dog waste removal"}
            </div>
            <h1 className="font-serif text-[clamp(2.8rem,5vw,4.5rem)] leading-[1.05] text-white">
              {city.displayName}, Minnesota
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-white/90 leading-relaxed">
              {city.description}
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-white/85">
              <div className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-[#f3a433]" />
                {city.population.toLocaleString()} residents served
              </div>
              <div className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#f3a433]" />
                {city.zipCodes.length} ZIP codes covered
              </div>
              <div className="inline-flex items-center gap-2">
                <Star className="h-4 w-4 text-[#f3a433]" />
                {city.reviewSummary?.rating ? `${city.reviewSummary.rating.toFixed(1)}★ avg rating` : "AI wellness insights included"}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Button
                asChild
                className="h-12 rounded-full bg-[#f3a433] px-8 text-base font-semibold text-black shadow-[0_20px_45px_rgba(243,164,51,0.45)] hover:bg-[#f5b249]"
              >
                <Link href="/quote?businessId=yardura">
                  Get a custom quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-white/55 bg-white/90 px-6 text-base font-semibold text-[#1c1209] shadow-[0_12px_30px_rgba(0,0,0,0.2)] hover:bg-white dark:border-white dark:bg-transparent dark:text-white dark:hover:bg-white/15"
                asChild
              >
                <a href="tel:1-877-417-YARD">
                  <Phone className="mr-2 h-4 w-4" /> Call {city.localBusiness.phone}
                </a>
              </Button>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-6 py-16 space-y-16">

          <section className="grid gap-6 md:grid-cols-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="rounded-[28px] border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-800/80">
                <CardContent className="p-6 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/70">{stat.label}</p>
                  <p className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-slate-600 leading-relaxed dark:text-white/75">
                    InsightScoop technicians log pickups and capture AI stool summaries each visit.
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card className="rounded-[32px] border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-800/80">
              <CardHeader>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-white/70">What sets us apart</p>
                <CardTitle className="mt-2 font-serif text-[clamp(1.5rem,3vw,2rem)] leading-tight text-slate-900 dark:text-white">
                  Why InsightScoop wins in {city.displayName}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-left">
                {(city.insightHighlights ?? [
                  "Every pickup is logged automatically—no fumbling with phones in Minnesota winters.",
                  "Our AI captures and analyzes stool samples each visit, giving you actionable health insights to share with your vet.",
                  "Required gate, proof-of-gear, and sanitation photos keep HOA boards and property managers confident in weekly service.",
                ]).map((highlight, index) => (
                  <div key={index} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-[#f3a433]" />
                    <p className="text-sm text-slate-700 leading-relaxed dark:text-white/85">{highlight}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-[32px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-xl dark:border-white/10 dark:from-emerald-900/80 dark:to-emerald-950/90">
              <CardHeader>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-700 dark:text-white/70">What you get</p>
                <CardTitle className="mt-2 font-serif text-xl text-emerald-900 dark:text-white">Service Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-emerald-800 dark:text-white/90">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 flex-shrink-0 text-[#f3a433]" />
                  <p>Licensed, insured techs with concierge scheduling for gated yards and condos.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Leaf className="h-5 w-5 flex-shrink-0 text-[#f3a433]" />
                  <p>Eco-minded disposal with compost diversion pilots near creeks and watersheds.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 flex-shrink-0 text-[#f3a433]" />
                  <p>Real-time arrival alerts and end-of-visit recaps via SMS or email—your choice.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="h-5 w-5 flex-shrink-0 text-[#f3a433]" />
                  <p>AI-generated InsightSummaries flag changes to share with your vet before symptoms escalate.</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Compass className="h-6 w-6 text-brand-accent" />
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Explore Neighborhoods</h2>
            </div>
            <p className="max-w-3xl text-slate-700 dark:text-slate-300">
              Tailor InsightScoop to the way your block lives—lakefront backyards, river-adjacent trails, or historic alley access. Choose a neighborhood to see tailored tips and AI monitoring focus areas.
            </p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {neighborhoodsDetailed.map((neighborhood) => (
                <Card
                  key={neighborhood.slug}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-brand-100/0 transition-all duration-300 group-hover:from-brand-50/60 group-hover:to-brand-100/30 dark:group-hover:from-brand-900/20 dark:group-hover:to-brand-800/10" />
                  <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center justify-between text-lg font-bold text-slate-900 dark:text-white">
                      {neighborhood.name}
                      <ArrowRight className="h-4 w-4 text-brand-accent" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">
                      {neighborhood.description}
                    </p>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Insight focus
                      </p>
                      <ul className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                        {neighborhood.insightFocus.map((focus) => (
                          <li key={focus} className="flex items-start gap-2">
                            <ClipboardList className="h-4 w-4 flex-shrink-0 text-brand-accent" />
                            <span>{focus}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Pro tips
                      </p>
                      <ul className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                        {neighborhood.localTips.map((tip) => (
                          <li key={tip} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {neighborhood.outboundLinks?.length ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          Helpful resources
                        </p>
                        <ul className="space-y-2 text-sm text-brand-700 dark:text-brand-300">
                          {neighborhood.outboundLinks.map((link) => (
                            <li key={link.url}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                              >
                                {link.label}
                                <ArrowUpRight className="h-4 w-4" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <Link
                      href={`/city/${city.name}/${neighborhood.slug}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep hover:text-brand-coral transition-colors dark:text-brand-300 dark:hover:text-brand-coral"
                    >
                      View Neighborhood Guide
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {city.outboundLinks?.length ? (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-brand-accent" />
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">Local expertise + credible sources</h2>
              </div>
              <p className="max-w-3xl text-slate-700 dark:text-slate-300">
                We plug into trusted municipal, veterinary, and environmental partners so every recommendation is rooted in data and best practices.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {city.outboundLinks.map((link) => (
                  <Card key={link.url} className="rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800/50">
                    <CardContent className="flex flex-col gap-3 p-6">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-base font-semibold text-brand-deep underline-offset-4 hover:underline hover:text-brand-coral transition-colors dark:text-brand-300"
                      >
                        {link.label}
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                      {link.description ? (
                        <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{link.description}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Frequently asked questions</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <Card key={faq.question} className="rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                      {faq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {city.nearbyCities?.length ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Nearby InsightScoop cities</h2>
              <div className="flex flex-wrap gap-3">
                {city.nearbyCities.map((nearby) => (
                  <Link
                    key={nearby}
                    href={`/city/${nearby}`}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-deep hover:bg-brand-50 hover:border-brand-accent transition-colors shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-brand-300 dark:hover:bg-slate-700"
                  >
                    {getCityData(nearby)?.displayName ?? nearby}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-brand-accent" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Recommended insights</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {INSIGHT_ARTICLES.slice(0, 2).map((article) => (
                <Card key={article.slug} className="rounded-3xl border border-slate-200 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                      {article.title}
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{article.excerpt}</p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>{article.readingTime}</span>
                    <Link href={`/insights/${article.slug}`} className="text-brand-deep font-semibold hover:text-brand-coral transition-colors dark:text-brand-300">
                      Read →
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/80 p-10 text-center shadow-xl dark:border-brand-800 dark:from-brand-900/50 dark:to-brand-800/30">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">
              Ready for an InsightScoop walkthrough?
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-700 dark:text-slate-300">
              We build repeatable visit flows—automated logging, AI health analysis, proof-of-sanitization photos—so your household gets a concierge-level experience every single time.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/quote?businessId=yardura">
                <Button size="lg" className="rounded-2xl px-8 py-6 text-lg shadow-lg hover:shadow-xl bg-brand-coral hover:bg-brand-coral/90 text-white">
                  Schedule your first visit
                </Button>
              </Link>
              <a
                href="mailto:hello@insightscoop.ai"
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-400 bg-white px-8 py-6 text-lg font-semibold text-slate-800 hover:bg-slate-50 shadow-md transition dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                ✉️ Email our dispatch team
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <StructuredData type="city" data={structuredDataPayload} />
    </div>
  );
}
