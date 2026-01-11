import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { logWarn } from '@/lib/logger';
import type {
  CadenceSummary,
  LeadOwner,
  OutboundLead,
  TerritorySummary,
} from '@/lib/api/types';
import type { DogPresenceValue } from '@/lib/sales/utils';
import { getLeadQuickVisitMeta } from '@/lib/sales/utils';

export type AiVisitResult = {
  transcript: string;
  summary: string;
  encounterTags: string[];
  dogPresence: DogPresenceValue | null;
  objectionTags: string[];
  dogCount?: number | null;
  followUp?: string | null;
};

export type NextActionFilter =
  | 'all'
  | 'overdue'
  | 'today'
  | 'upcoming'
  | 'none';

export type SalesFilters = {
  search: string;
  stage: string;
  ownerId: string;
  territoryId: string;
  nextAction: NextActionFilter;
  includeConverted: boolean;
  encounterIncludes: string[];
  encounterExclusions: string[];
  dogIncludes: DogPresenceValue[];
  dogExclusions: DogPresenceValue[];
  objectionIncludes: string[];
  objectionExclusions: string[];
};

type SalesContextValue = {
  filters: SalesFilters;
  updateFilters: (
    update: Partial<SalesFilters> | ((prev: SalesFilters) => SalesFilters),
  ) => void;
  leads: OutboundLead[];
  filteredLeads: OutboundLead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  owners: LeadOwner[];
  territories: TerritorySummary[];
  cadences: CadenceSummary[];
  refreshLookups: () => Promise<void>;
  pendingAiResult: AiVisitResult | null;
  setPendingAiResult: (value: AiVisitResult | null) => void;
};

const SalesContext = createContext<SalesContextValue | null>(null);

const DEFAULT_FILTERS: SalesFilters = {
  search: '',
  stage: 'all',
  ownerId: 'all',
  territoryId: 'all',
  nextAction: 'all',
  includeConverted: false,
  encounterIncludes: [],
  encounterExclusions: [],
  dogIncludes: [],
  dogExclusions: [],
  objectionIncludes: [],
  objectionExclusions: [],
};

const DEFAULT_PAGE_SIZE = 50;

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

export function SalesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.token ?? null;
  const [filters, setFilters] = useState<SalesFilters>(DEFAULT_FILTERS);
  const [leads, setLeads] = useState<OutboundLead[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owners, setOwners] = useState<LeadOwner[]>([]);
  const [territories, setTerritories] = useState<TerritorySummary[]>([]);
  const [cadences, setCadences] = useState<CadenceSummary[]>([]);
  const [pendingAiResult, setPendingAiResult] = useState<AiVisitResult | null>(
    null,
  );

  const updateFilters = useCallback(
    (
      update: Partial<SalesFilters> | ((prev: SalesFilters) => SalesFilters),
    ) => {
      if (typeof update === 'function') {
        setFilters(update);
      } else {
        setFilters((prev) => ({ ...prev, ...update }));
      }
    },
    [],
  );

  const serverFilters = useMemo(
    () => ({
      search: filters.search,
      stage: filters.stage,
      ownerId: filters.ownerId,
      territoryId: filters.territoryId,
      includeConverted: filters.includeConverted,
    }),
    [
      filters.search,
      filters.stage,
      filters.ownerId,
      filters.territoryId,
      filters.includeConverted,
    ],
  );

  const serverFilterKey = useMemo(
    () => JSON.stringify(serverFilters),
    [serverFilters],
  );

  const fetchLeads = useCallback(
    async ({ cursor, append }: { cursor?: string | null; append?: boolean } = {}) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', `${DEFAULT_PAGE_SIZE}`);
        params.set('leadType', 'outbound');
        params.set('includeCadence', 'true');
        if (serverFilters.search) params.set('search', serverFilters.search);
        if (serverFilters.stage !== 'all') params.set('pipelineStage', serverFilters.stage);
        if (serverFilters.ownerId === 'unassigned') {
          params.set('ownerId', 'NULL');
        } else if (serverFilters.ownerId !== 'all') {
          params.set('ownerId', serverFilters.ownerId);
        }
        if (serverFilters.territoryId === 'unassigned') {
          params.set('territoryId', 'NULL');
        } else if (serverFilters.territoryId !== 'all') {
          params.set('territoryId', serverFilters.territoryId);
        }
        if (serverFilters.includeConverted) {
          params.set('includeConverted', 'true');
        }
        if (cursor) {
          params.set('cursor', cursor);
        }

        const data = await apiRequest<{
          leads: OutboundLead[];
          pageInfo: { nextCursor: string | null };
        }>(`/api/leads/outbound?${params.toString()}`, { token });

        setLeads((prev) => (append ? [...prev, ...data.leads] : data.leads));
        setNextCursor(data.pageInfo?.nextCursor ?? null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load leads.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [token, serverFilters],
  );

  const refresh = useCallback(async () => {
    await fetchLeads({ append: false });
  }, [fetchLeads]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    await fetchLeads({ cursor: nextCursor, append: true });
  }, [nextCursor, loading, fetchLeads]);

  const refreshLookups = useCallback(async () => {
    if (!token) return;
    try {
      const [ownersResult, territoriesResult, cadencesResult] = await Promise.all([
        apiRequest<LeadOwner[]>('/api/leads/owners?limit=200', { token }),
        apiRequest<TerritorySummary[]>('/api/territories', { token }),
        apiRequest<CadenceSummary[]>('/api/cadences', { token }),
      ]);
      setOwners(ownersResult ?? []);
      setTerritories(territoriesResult ?? []);
      setCadences(cadencesResult ?? []);
    } catch (err) {
      logWarn('sales.lookups.refresh.failed', err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLeads([]);
      setNextCursor(null);
      return;
    }
    void fetchLeads({ append: false });
  }, [token, serverFilterKey, fetchLeads]);

  useEffect(() => {
    if (!token) return;
    void refreshLookups();
  }, [token, refreshLookups]);

  const filteredLeads = useMemo(() => {
    if (!leads.length) return [];
    const now = new Date();

    return leads.filter((lead) => {
      const meta = getLeadQuickVisitMeta(lead);

      const encounterToken = meta.encounterToken ?? '__NONE';
      if (filters.encounterIncludes.length) {
        if (!filters.encounterIncludes.includes(encounterToken)) {
          return false;
        }
      } else if (
        filters.encounterExclusions.length
        && filters.encounterExclusions.includes(encounterToken)
      ) {
        return false;
      }

      const dogToken: DogPresenceValue = meta.dogToken ?? 'UNKNOWN';
      if (filters.dogIncludes.length) {
        if (!filters.dogIncludes.includes(dogToken)) {
          return false;
        }
      } else if (
        filters.dogExclusions.length
        && filters.dogExclusions.includes(dogToken)
      ) {
        return false;
      }

      if (filters.objectionIncludes.length) {
        if (
          !meta.objectionTokens.some((token) =>
            filters.objectionIncludes.includes(token),
          )
        ) {
          return false;
        }
      } else if (
        filters.objectionExclusions.length
        && meta.objectionTokens.some((token) =>
          filters.objectionExclusions.includes(token),
        )
      ) {
        return false;
      }

      if (filters.nextAction !== 'all') {
        const nextActionAt = lead.nextActionAt
          ? new Date(lead.nextActionAt)
          : null;
        if (filters.nextAction === 'none') {
          if (nextActionAt) return false;
        } else if (!nextActionAt) {
          return false;
        } else if (filters.nextAction === 'overdue') {
          if (nextActionAt >= now) return false;
        } else if (filters.nextAction === 'today') {
          if (!isSameLocalDay(nextActionAt, now)) return false;
        } else if (filters.nextAction === 'upcoming') {
          if (
            nextActionAt <= now
            || isSameLocalDay(nextActionAt, now)
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [leads, filters]);

  const value = useMemo<SalesContextValue>(
    () => ({
      filters,
      updateFilters,
      leads,
      filteredLeads,
      loading,
      error,
      refresh,
      loadMore,
      hasMore: Boolean(nextCursor),
      owners,
      territories,
      cadences,
      refreshLookups,
      pendingAiResult,
      setPendingAiResult,
    }),
    [
      filters,
      updateFilters,
      leads,
      filteredLeads,
      loading,
      error,
      refresh,
      loadMore,
      nextCursor,
      owners,
      territories,
      cadences,
      refreshLookups,
      pendingAiResult,
      setPendingAiResult,
    ],
  );

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales(): SalesContextValue {
  const ctx = useContext(SalesContext);
  if (!ctx) {
    throw new Error('useSales must be used within SalesProvider');
  }
  return ctx;
}
