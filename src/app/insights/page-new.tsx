"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import Reveal from "@/components/Reveal";
import ArticleGrid from "@/components/articles/ArticleGrid";
import ArticleFilters from "@/components/articles/ArticleFilters";
import { MOCK_ARTICLES, searchArticles, filterArticlesByCategory, filterArticlesByTag, ARTICLE_CATEGORIES } from "@/lib/articles";

export default function InsightsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get all unique tags from articles
  const availableTags = useMemo(() => {
    const tagMap = new Map();
    MOCK_ARTICLES.forEach(article => {
      article.tags.forEach(tag => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag);
        }
      });
    });
    return Array.from(tagMap.values());
  }, []);

  // Filter articles based on current filters
  const filteredArticles = useMemo(() => {
    let articles = MOCK_ARTICLES;

    // Apply search filter
    if (searchQuery) {
      articles = searchArticles(articles, searchQuery);
    }

    // Apply category filter
    if (selectedCategory) {
      articles = filterArticlesByCategory(articles, selectedCategory);
    }

    // Apply tag filters
    if (selectedTags.length > 0) {
      articles = selectedTags.reduce((filtered, tagSlug) => {
        return filterArticlesByTag(filtered, tagSlug);
      }, articles);
    }

    return articles;
  }, [searchQuery, selectedCategory, selectedTags]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20 py-12 px-4">
      <div className="container max-w-7xl">
        {/* Header */}
        <Reveal>
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold text-ink mb-4">
              Dog Health & Eco Insights
            </h1>
            <p className="text-lg text-muted max-w-3xl mx-auto">
              Expert insights on dog health, eco-friendly waste management, and Minneapolis pet care.
              Professional dog waste removal tips and local Twin Cities resources.
            </p>
          </div>
        </Reveal>

        {/* Filters */}
        <Reveal delay={0.1}>
          <div className="mb-8">
            <ArticleFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              availableTags={availableTags}
            />
          </div>
        </Reveal>

        {/* Article Grid */}
        <Reveal delay={0.2}>
          <ArticleGrid
            articles={filteredArticles}
            columns={3}
            showFeatured={true}
          />
        </Reveal>

        {/* Results Summary */}
        {filteredArticles.length !== MOCK_ARTICLES.length && (
          <Reveal delay={0.3}>
            <div className="mt-8 text-center">
              <p className="text-muted">
                Showing {filteredArticles.length} of {MOCK_ARTICLES.length} articles
                {(searchQuery || selectedCategory || selectedTags.length > 0) && (
                  <span className="ml-2">
                    {searchQuery && `for "${searchQuery}"`}
                    {selectedCategory && ` in ${ARTICLE_CATEGORIES.find(cat => cat.slug === selectedCategory)?.name}`}
                    {selectedTags.length > 0 && ` with ${selectedTags.length} tag filter${selectedTags.length !== 1 ? 's' : ''}`}
                  </span>
                )}
              </p>
            </div>
          </Reveal>
        )}

        {/* Call to Action */}
        <Reveal delay={0.4}>
          <div className="mt-16">
            <div className="bg-white border border-accent/10 rounded-xl p-8 text-center">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-ink mb-4">
                  Ready for Professional Dog Waste Removal?
                </h3>
                <p className="text-muted mb-6">
                  Join hundreds of Minneapolis dog owners who trust Yardura for eco-friendly,
                  professional dog waste removal with health insights.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" asChild>
                    <a href="/quote" data-analytics="cta_quote">
                      Get My Quote
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <a href="/facts">
                      Learn More
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
