import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', disallow: ['/api/auth/', '/signin'] },
    ],
    sitemap: 'https://www.yardura.com/sitemap.xml',
  }
}




