import Link from "next/link";
import { notFound } from "next/navigation";

import AnimatedHeader from "@/components/site/AnimatedHeader";
import Footer from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StructuredData from "@/components/seo/StructuredData";
import { getInsightArticle, INSIGHT_ARTICLES } from "@/data/insightsArticles";

// Keep articles dynamic by default during deploy builds to avoid Next prerender work.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface InsightArticlePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  if (process.env.GENERATE_STATIC_PARAMS !== "true") {
    return [];
  }
  return INSIGHT_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: InsightArticlePageProps) {
  const { slug } = await params;
  const article = getInsightArticle(slug);

  if (!article) {
    return {
      title: "Insight not found | InsightScoop",
      description: "The requested article could not be found.",
    };
  }

  return {
    title: `${article.title} | InsightScoop Wellness Insights`,
    description: article.excerpt,
    keywords: article.tags.join(", "),
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      url: `https://www.getinsightscoop.com/insights/${article.slug}`,
    },
  };
}

export default async function InsightArticlePage({ params }: InsightArticlePageProps) {
  const { slug } = await params;
  const article = getInsightArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-brand-50/20">
      <AnimatedHeader />
      <main className="pb-20 pt-16">
        <div className="container mx-auto px-6 max-w-4xl space-y-10">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/insights" className="text-brand-deep hover:underline">
              Insights
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700">{article.title}</span>
          </nav>

          <header className="space-y-4">
            <Badge variant="outline" className="rounded-full px-4 py-1 text-xs uppercase tracking-[0.3em]">
              {article.tags.join(" · ")}
            </Badge>
            <h1 className="text-4xl font-black text-slate-900">{article.title}</h1>
            <p className="text-base text-slate-600">{article.excerpt}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>By {article.author}</span>
              <span>•</span>
              <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>{article.readingTime}</span>
            </div>
          </header>

          {article.heroImage ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 shadow-lg">
              <img src={article.heroImage} alt={article.title} className="h-full w-full object-cover" />
            </div>
          ) : null}

          <article className="space-y-10 text-base leading-relaxed text-slate-700">
            {article.sections.map((section) => (
              <section key={section.heading} className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-900">{section.heading}</h2>
                {section.body.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
                {section.outboundLinks?.length ? (
                  <Card className="border border-slate-200/70 bg-white/90 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Credible references
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-brand-deep">
                      {section.outboundLinks.map((link) => (
                        <div key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                          >
                            {link.label}
                            <span aria-hidden>↗</span>
                          </a>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </section>
            ))}
          </article>

          <Card className="border border-brand-soft bg-brand-chip/60 shadow-xl">
            <CardContent className="space-y-3 text-center text-sm text-slate-700">
              <h3 className="text-2xl font-black text-slate-900">Key takeaway</h3>
              <p>{article.takeaway}</p>
            </CardContent>
          </Card>

          <section className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">Need a yard assessment?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Schedule InsightScoop for weekly service. Our techs log every pickup, capture InsightCamera samples, and send vet-ready reports.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/quote?businessId=yardura" className="rounded-2xl bg-brand-accent px-5 py-3 text-sm font-semibold text-vanilla">
                Start a quote
              </Link>
              <Link href="/city" className="rounded-2xl border border-brand-soft px-5 py-3 text-sm font-semibold text-brand-deep">
                Explore service areas
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <StructuredData
        type="article"
        data={{
          title: article.title,
          excerpt: article.excerpt,
          author: article.author,
          publishDate: article.publishedAt,
          modifiedDate: article.updatedAt,
          image: article.heroImage,
          tags: article.tags,
        }}
      />
    </div>
  );
}
