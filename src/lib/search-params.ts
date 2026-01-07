/**
 * Helper to safely access searchParams with null checks
 * Next.js 15 requires handling null searchParams
 */
export function getSearchParam(
  searchParams: Record<string, string | string[]> | null,
  key: string
): string | null {
  if (!searchParams) return null;
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function safeSearchParams(
  searchParams: Record<string, string | string[]> | null
): Record<string, string | string[]> {
  return searchParams ?? {};
}


