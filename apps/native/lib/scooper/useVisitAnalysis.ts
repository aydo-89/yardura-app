import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import type { ScooperVisitMedia } from '@/lib/api/types';

const ANALYZED_STATUSES = new Set(['COMPLETED', 'NEEDS_REVIEW']);

export type SummaryResult = {
  color: string;
  consistency: string;
  content: string;
  observations: string;
  wellnessFlag: boolean;
  flagReason: string;
  flaggedSampleIndices?: number[];
  flaggedSampleReasons?: string[];
  totalSamples?: number;
};

export type SummaryDraft = {
  color: string;
  consistency: string;
  content: string;
  observations: string;
  wellnessFlag: boolean;
  flagReason: string;
  flaggedSampleReasons: string[];
  sampleCount?: number;
};

type SummaryJobStatus = {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: SummaryResult | null;
};

export const defaultSummaryDraft: SummaryDraft = {
  color: '',
  consistency: '',
  content: '',
  observations: '',
  wellnessFlag: false,
  flagReason: '',
  flaggedSampleReasons: [],
  sampleCount: undefined,
};

export function isAnalyzedStatus(status?: string | null): boolean {
  if (!status) return false;
  return ANALYZED_STATUSES.has(status);
}

export function countAnalyzedMedia(media: ScooperVisitMedia[]): number {
  return media.filter((item) => isAnalyzedStatus(item.analysisStatus)).length;
}

export function hasAnalysisPending(media: ScooperVisitMedia[]): boolean {
  return media.some(
    (item) => item.analysisStatus === 'PENDING' || item.analysisStatus === 'IN_PROGRESS',
  );
}

export function calculateAnalysisGoal(surfaceMediaCount: number): number {
  if (surfaceMediaCount >= 5) return 5;
  if (surfaceMediaCount >= 3) return 3;
  return surfaceMediaCount;
}

type UseVisitAnalysisOptions = {
  token: string | null | undefined;
  visitId: string;
  surfaceMedia: ScooperVisitMedia[];
  onRefresh: () => Promise<void>;
};

type UseVisitAnalysisResult = {
  analyzedCount: number;
  analysisGoal: number;
  hasMetMinimum: boolean;
  analysisPending: boolean;
  summaryDraft: SummaryDraft;
  summaryResult: SummaryResult | null;
  summaryLoading: boolean;
  summaryError: string | null;
  updateSummaryDraft: (updates: Partial<SummaryDraft>) => void;
  generateSummary: () => Promise<void>;
  initializeDraftFromInsight: (insight: {
    colorIndicator?: string | null;
    consistencyIndicator?: string | null;
    contentIndicator?: string | null;
    observations?: string | null;
    wellnessFlag?: boolean | null;
    flagReason?: string | null;
  } | null) => void;
};

export function useVisitAnalysis({
  token,
  visitId,
  surfaceMedia,
  onRefresh,
}: UseVisitAnalysisOptions): UseVisitAnalysisResult {
  const [summaryDraft, setSummaryDraft] = useState<SummaryDraft>(defaultSummaryDraft);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryJobId, setSummaryJobId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const analyzedCount = useMemo(
    () => countAnalyzedMedia(surfaceMedia),
    [surfaceMedia],
  );

  const analysisGoal = useMemo(
    () => calculateAnalysisGoal(surfaceMedia.length),
    [surfaceMedia.length],
  );

  const hasMetMinimum = analysisGoal === 0 ? false : analyzedCount >= analysisGoal;

  const analysisPending = useMemo(
    () => hasAnalysisPending(surfaceMedia),
    [surfaceMedia],
  );

  // Poll for analysis completion when pending
  useEffect(() => {
    if (!analysisPending || !token || !visitId) return;
    let cancelled = false;
    let pollId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        await onRefresh();
      } catch {
        // Ignore polling errors
      }
      if (cancelled) return;
      pollId = setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
      if (pollId) {
        clearTimeout(pollId);
      }
    };
  }, [analysisPending, token, visitId, onRefresh]);

  // Poll for summary job completion
  useEffect(() => {
    if (!summaryJobId || !token || !visitId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const response = await apiRequest<SummaryJobStatus>(
          `/api/field-tech/visits/${visitId}/generate-summary?jobId=${summaryJobId}`,
          { token },
        );
        if (cancelled) return;

        if (response.status === 'completed') {
          const result = response.result ?? null;
          if (result) {
            setSummaryResult(result);
            setSummaryDraft((prev) => ({
              ...prev,
              color: result.color ?? prev.color,
              consistency: result.consistency ?? prev.consistency,
              content: result.content ?? prev.content,
              observations: result.observations ?? prev.observations,
              wellnessFlag: Boolean(result.wellnessFlag),
              flagReason: result.flagReason ?? prev.flagReason,
              flaggedSampleReasons: result.flaggedSampleReasons ?? prev.flaggedSampleReasons,
              sampleCount: result.totalSamples ?? prev.sampleCount,
            }));
          }
          setSummaryLoading(false);
          setSummaryJobId(null);
          return;
        }

        if (response.status === 'failed') {
          setSummaryError(response.error || 'Summary generation failed.');
          setSummaryLoading(false);
          setSummaryJobId(null);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to check summary status.';
        setSummaryError(message);
        setSummaryLoading(false);
        setSummaryJobId(null);
        return;
      }
      setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [summaryJobId, token, visitId]);

  const updateSummaryDraft = useCallback((updates: Partial<SummaryDraft>) => {
    setSummaryDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  const initializeDraftFromInsight = useCallback(
    (insight: {
      colorIndicator?: string | null;
      consistencyIndicator?: string | null;
      contentIndicator?: string | null;
      observations?: string | null;
      wellnessFlag?: boolean | null;
      flagReason?: string | null;
    } | null) => {
      if (!insight) return;
      setSummaryDraft((prev) => {
        // Don't overwrite if draft already has values
        if (prev.color || prev.consistency || prev.content || prev.observations) {
          return prev;
        }
        return {
          ...prev,
          color: insight.colorIndicator ?? prev.color,
          consistency: insight.consistencyIndicator ?? prev.consistency,
          content: insight.contentIndicator ?? prev.content,
          observations: insight.observations ?? prev.observations,
          wellnessFlag: Boolean(insight.wellnessFlag),
          flagReason: insight.flagReason ?? prev.flagReason,
        };
      });
    },
    [],
  );

  const generateSummary = useCallback(async () => {
    if (!token || !visitId) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await apiRequest<{
        summary?: SummaryResult;
        jobId?: string;
      }>(`/api/field-tech/visits/${visitId}/generate-summary`, {
        method: 'POST',
        token,
      });

      if (response.summary) {
        const result = response.summary;
        setSummaryResult(result);
        setSummaryDraft((prev) => ({
          ...prev,
          color: result.color ?? prev.color,
          consistency: result.consistency ?? prev.consistency,
          content: result.content ?? prev.content,
          observations: result.observations ?? prev.observations,
          wellnessFlag: Boolean(result.wellnessFlag),
          flagReason: result.flagReason ?? prev.flagReason,
          flaggedSampleReasons: result.flaggedSampleReasons ?? prev.flaggedSampleReasons,
          sampleCount: result.totalSamples ?? prev.sampleCount,
        }));
        setSummaryLoading(false);
        setSummaryJobId(null);
      } else if (response.jobId) {
        setSummaryJobId(response.jobId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate summary.';
      setSummaryError(message);
      setSummaryLoading(false);
      setSummaryJobId(null);
    }
  }, [token, visitId]);

  return {
    analyzedCount,
    analysisGoal,
    hasMetMinimum,
    analysisPending,
    summaryDraft,
    summaryResult,
    summaryLoading,
    summaryError,
    updateSummaryDraft,
    generateSummary,
    initializeDraftFromInsight,
  };
}
