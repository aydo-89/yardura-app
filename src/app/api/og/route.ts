import { NextRequest } from 'next/server';
import {
  generateHomepageOG,
  generateQuoteOG,
  generateInsightsOG,
  generateFactsOG,
  generateCustomOGImage,
  type OGImageOptions,
} from '@/lib/og-image';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get('type') as 'homepage' | 'insights' | 'quote' | 'facts' | null;
  const title = searchParams.get('title');
  const subtitle = searchParams.get('subtitle');

  try {
    let imageResponse;

    switch (type) {
      case 'homepage':
        imageResponse = await generateHomepageOG();
        break;

      case 'quote':
        imageResponse = await generateQuoteOG();
        break;

      case 'insights':
        if (!title) {
          return new Response('Title parameter required for insights type', { status: 400 });
        }
        imageResponse = await generateInsightsOG(title, subtitle || undefined);
        break;

      case 'facts':
        imageResponse = await generateFactsOG();
        break;

      default:
        // Custom OG image with full options
        if (!title) {
          return new Response('Title parameter required', { status: 400 });
        }

        const customOptions: OGImageOptions = {
          title,
          subtitle: subtitle || undefined,
          type: type || 'homepage',
        };

        imageResponse = await generateCustomOGImage(customOptions);
    }

    return imageResponse;
  } catch (error) {
    console.error('OG Image generation error:', error);

    // Fallback to a simple text-based image
    return new Response(
      `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#059669"/>
        <text x="600" y="300" text-anchor="middle" fill="white" font-size="48" font-weight="bold">
          ${title || 'Yardura'}
        </text>
        <text x="600" y="360" text-anchor="middle" fill="#d1fae5" font-size="24">
          ${subtitle || 'Dog Waste Removal Services'}
        </text>
      </svg>
      `,
      {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  }
}

