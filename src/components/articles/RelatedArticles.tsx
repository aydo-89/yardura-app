import React from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { Article } from "@/lib/articles";

interface RelatedArticlesProps {
  articles: Article[];
  className?: string;
}

export default function RelatedArticles({
  articles,
  className = "",
}: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <div
      className={`bg-white border border-accent/10 rounded-xl p-6 ${className}`}
    >
      <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-4 bg-accent rounded-full"></span>
        Related Articles
      </h3>

      <div className="space-y-4">
        {articles.map((article) => (
          <article key={article.slug} className="group">
            <Link href={`/insights/${article.slug}`} className="block">
              <div className="flex gap-4 p-3 rounded-lg hover:bg-accent-soft/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-ink group-hover:text-accent transition-colors line-clamp-2 mb-2">
                    {article.title}
                  </h4>

                  <div className="flex items-center gap-3 text-xs text-muted">
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(article.publishedAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {article.readingTime} min
                    </div>
                  </div>
                </div>

                <ArrowRight className="size-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-accent/10">
        <Link
          href="/insights"
          className="inline-flex items-center gap-2 text-accent hover:text-accent/80 font-medium transition-colors"
        >
          View All Articles
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
