// Article data types and utilities for the insights blog system

export interface ArticleAuthor {
  name: string;
  bio?: string;
  avatar?: string;
  credentials?: string[];
}

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
}

export interface ArticleTag {
  id: string;
  name: string;
  slug: string;
}

export interface ArticleMetadata {
  title: string;
  description: string;
  excerpt: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  readingTime: number;
  featured: boolean;
  category: ArticleCategory;
  tags: ArticleTag[];
  author: ArticleAuthor;
  ogImage?: string;
  keywords?: string[];
  relatedArticles?: string[]; // slugs of related articles
}

export interface Article extends ArticleMetadata {
  content: string; // MDX content
  tableOfContents?: TableOfContentsItem[];
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
  children?: TableOfContentsItem[];
}

// Article categories
export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  {
    id: 'health',
    name: 'Dog Health',
    slug: 'health',
    description: 'Articles about dog health, wellness, and preventive care',
    color: 'text-emerald-600',
  },
  {
    id: 'behavior',
    name: 'Dog Behavior',
    slug: 'behavior',
    description: 'Understanding and improving dog behavior patterns',
    color: 'text-blue-600',
  },
  {
    id: 'nutrition',
    name: 'Nutrition',
    slug: 'nutrition',
    description: 'Dog nutrition, diet, and feeding guidelines',
    color: 'text-orange-600',
  },
  {
    id: 'training',
    name: 'Training',
    slug: 'training',
    description: 'Dog training tips, techniques, and best practices',
    color: 'text-purple-600',
  },
  {
    id: 'environment',
    name: 'Environment',
    slug: 'environment',
    description: 'Environmental impact and eco-friendly pet care',
    color: 'text-green-600',
  },
  {
    id: 'services',
    name: 'Pet Services',
    slug: 'services',
    description: 'Professional pet care services and industry insights',
    color: 'text-indigo-600',
  },
];

// Authors
export const ARTICLE_AUTHORS: Record<string, ArticleAuthor> = {
  'dr-sarah-johnson': {
    name: 'Dr. Sarah Johnson',
    bio: 'Veterinarian with 15+ years experience in small animal medicine, specializing in preventive care and nutrition.',
    credentials: ['DVM', 'MS', 'Diplomate ACVN'],
  },
  'dr-michael-chen': {
    name: 'Dr. Michael Chen',
    bio: 'Board-certified veterinary behaviorist and author of "The Modern Dog\'s Guide to Wellness".',
    credentials: ['DVM', 'DACVB', 'MS'],
  },
  'lisa-rodriguez': {
    name: 'Lisa Rodriguez',
    bio: 'Certified Professional Dog Trainer and founder of Twin Cities Dog Training Academy.',
    credentials: ['CPDT-KA', 'CBCC-KA'],
  },
  'mark-thompson': {
    name: 'Mark Thompson',
    bio: 'Environmental scientist specializing in sustainable pet waste management and urban ecology.',
    credentials: ['PhD Environmental Science', 'MS Biology'],
  },
  'emily-davis': {
    name: 'Emily Davis',
    bio: 'Pet nutritionist and founder of Minneapolis Holistic Pet Nutrition.',
    credentials: ['MS Animal Nutrition', 'CPN'],
  },
};

// Utility functions
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200; // Average reading speed
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export function generateExcerpt(content: string, maxLength: number = 160): string {
  // Remove markdown formatting and get plain text
  const plainText = content
    .replace(/[#*`~\[\]()]/g, '') // Remove markdown symbols
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (plainText.length <= maxLength) return plainText;

  return plainText.substring(0, maxLength).trim() + '...';
}

export function generateTableOfContents(content: string): TableOfContentsItem[] {
  const lines = content.split('\n');
  const toc: TableOfContentsItem[] = [];
  const stack: TableOfContentsItem[] = [];

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const item: TableOfContentsItem = { id, text, level };

      // Find the appropriate parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        toc.push(item);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent.children) parent.children = [];
        parent.children.push(item);
      }

      stack.push(item);
    }
  });

  return toc;
}

export function getRelatedArticles(
  currentSlug: string,
  allArticles: Article[],
  limit: number = 3
): Article[] {
  return allArticles
    .filter((article) => article.slug !== currentSlug)
    .sort((a, b) => {
      // Prioritize same category
      if (a.category.id === b.category.id) return 0;
      return a.category.id === allArticles.find((art) => art.slug === currentSlug)?.category.id
        ? -1
        : 1;
    })
    .slice(0, limit);
}

export function searchArticles(articles: Article[], query: string): Article[] {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) return articles;

  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchTerm) ||
      article.description.toLowerCase().includes(searchTerm) ||
      article.excerpt.toLowerCase().includes(searchTerm) ||
      article.tags.some((tag) => tag.name.toLowerCase().includes(searchTerm)) ||
      article.category.name.toLowerCase().includes(searchTerm)
  );
}

export function filterArticlesByCategory(articles: Article[], categorySlug: string): Article[] {
  return articles.filter((article) => article.category.slug === categorySlug);
}

export function filterArticlesByTag(articles: Article[], tagSlug: string): Article[] {
  return articles.filter((article) => article.tags.some((tag) => tag.slug === tagSlug));
}

// Mock article data for development
export const MOCK_ARTICLES: Article[] = [
  {
    title: "Dog Poop Color Chart: What Your Dog's Stool Says About Health",
    description:
      "Complete guide to dog stool colors and what they mean for your pet's health. Know when to consult your Minneapolis vet.",
    excerpt:
      'Understanding dog poop colors is crucial for early health detection. Learn what different colors indicate and when to seek veterinary care.',
    slug: 'dog-poop-color-health',
    publishedAt: '2024-01-15T10:00:00.000Z',
    readingTime: 8,
    featured: true,
    category: ARTICLE_CATEGORIES[0], // Health
    tags: [
      { id: '1', name: 'Dog Health', slug: 'dog-health' },
      { id: '2', name: 'Stool Analysis', slug: 'stool-analysis' },
      { id: '3', name: 'Veterinary Care', slug: 'veterinary-care' },
    ],
    author: ARTICLE_AUTHORS['dr-sarah-johnson'],
    keywords: ['dog poop color', 'dog stool health', 'dog digestive health', 'Minneapolis vet'],
    content: `# Dog Poop Color Chart: What Your Dog's Stool Says About Health

Understanding your dog's stool can provide valuable insights into their overall health and well-being. While we're not veterinarians and cannot provide medical advice, this guide will help you recognize what different stool characteristics might indicate.

## Normal Healthy Stool

**Appearance**: Firm, moist, and well-formed logs that are typically chocolate brown in color.

**What it means**: This indicates good digestion, proper hydration, and a balanced diet. The brown color comes from bilirubin breakdown in the digestive process.

## Common Color Variations

### Black or Tarry Stool
**What it might indicate**: Possible upper gastrointestinal bleeding or digested blood. This can occur from ulcers, tumors, or swallowed blood from mouth/nose bleeding.

**Urgency**: Consult your vet promptly, especially if accompanied by lethargy or pale gums.

### Bright Red Blood in Stool
**What it might indicate**: Lower gastrointestinal bleeding, typically from the colon or rectum. Common causes include hemorrhoids, polyps, or colitis.

**Urgency**: Contact your vet within 24 hours if persistent.

### Pale or Gray Stool
**What it might indicate**: Possible liver issues, bile duct obstruction, or pancreatic insufficiency. The lack of bile pigments results in the pale color.

**Urgency**: Schedule a vet visit to rule out serious conditions.

### Yellow or Orange Stool
**What it might indicate**: Excess fat in the diet, gallbladder issues, or rapid intestinal transit. Sometimes seen with certain medications.

**Urgency**: Usually not urgent unless accompanied by other symptoms.

## When to Contact Your Vet

**Immediate veterinary attention** (within 24 hours):
- Black tarry stools
- Bright red blood that persists
- Lethargy or weakness
- Pale gums
- Vomiting or diarrhea lasting >24 hours

**Schedule a vet visit** (within 1 week):
- Consistent color changes lasting >48 hours
- Stool that floats consistently
- Strong, unpleasant odor
- Changes in stool frequency

## Our AI Analysis

At Yardura, we use our 3 C's analysis (Color, Consistency, Content) to monitor stool changes over time. This helps identify subtle changes that might indicate early health issues before they become obvious symptoms.

**Remember**: We're not veterinarians, and this information is for educational purposes only. Always consult your veterinarian for any health concerns about your dog.

## Sources
- American Veterinary Medical Association
- Merck Veterinary Manual
- American Animal Hospital Association`,
    tableOfContents: [
      { id: 'normal-healthy-stool', text: 'Normal Healthy Stool', level: 2 },
      { id: 'common-color-variations', text: 'Common Color Variations', level: 2 },
      { id: 'black-or-tarry-stool', text: 'Black or Tarry Stool', level: 3 },
      { id: 'bright-red-blood-in-stool', text: 'Bright Red Blood in Stool', level: 3 },
      { id: 'pale-or-gray-stool', text: 'Pale or Gray Stool', level: 3 },
      { id: 'yellow-or-orange-stool', text: 'Yellow or Orange Stool', level: 3 },
      { id: 'when-to-contact-your-vet', text: 'When to Contact Your Vet', level: 2 },
      { id: 'our-ai-analysis', text: 'Our AI Analysis', level: 2 },
      { id: 'sources', text: 'Sources', level: 2 },
    ],
  },
  // Add more mock articles as needed
];

export default {
  ARTICLE_CATEGORIES,
  ARTICLE_AUTHORS,
  MOCK_ARTICLES,
  calculateReadingTime,
  generateExcerpt,
  generateTableOfContents,
  getRelatedArticles,
  searchArticles,
  filterArticlesByCategory,
  filterArticlesByTag,
};

