import type { MetadataRoute } from "next";

import { getCitySlugs, getCityData, getNeighborhoodDetails } from "@/lib/cityData";
import { INSIGHT_ARTICLES } from "@/data/insightsArticles";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "https://www.getinsightscoop.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/city`,
      lastModified: new Date(),
      changeFrequency: "weekly",
    },
    {
      url: `${SITE_URL}/insights`,
      lastModified: new Date(),
      changeFrequency: "weekly",
    },
    {
      url: `${SITE_URL}/wellness`,
      lastModified: new Date(),
      changeFrequency: "weekly",
    },
    {
      url: `${SITE_URL}/our-story`,
      lastModified: new Date(),
      changeFrequency: "monthly",
    },
  ];

  const citySlugs = getCitySlugs();
  citySlugs.forEach((slug) => {
    const city = getCityData(slug);
    if (!city) return;
    routes.push({
      url: `${SITE_URL}/city/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
    });
    const neighborhoods = getNeighborhoodDetails(city);
    neighborhoods.forEach((neighborhood) => {
      routes.push({
        url: `${SITE_URL}/city/${slug}/${neighborhood.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
      });
    });
  });

  INSIGHT_ARTICLES.forEach((article) => {
    routes.push({
      url: `${SITE_URL}/insights/${article.slug}`,
      lastModified: new Date(article.updatedAt ?? article.publishedAt),
      changeFrequency: "monthly",
    });
  });

  return routes;
}
