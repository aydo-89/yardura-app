'use client';

import { usePathname } from 'next/navigation';

interface ArticleData {
  title: string;
  excerpt?: string;
  author: string;
  date?: string;
  publishDate?: string;
  modifiedDate?: string;
  image?: string;
}

interface ServiceData {
  name: string;
  description: string;
  priceRange?: string;
  areaServed?: string[];
}

interface StructuredDataProps {
  type?: 'homepage' | 'quote' | 'service' | 'article';
  data?: ArticleData | ServiceData | Record<string, unknown>;
}

export default function StructuredData({ type = 'homepage', data }: StructuredDataProps) {
  const pathname = usePathname();

  const getStructuredData = () => {
    // Enhanced LocalBusiness schema with comprehensive local data
    const localBusinessData = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Yardura',
      description:
        'Tech-enabled, eco-friendly dog waste removal with smart health insights. Serving Minneapolis, Richfield, Edina & Bloomington.',
      url: 'https://www.yardura.com',
      telephone: '+18889159273',
      email: 'hello@yardura.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Minneapolis',
        addressRegion: 'MN',
        postalCode: '55417',
        addressCountry: 'US',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 44.9778,
        longitude: -93.265,
      },
      areaServed: [
        {
          '@type': 'City',
          name: 'Minneapolis',
          addressRegion: 'MN',
        },
        {
          '@type': 'City',
          name: 'Richfield',
          addressRegion: 'MN',
        },
        {
          '@type': 'City',
          name: 'Edina',
          addressRegion: 'MN',
        },
        {
          '@type': 'City',
          name: 'Bloomington',
          addressRegion: 'MN',
        },
      ],
      openingHours: 'Mo-Fr 08:00-18:00',
      priceRange: '$$',
      image: 'https://www.yardura.com/modern_yard.png',
      logo: 'https://www.yardura.com/logo.png',
      sameAs: [
        'https://www.facebook.com/yardura',
        'https://www.instagram.com/yardura',
        'https://www.linkedin.com/company/yardura',
      ],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Minneapolis Dog Waste Removal Services',
        itemListElement: [
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Weekly Dog Waste Removal Minneapolis',
              description:
                'Professional weekly dog waste removal in Minneapolis starting at $20/visit',
            },
            priceRange: '$20-$35',
            availability: 'https://schema.org/InStock',
            areaServed: {
              '@type': 'City',
              name: 'Minneapolis',
              addressRegion: 'MN',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Bi-Weekly Dog Waste Removal Minneapolis',
              description:
                'Professional bi-weekly dog waste removal in Minneapolis with 5% discount',
            },
            priceRange: '$19-$33',
            availability: 'https://schema.org/InStock',
            areaServed: {
              '@type': 'City',
              name: 'Minneapolis',
              addressRegion: 'MN',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Eco-Friendly Dog Waste Disposal Minneapolis',
              description: 'Landfill-diverting dog waste disposal through composting programs',
            },
            priceRange: '$20-$35',
            availability: 'https://schema.org/InStock',
            areaServed: {
              '@type': 'City',
              name: 'Minneapolis',
              addressRegion: 'MN',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Dog Health Insights Minneapolis',
              description: 'AI-powered stool analysis for early health monitoring (non-diagnostic)',
            },
            priceRange: '$0 (included)',
            availability: 'https://schema.org/InStock',
            areaServed: {
              '@type': 'City',
              name: 'Minneapolis',
              addressRegion: 'MN',
            },
          },
        ],
      },
    };

    // WebSite + SearchAction for sitelinks
    const websiteData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Yardura',
      url: 'https://www.yardura.com',
      description:
        'Minneapolis dog waste removal with eco-friendly disposal and AI health insights',
      publisher: {
        '@type': 'LocalBusiness',
        name: 'Yardura',
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://www.yardura.com/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
      inLanguage: 'en-US',
    };

    // Organization schema for brand authority
    const organizationData = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Yardura',
      url: 'https://www.yardura.com',
      logo: 'https://www.yardura.com/logo.png',
      description: 'Tech-enabled, eco-friendly dog waste removal service in Minneapolis',
      foundingDate: '2024',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+18889159273',
        contactType: 'customer service',
        areaServed: ['US-MN'],
        availableLanguage: 'English',
      },
      sameAs: [
        'https://www.facebook.com/yardura',
        'https://www.instagram.com/yardura',
        'https://www.linkedin.com/company/yardura',
      ],
    };

    // BreadcrumbList for navigation
    const breadcrumbData =
      pathname !== '/'
        ? {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: 'https://www.yardura.com',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name:
                  pathname === '/quote'
                    ? 'Get Quote'
                    : pathname === '/insights'
                      ? 'Health Insights'
                      : pathname === '/facts'
                        ? 'Service Facts'
                        : pathname.replace('/', '').replace('-', ' '),
                item: `https://www.yardura.com${pathname}`,
              },
            ],
          }
        : null;

    // FAQPage for rich results (homepage only)
    const faqData =
      type === 'homepage'
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How much does dog waste removal cost in Minneapolis?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Weekly dog waste removal starts at $20 per visit, with bi-weekly service available at $19 per visit. Pricing depends on yard size (small: <2,500 sq ft, medium: 2,500-5,000 sq ft, large: 5,000-10,000 sq ft) and number of dogs.',
                },
              },
              {
                '@type': 'Question',
                name: 'What areas do you serve in the Twin Cities?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "We serve South Minneapolis, Richfield, Edina, and Bloomington. We're expanding to additional Twin Cities neighborhoods. Contact us for service availability in your area.",
                },
              },
              {
                '@type': 'Question',
                name: 'Do you offer eco-friendly dog waste disposal?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes! We divert waste from landfills through composting programs where permitted, reducing methane emissions by up to 50 metric tons CO2 equivalent per dog per year.',
                },
              },
              {
                '@type': 'Question',
                name: 'What are your AI health insights?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "Our 3 C's analysis tracks Color, Consistency, and Content changes in your dog's waste. This helps identify potential health issues early. All insights are informational only and do not constitute veterinary advice.",
                },
              },
              {
                '@type': 'Question',
                name: 'How often should I schedule dog waste removal?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Weekly service is recommended for most households. Bi-weekly service is available with a 5% discount and works well for smaller yards or fewer dogs. We can customize schedules based on your specific needs.',
                },
              },
            ],
          }
        : null;

    // Article schema for insights pages
    const articleData =
      type === 'article'
        ? {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: (data as ArticleData)?.title || 'Dog Health Insights',
            description: (data as ArticleData)?.excerpt || 'Professional insights on dog health and waste analysis',
            author: {
              '@type': 'Person',
              name: (data as ArticleData)?.author || 'Yardura Team',
            },
            publisher: {
              '@type': 'Organization',
              name: 'Yardura',
              logo: {
                '@type': 'ImageObject',
                url: 'https://www.yardura.com/logo.png',
              },
            },
            datePublished: (data as ArticleData)?.date || (data as ArticleData)?.publishDate || '2024-01-15',
            dateModified: (data as ArticleData)?.date || (data as ArticleData)?.modifiedDate || '2024-01-15',
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `https://www.yardura.com${pathname}`,
            },
          }
        : null;

    return [
      localBusinessData,
      websiteData,
      organizationData,
      ...(breadcrumbData ? [breadcrumbData] : []),
      ...(faqData ? [faqData] : []),
      ...(articleData ? [articleData] : []),
    ];
  };

  const structuredData = getStructuredData();

  return (
    <>
      {structuredData.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(data, null, 0), // Minified for production
          }}
        />
      ))}
    </>
  );
}
