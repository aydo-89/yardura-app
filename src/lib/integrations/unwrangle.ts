/**
 * Unwrangle API client for fetching pet product data from Chewy
 * https://docs.unwrangle.com/
 */

import { env } from '@/lib/env';

const UNWRANGLE_BASE_URL = 'https://data.unwrangle.com/api/getter/';

export type ChewyProductSpecification = {
  name: string;
  value: string;
};

export type ChewyProductPromotion = {
  id: string;
  short_description: string;
  long_description?: string;
  is_code_required: boolean;
  group: string;
  reward_type: string;
  autoship_discount_percent?: number | null;
};

export type ChewyProductDetail = {
  id: string;
  variant_id?: string;
  name: string;
  brand: string;
  images: string[];
  price: number;
  autoship_price?: number;
  list_price?: number;
  per_unit_price?: number;
  currency: string;
  currency_symbol: string;
  rating?: number;
  total_reviews?: number;
  in_stock: boolean;
  categories?: Array<{ name: string; url: string | null }>;
  description?: string;
  ingredients?: string[];
  specifications?: ChewyProductSpecification[];
  promotions?: ChewyProductPromotion[];
};

export type ChewySearchResult = {
  id: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  url: string;
  image?: string;
  rating?: number;
  total_reviews?: number;
};

export type UnwrangleResponse<T> = {
  success: boolean;
  platform: string;
  item_id?: string;
  url?: string;
  detail?: T;
  results?: T[];
  result_count: number;
  credits_used: number;
  remaining_credits: number;
  error?: string;
};

function getApiKey(): string {
  const apiKey = env.UNWRANGLE_API_KEY;
  if (!apiKey) {
    throw new Error('UNWRANGLE_API_KEY is not configured');
  }
  return apiKey;
}

/**
 * Fetch detailed product information from a Chewy product URL
 * Cost: 10 credits per request
 */
export async function getChewyProductDetail(
  productUrl: string,
): Promise<ChewyProductDetail | null> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    platform: 'chewy_detail',
    url: productUrl,
    api_key: apiKey,
  });

  const response = await fetch(`${UNWRANGLE_BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    console.error('Unwrangle API error:', response.status, await response.text());
    return null;
  }

  const data: UnwrangleResponse<ChewyProductDetail> = await response.json();

  if (!data.success || !data.detail) {
    console.error('Unwrangle API failed:', data.error);
    return null;
  }

  return data.detail;
}

/**
 * Search for products on Chewy
 * Cost: 10 credits per request
 */
export async function searchChewyProducts(
  query: string,
  page: number = 1,
): Promise<ChewySearchResult[]> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    platform: 'chewy_search',
    search: query,
    page: String(page),
    api_key: apiKey,
  });

  const response = await fetch(`${UNWRANGLE_BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    console.error('Unwrangle search API error:', response.status, await response.text());
    return [];
  }

  const data: UnwrangleResponse<ChewySearchResult> = await response.json();

  if (!data.success) {
    console.error('Unwrangle search failed:', data.error);
    return [];
  }

  return data.results ?? [];
}

/**
 * Extract useful food/product type from specifications
 */
export function extractProductType(specs: ChewyProductSpecification[]): string | null {
  const typeSpec = specs.find(
    (s) => s.name === 'Product Type' || s.name === 'Food Form',
  );
  if (typeSpec) return typeSpec.value;

  // Check if it's a medication based on other clues
  const hasRx = specs.some(
    (s) => s.name === 'Prescription Item' && s.value === 'Yes',
  );
  if (hasRx) return 'Medication';

  return null;
}

/**
 * Extract lifestage from specifications
 */
export function extractLifestage(specs: ChewyProductSpecification[]): string | null {
  const lifestageSpec = specs.find((s) => s.name === 'Lifestage');
  return lifestageSpec?.value ?? null;
}

/**
 * Extract breed size from specifications
 */
export function extractBreedSize(specs: ChewyProductSpecification[]): string | null {
  const breedSpec = specs.find((s) => s.name === 'Breed Size');
  return breedSpec?.value ?? null;
}

/**
 * Extract special diet info from specifications
 */
export function extractSpecialDiet(specs: ChewyProductSpecification[]): string[] {
  return specs
    .filter((s) => s.name === 'Special Diet')
    .map((s) => s.value);
}

/**
 * Map Chewy product to a normalized food product format
 */
export function normalizeChewyProduct(detail: ChewyProductDetail) {
  const specs = detail.specifications ?? [];
  const ingredients = detail.ingredients?.join(', ') ?? null;
  const productType = extractProductType(specs);
  const lifestage = extractLifestage(specs);
  const breedSize = extractBreedSize(specs);
  const specialDiets = extractSpecialDiet(specs);

  // Map product type to our food type
  let type: 'FOOD' | 'TREAT' | 'SUPPLEMENT' | 'MEDICATION' = 'FOOD';
  if (productType) {
    const lower = productType.toLowerCase();
    if (lower.includes('treat') || lower.includes('chew')) {
      type = 'TREAT';
    } else if (lower.includes('supplement') || lower.includes('vitamin')) {
      type = 'SUPPLEMENT';
    } else if (lower.includes('medication') || lower.includes('medicine')) {
      type = 'MEDICATION';
    }
  }

  return {
    chewyId: detail.id,
    name: detail.name,
    brand: detail.brand,
    type,
    ingredients,
    imageUrl: detail.images?.[0] ?? null,
    price: detail.price,
    autoshipPrice: detail.autoship_price ?? null,
    rating: detail.rating ?? null,
    reviewCount: detail.total_reviews ?? null,
    inStock: detail.in_stock,
    lifestage,
    breedSize,
    specialDiets,
    description: detail.description ?? null,
  };
}
