import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { env } from '@/lib/env';
import {
  getChewyProductDetail,
  normalizeChewyProduct,
} from '@/lib/integrations/unwrangle';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

/**
 * GET /api/mobile/customer/food-products/search
 * Search for pet food products from local database with optional Chewy lookup
 *
 * Query params:
 * - q: search query (required)
 * - type: filter by product type (FOOD, TREAT, SUPPLEMENT, MEDICATION)
 * - limit: max results (default 20)
 */
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

  if (!query || query.length < 2) {
    return NextResponse.json({
      ok: true,
      products: [],
      source: 'local',
    });
  }

  // Search local cached products first
  const localProducts = await prisma.petFoodProduct.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
      ],
      ...(type ? { type } : {}),
    },
    orderBy: [{ searchCount: 'desc' }, { name: 'asc' }],
    take: limit,
  });

  // Format results
  const results = localProducts.map((p) => ({
    id: p.id,
    chewyId: p.chewyId,
    name: p.name,
    brand: p.brand,
    type: p.type,
    imageUrl: p.imageUrl,
    price: p.price,
    autoshipPrice: p.autoshipPrice,
    ingredients: p.ingredients,
    lifestage: p.lifestage,
    breedSize: p.breedSize,
    specialDiets: p.specialDiets,
    source: 'local' as const,
  }));

  return NextResponse.json({
    ok: true,
    products: results,
    source: 'local',
    query,
  });
}

/**
 * POST /api/mobile/customer/food-products/search
 * Fetch and cache a specific Chewy product by URL
 *
 * Body:
 * - chewyUrl: The Chewy product URL to fetch
 */
export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  // Check if Unwrangle is configured
  if (!env.UNWRANGLE_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'Product lookup service not configured' },
      { status: 503 },
    );
  }

  let body: { chewyUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { chewyUrl } = body;
  if (!chewyUrl || !chewyUrl.includes('chewy.com')) {
    return NextResponse.json(
      { ok: false, error: 'Valid Chewy URL required' },
      { status: 400 },
    );
  }

  try {
    // Fetch from Unwrangle
    const detail = await getChewyProductDetail(chewyUrl);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: 'Unable to fetch product details' },
        { status: 404 },
      );
    }

    // Normalize the product data
    const normalized = normalizeChewyProduct(detail);

    // Cache in database (upsert by chewyId)
    const cached = await prisma.petFoodProduct.upsert({
      where: { chewyId: normalized.chewyId },
      create: {
        chewyId: normalized.chewyId,
        name: normalized.name,
        brand: normalized.brand,
        type: normalized.type,
        ingredients: normalized.ingredients,
        imageUrl: normalized.imageUrl,
        price: normalized.price,
        autoshipPrice: normalized.autoshipPrice,
        rating: normalized.rating,
        reviewCount: normalized.reviewCount,
        inStock: normalized.inStock,
        lifestage: normalized.lifestage,
        breedSize: normalized.breedSize,
        specialDiets: normalized.specialDiets,
        description: normalized.description,
        chewyUrl,
        searchCount: 1,
      },
      update: {
        name: normalized.name,
        brand: normalized.brand,
        type: normalized.type,
        ingredients: normalized.ingredients,
        imageUrl: normalized.imageUrl,
        price: normalized.price,
        autoshipPrice: normalized.autoshipPrice,
        rating: normalized.rating,
        reviewCount: normalized.reviewCount,
        inStock: normalized.inStock,
        lifestage: normalized.lifestage,
        breedSize: normalized.breedSize,
        specialDiets: normalized.specialDiets,
        description: normalized.description,
        lastFetchedAt: new Date(),
        searchCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      ok: true,
      product: {
        id: cached.id,
        chewyId: cached.chewyId,
        name: cached.name,
        brand: cached.brand,
        type: cached.type,
        imageUrl: cached.imageUrl,
        price: cached.price,
        autoshipPrice: cached.autoshipPrice,
        ingredients: cached.ingredients,
        lifestage: cached.lifestage,
        breedSize: cached.breedSize,
        specialDiets: cached.specialDiets,
        description: cached.description,
        source: 'chewy',
      },
    });
  } catch (error) {
    console.error('Product fetch error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch product' },
      { status: 500 },
    );
  }
}
