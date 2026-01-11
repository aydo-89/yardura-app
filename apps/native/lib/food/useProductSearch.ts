import { useCallback, useRef, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import type { PetFoodProductSearch } from '@/lib/api/types';

type UseProductSearchOptions = {
  token: string | undefined;
  debounceMs?: number;
};

export function useProductSearch({ token, debounceMs = 300 }: UseProductSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PetFoodProductSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (searchQuery: string, type?: string) => {
      if (!token) return;

      const trimmed = searchQuery.trim();
      setQuery(trimmed);

      if (trimmed.length < 2) {
        setResults([]);
        setError(null);
        return;
      }

      // Debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setError(null);

        try {
          const params = new URLSearchParams({ q: trimmed });
          if (type) params.set('type', type);

          const data = await apiRequest<{
            ok: boolean;
            products: PetFoodProductSearch[];
            source: string;
          }>(`/api/mobile/customer/food-products/search?${params.toString()}`, {
            token,
          });

          if (data.ok) {
            setResults(data.products ?? []);
          } else {
            setResults([]);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Search failed';
          setError(message);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [token, debounceMs],
  );

  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    results,
    loading,
    error,
    search,
    clear,
  };
}

export type UseProductSearchReturn = ReturnType<typeof useProductSearch>;
