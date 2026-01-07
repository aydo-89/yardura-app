import Link from "next/link";

import AnimatedHeader from "@/components/site/AnimatedHeader";
import Footer from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StructuredData from "@/components/seo/StructuredData";
import { INSIGHT_ARTICLES } from "@/data/insightsArticles";

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/20">
      <AnimatedHeader />
      <main className="pb-20 pt-16">
        <div className="container mx-auto px-6 space-y-12">
          <section className="text-center space-y-4">
            <Badge variant="outline" className="rounded-full px-4 py-1 text-xs uppercase tracking-[0.3em]">
              InsightScoop Knowledge Base
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900">
              AI-powered pet wellness insights
            </h1>
            <p className="mx-auto max-w-2xl text-base text-slate-600">
              We translate field data, veterinarian guidance, and InsightCamera analytics into actionable resources for Minnesota dog parents.
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {INSIGHT_ARTICLES.map((article) => (
              <Card
                key={article.slug}
                className="group flex h-full flex-col overflow-hidden border border-slate-200/70 bg-white/85 backdrop-blur shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-accent">
                    {article.tags[0]}
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-900 group-hover:text-brand-deep">
                    {article.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{article.excerpt}</p>
                </CardHeader>
                <CardContent className="mt-auto flex flex-col gap-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{article.readingTime}</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <Link
                    href={`/insights/${article.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep"
                  >
                    Read full guide
                    <span aria-hidden>→</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="rounded-3xl border border-brand-soft bg-brand-chip/60 p-10 text-center shadow-xl">
            <h2 className="text-2xl font-black text-slate-900">Need AI stool insights for your yard?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-700">
              Schedule InsightScoop. We handle the pickup, capture InsightCamera samples, and send digestible summaries you can share with your vet.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/quote?businessId=yardura"
                className="rounded-2xl bg-brand-accent px-7 py-4 text-sm font-semibold text-vanilla shadow-lg hover:shadow-xl"
              >
                Book InsightScoop
              </Link>
              <a
                href="mailto:hello@insightscoop.ai"
                className="rounded-2xl border-2 border-brand-soft px-7 py-4 text-sm font-semibold text-slate-700 hover:bg-brand-chip"
              >
                Ask our wellness team
              </a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <StructuredData type="article" data={{
        title: "InsightScoop AI-powered pet wellness insights",
        excerpt:
          "Guides on stool color changes, sanitation best practices, and AI monitoring—all tailored to Minnesota dog parents.",
        author: "InsightScoop",
        publishDate: "2024-09-18",
        image: "/insights/stool-color-guide.png",
        tags: ["Wellness", "Operations"],
      }} />
    </div>
  );
}
