import React from 'react';
import { Article } from '@/lib/articles';
import ArticleCard from './ArticleCard';

interface ArticleGridProps {
  articles: Article[];
  variant?: 'default' | 'featured' | 'compact';
  columns?: 1 | 2 | 3 | 4;
  showFeatured?: boolean;
  className?: string;
}

export default function ArticleGrid({
  articles,
  variant = 'default',
  columns = 3,
  showFeatured = false,
  className = ''
}: ArticleGridProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted">
          <h3 className="text-lg font-medium mb-2">No articles found</h3>
          <p>Try adjusting your search or browse our categories.</p>
        </div>
      </div>
    );
  }

  // Separate featured articles if requested
  const featuredArticles = showFeatured ? articles.filter(article => article.featured) : [];
  const regularArticles = showFeatured ? articles.filter(article => !article.featured) : articles;

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Featured Articles */}
      {showFeatured && featuredArticles.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-ink">Featured Articles</h2>
          <div className="space-y-6">
            {featuredArticles.map((article) => (
              <ArticleCard
                key={article.slug}
                article={article}
                variant="featured"
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Articles Grid */}
      {regularArticles.length > 0 && (
        <div className="space-y-6">
          {showFeatured && (
            <h2 className="text-2xl font-bold text-ink">
              {featuredArticles.length > 0 ? 'More Articles' : 'All Articles'}
            </h2>
          )}

          <div className={`grid gap-6 ${
            columns === 1 ? 'grid-cols-1' :
            columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
            columns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}>
            {regularArticles.map((article) => (
              <ArticleCard
                key={article.slug}
                article={article}
                variant={variant}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
