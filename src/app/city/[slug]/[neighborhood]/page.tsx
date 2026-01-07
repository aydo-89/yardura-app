import {
  getCityData,
  getCitySlugs,
  getNeighborhoodBySlug,
  getNeighborhoodDetails,
} from "@/lib/cityData";
import AnimatedHeader from "@/components/site/AnimatedHeader";
import Footer from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Compass,
  MapPin,
  CheckCircle,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import StructuredData from "@/components/seo/StructuredData";

// This route can generate a very large number of prerender targets (cities × neighborhoods).
// Keep it dynamic by default so `next build` doesn't stall.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface NeighborhoodPageProps {
  params: Promise<{
    slug: string;
    neighborhood: string;
  }>;
}

const defaultNeighborhoodFaqs = (name: string, city: string) => [
  {
    question: `How often should InsightScoop visit ${name} in ${city}?`,
    answer: `Weekly InsightScoop visits keep ${name} yards guest-ready. Many neighbors add a Friday sweep or Bluetooth quick-log pickup during patio season.`,
  },
  {
    question: `What does the AI InsightCamera look for in ${name}?`,
    answer: `We analyze stool color, consistency, and content, flagging hydration dips, parasites, or diet changes so you can loop in your vet without guessing.`,
  },
  {
    question: `Do you capture proof-of-service photos in ${name}?`,
    answer: `Yes. Every visit ends with proof of gear, locked gate confirmation, and sanitation photos so HOA boards and landlords see the audit trail.`,
  },
];

export async function generateStaticParams() {
  if (process.env.GENERATE_STATIC_PARAMS !== "true") {
    return [];
  }
  const params: Array<{ slug: string; neighborhood: string }> = [];
  const slugs = getCitySlugs();

  slugs.forEach((citySlug) => {
    const city = getCityData(citySlug);
    if (!city) return;
    const neighborhoods = getNeighborhoodDetails(city);
    neighborhoods.forEach((neighborhood) => {
      params.push({ slug: citySlug, neighborhood: neighborhood.slug });
    });
  });

  return params;
}

export async function generateMetadata({ params }: NeighborhoodPageProps) {
  const { slug, neighborhood } = await params;
  const data = getNeighborhoodBySlug(slug, neighborhood);

  if (!data) {
    return {
      title: "Neighborhood Not Found | InsightScoop",
      description: "The requested neighborhood playbook could not be found.",
    };
  }

  const { city, neighborhood: detail } = data;

  const title = detail.seo?.title ?? `${detail.name} Dog Waste Removal | InsightScoop ${city.displayName}`;
  const description =
    detail.seo?.description ??
    `InsightScoop keeps ${detail.name} yards in ${city.displayName} clean with AI stool monitoring, Bluetooth logging, and proof-of-service photos.`;

  return {
    title,
    description,
    keywords: detail.seo?.keywords?.join(", "),
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://www.getinsightscoop.com/city/${city.name}/${detail.slug}`,
    },
  };
}

export default async function NeighborhoodPage({ params }: NeighborhoodPageProps) {
  const { slug, neighborhood } = await params;
  const data = getNeighborhoodBySlug(slug, neighborhood);

  if (!data) {
    notFound();
  }

  const { city, neighborhood: detail } = data;
  const faqs = defaultNeighborhoodFaqs(detail.name, city.displayName);

  const structuredDataPayload = {
    city: city.displayName,
    state: city.state,
    description: detail.description,
    neighborhoods: [detail.name],
    areaServed: [detail.name, ...city.serviceAreas],
    faqs,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/20">
      <AnimatedHeader />

      <main className="py-20">
        <div className="container mx-auto px-6 space-y-16">
          <nav className="flex items-center gap-2 text-sm text-slate-600">
            <Link href="/city" className="inline-flex items-center gap-1 text-brand-deep hover:underline font-medium">
              <ArrowLeft className="h-4 w-4" /> All service cities
            </Link>
            <span>/</span>
            <Link href={`/city/${city.name}`} className="text-brand-deep hover:underline font-medium">
              {city.displayName}
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900">{detail.name}</span>
          </nav>

          <section className="space-y-6">
            <Badge variant="outline" className="w-fit rounded-full px-4 py-1 text-xs uppercase tracking-[0.2em] border-slate-300 text-slate-700">
              Neighborhood playbook
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              InsightScoop in {detail.name}, {city.displayName}
            </h1>
            <p className="max-w-3xl text-lg text-slate-700 leading-relaxed">
              {detail.description}
            </p>
            <div className="flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm">
                <MapPin className="h-4 w-4 text-brand-accent" />
                {city.displayName}, Minnesota
              </span>
              <Link
                href={`/city/${city.name}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-deep hover:bg-brand-50 hover:border-brand-accent transition-colors shadow-sm"
              >
                Back to city overview
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <Compass className="h-5 w-5 text-brand-accent" />
                  Route strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700 leading-relaxed">
                {detail.insightFocus.map((focus) => (
                  <div key={focus} className="flex items-start gap-2">
                    <ClipboardList className="h-4 w-4 flex-shrink-0 text-brand-accent" />
                    <span>{focus}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-slate-200 bg-gradient-to-br from-brand-50 to-brand-100/80 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900">Pro tips from the field</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-800">
                {detail.localTips.map((tip) => (
                  <div key={tip} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <span>{tip}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {detail.outboundLinks?.length ? (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-brand-accent" />
                <h2 className="text-2xl font-black text-slate-900">Trusted local resources</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {detail.outboundLinks.map((link) => (
                  <Card key={link.url} className="rounded-3xl border border-slate-200 bg-white shadow-lg">
                    <CardContent className="p-6">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep underline-offset-4 hover:underline hover:text-brand-coral transition-colors"
                      >
                        {link.label}
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900">Neighborhood FAQs</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <Card key={faq.question} className="rounded-3xl border border-slate-200 bg-white shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {faq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700 leading-relaxed">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/80 p-8 text-center shadow-xl">
            <h3 className="text-2xl font-black text-slate-900">Ready for concierge-level weekly visits?</h3>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-700">
              Pair InsightScoop's Bluetooth logging and AI stool insights with neighborhood-tailored schedules so your block stays spotless year-round.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/quote?businessId=yardura">
                <Button className="rounded-2xl px-7 py-5 text-base shadow-lg hover:shadow-xl bg-brand-coral hover:bg-brand-coral/90 text-white">
                  Get your InsightScoop plan
                </Button>
              </Link>
              <a
                href="mailto:hello@insightscoop.ai"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-400 bg-white px-7 py-5 text-base font-semibold text-slate-800 hover:bg-slate-50 shadow-md transition"
              >
                ✉️ Email dispatch
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <StructuredData type="neighborhood" data={structuredDataPayload} />
    </div>
  );
}
