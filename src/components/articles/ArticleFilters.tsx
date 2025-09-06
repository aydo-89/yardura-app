import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ARTICLE_CATEGORIES } from '@/lib/articles';

interface ArticleFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (categorySlug: string | null) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: Array<{ id: string; name: string; slug: string }>;
}

export default function ArticleFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedTags,
  onTagsChange,
  availableTags,
}: ArticleFiltersProps) {
  const toggleTag = (tagSlug: string) => {
    if (selectedTags.includes(tagSlug)) {
      onTagsChange(selectedTags.filter((tag) => tag !== tagSlug));
    } else {
      onTagsChange([...selectedTags, tagSlug]);
    }
  };

  const clearFilters = () => {
    onSearchChange('');
    onCategoryChange(null);
    onTagsChange([]);
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedTags.length > 0;

  return (
    <div className="bg-white border border-accent/10 rounded-xl p-6 space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted size-4" />
        <Input
          type="text"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <div>
        <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
          <Filter className="size-4" />
          Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCategoryChange(null)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              !selectedCategory
                ? 'bg-accent text-white'
                : 'bg-accent-soft/50 text-accent hover:bg-accent-soft'
            }`}
          >
            All
          </button>
          {ARTICLE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.slug)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === category.slug
                  ? 'bg-accent text-white'
                  : 'bg-accent-soft/50 text-accent hover:bg-accent-soft'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <h3 className="font-semibold text-ink mb-3">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {availableTags.slice(0, 12).map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.slug)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedTags.includes(tag.slug)
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters & Clear */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-4 border-t border-accent/10">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent-soft/50 rounded-md">
                Search: "{searchQuery}"
                <button onClick={() => onSearchChange('')} className="hover:text-accent">
                  <X className="size-3" />
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent-soft/50 rounded-md">
                {ARTICLE_CATEGORIES.find((cat) => cat.slug === selectedCategory)?.name}
                <button onClick={() => onCategoryChange(null)} className="hover:text-accent">
                  <X className="size-3" />
                </button>
              </span>
            )}
            {selectedTags.length > 0 && (
              <span className="text-accent-soft/70">
                {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="text-accent border-accent hover:bg-accent hover:text-white"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}

