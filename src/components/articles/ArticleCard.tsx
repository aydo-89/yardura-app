import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, User, ArrowRight } from "lucide-react";
import { Article } from "@/lib/articles";
import { cn } from "@/lib/utils";

interface ArticleCardProps {
  article: Article;
  variant?: "default" | "featured" | "compact";
  className?: string;
}

export default function ArticleCard({
  article,
  variant = "default",
  className,
}: ArticleCardProps) {
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";

  return (
    <article
      className={cn(
        "group bg-white border border-accent/10 rounded-xl overflow-hidden shadow-soft hover:shadow-lg transition-all duration-300",
        isFeatured && "md:flex",
        isCompact && "flex flex-col",
        className,
      )}
    >
      {/* Featured Image */}
      <div
        className={cn(
          "relative overflow-hidden",
          isFeatured ? "md:w-1/2 aspect-video" : "aspect-video",
          isCompact && "aspect-square",
        )}
      >
        <Image
          src={`/api/og?type=insights&title=${encodeURIComponent(article.title)}&subtitle=${encodeURIComponent(article.excerpt)}`}
          alt={article.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Category Badge */}
        <div className="absolute top-4 left-4">
          <span
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
              "bg-white/90 backdrop-blur-sm text-gray-900",
            )}
          >
            {article.category.name}
          </span>
        </div>

        {/* Reading Time */}
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-sm">
            <Clock className="size-3" />
            {article.readingTime} min
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "p-6",
          isFeatured && "md:w-1/2 md:flex md:flex-col md:justify-between",
          isCompact && "p-4 flex-1",
        )}
      >
        {/* Meta Information */}
        <div className="flex items-center gap-4 text-sm text-muted mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="size-4" />
            {new Date(article.publishedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <div className="flex items-center gap-1">
            <User className="size-4" />
            {article.author.name}
          </div>
        </div>

        {/* Title */}
        <h3
          className={cn(
            "font-bold text-ink mb-3 group-hover:text-accent transition-colors line-clamp-2",
            isCompact ? "text-lg" : "text-xl",
          )}
        >
          <Link href={`/insights/${article.slug}`}>{article.title}</Link>
        </h3>

        {/* Excerpt */}
        {!isCompact && (
          <p className="text-muted mb-4 line-clamp-3">{article.excerpt}</p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {article.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-accent-soft/50 text-accent"
            >
              {tag.name}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="text-xs text-muted">
              +{article.tags.length - 3} more
            </span>
          )}
        </div>

        {/* Read More Link */}
        <div className="flex items-center justify-between">
          <Link
            href={`/insights/${article.slug}`}
            className="inline-flex items-center gap-2 text-accent hover:text-accent/80 font-medium transition-colors"
          >
            Read Article
            <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          {article.featured && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent text-white">
              Featured
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
