import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as Location from 'expo-location';

import { ApiError, apiRequest, apiUpload } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { ScooperVisitDetail, ScooperVisitMedia } from '@/lib/api/types';
import { parseDateInput } from '@/lib/dates';
import {
  buildDisposalCopy,
  resolveDisposalMode,
  resolveDisposalTargetLabel,
  type DisposalMode,
} from '@/lib/scooper/disposal';

const SANITATION_VIDEO_NOTE = 'SANITATION_VIDEO' as const;
const SANITATION_SHOES_NOTE = 'SANITATION_SHOES' as const;
const SANITATION_TOOLS_NOTE = 'SANITATION_TOOLS' as const;

const analyzedStatuses = new Set(['COMPLETED', 'NEEDS_REVIEW']);

const formatDistanceMeters = (distance?: number | null) => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) return null;
  const miles = distance / 1609.34;
  if (miles < 0.1) {
    const feet = Math.round(distance * 3.28084);
    return `${feet} ft`;
  }
  if (miles < 10) {
    return `${miles.toFixed(2)} mi`;
  }
  return `${miles.toFixed(1)} mi`;
};

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

type SummaryJobStatus = {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: SummaryResult | null;
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

export type VisitStep =
  | 'on_the_way'
  | 'arrival'
  | 'setup'
  | 'test_capture'
  | 'capture'
  | 'confirm'
  | 'deodorize'
  | 'bag_drop'
  | 'gate'
  | 'sanitation'
  | 'review'
  | 'notify';

export type VisitStepConfig = {
  id: VisitStep;
  label: string;
  description: string;
};

type ArrivalVerification = {
  verifiedAt?: string | null;
  distanceMeters?: number | null;
  accuracyMeters?: number | null;
  withinThreshold?: boolean | null;
  thresholdMeters?: number | null;
};

type SkipReason = {
  id: string;
  label: string;
  description?: string | null;
};

type UploadOptions = {
  assetType: string;
  notes?: string;
  analysisMode?: 'log_only' | 'analyze';
  stoolSampleView?: 'SURFACE' | 'CROSS_SECTION';
  stoolSampleId?: string;
};

type UploadAsset = {
  uri: string;
  name: string;
  type: string;
};

type VisitFlowContextValue = {
  visitId: string;
  visit: ScooperVisitDetail | null;
  loading: boolean;
  error: string | null;
  refreshVisit: () => Promise<void>;
  nextRequiredStep: VisitStep | null;
  canAccessStep: (stepId: VisitStep) => boolean;
  isStepComplete: (stepId: VisitStep) => boolean;
  steps: VisitStepConfig[];
  getNextStep: (current: VisitStep) => VisitStep | null;
  getPreviousStep: (current: VisitStep) => VisitStep | null;
  isScheduledToday: boolean;
  arrivalRequired: boolean;
  arrivalSent: boolean;
  arrivalVerified: boolean;
  arrivalVerification: ArrivalVerification | null;
  arrivalVerifying: boolean;
  arrivalVerifyError: string | null;
  verifyArrival: (coords: { latitude: number; longitude: number; accuracy?: number }) => Promise<boolean>;
  setupConfirmed: boolean;
  setSetupConfirmed: (confirmed: boolean) => void;
  testCaptureConfirmed: boolean;
  setTestCaptureConfirmed: (confirmed: boolean) => void;
  cameraZoom: number;
  setCameraZoom: (zoom: number) => void;
  confirmChecklist: {
    allDeposits: boolean;
    analyzedFresh: boolean;
    finalSweep: boolean;
    insufficientSamples: boolean;
    insufficientSamplesNote: string;
  };
  setConfirmChecklist: (updates: Partial<VisitFlowContextValue['confirmChecklist']>) => void;
  requiresDeodorize: boolean;
  deodorizeConfirmed: boolean;
  setDeodorizeConfirmed: (confirmed: boolean) => void;
  requiresGatePhoto: boolean;
  requiresBagDropPhoto: boolean;
  disposalMode: DisposalMode;
  disposalCopy: ReturnType<typeof buildDisposalCopy>;
  disposalTargetLabel: string;
  analyzedCount: number;
  analysisGoal: number;
  hasMetAnalysisMinimum: boolean;
  analysisPending: boolean;
  sanitationCaptured: boolean;
  missingRequiredMedia: string[];
  media: ScooperVisitMedia[];
  insightMedia: ScooperVisitMedia[];
  bagDropMedia: ScooperVisitMedia[];
  gateMedia: ScooperVisitMedia[];
  sanitationVideoMedia: ScooperVisitMedia[];
  sanitationShoesMedia: ScooperVisitMedia[];
  sanitationToolsMedia: ScooperVisitMedia[];
  summaryDraft: SummaryDraft;
  updateSummaryDraft: (updates: Partial<SummaryDraft>) => void;
  summaryResult: SummaryResult | null;
  summaryLoading: boolean;
  summaryError: string | null;
  generateSummary: () => Promise<void>;
  uploadingType: string | null;
  uploadMedia: (asset: UploadAsset, options: UploadOptions) => Promise<ScooperVisitMedia | null>;
  arrivalSending: boolean;
  sendArrival: (etaMinutes?: number, includePetReminder?: boolean) => Promise<void>;
  notificationChannel: 'SMS' | 'EMAIL';
  setNotificationChannel: (channel: 'SMS' | 'EMAIL') => void;
  completing: boolean;
  completeError: string | null;
  payoutCents: number | null;
  completeVisit: () => Promise<boolean>;
  deleteMedia: (mediaId: string) => Promise<void>;
  skipReasons: SkipReason[];
  skipVisit: (reasonId: string, note?: string) => Promise<void>;
  skipSubmitting: boolean;
  handoffVisit: (reason?: string) => Promise<void>;
  handoffSubmitting: boolean;
};

const VisitFlowContext = createContext<VisitFlowContextValue | null>(null);

const defaultSummaryDraft: SummaryDraft = {
  color: '',
  consistency: '',
  content: '',
  observations: '',
  wellnessFlag: false,
  flagReason: '',
  flaggedSampleReasons: [],
  sampleCount: undefined,
};

function isAnalyzedStatus(status?: string | null) {
  if (!status) return false;
  return analyzedStatuses.has(status);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(record: Record<string, unknown> | null, key: string): boolean | null {
  if (!record) return null;
  return typeof record[key] === 'boolean' ? (record[key] as boolean) : null;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStartCase(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function inferExtension(uri: string, mimeType?: string | null) {
  if (mimeType) {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('heic')) return 'heic';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('quicktime')) return 'mov';
  }
  const segments = uri.split('.');
  if (segments.length > 1) {
    return segments[segments.length - 1].split('?')[0];
  }
  return 'jpg';
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(value?: string | null): boolean {
  if (!value) return false;
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return false;
  return localDayKey(date) === localDayKey(new Date());
}

function resolveAssetUpload(asset: UploadAsset, prefix: string): UploadAsset {
  const extension = inferExtension(asset.uri, asset.type);
  const name = asset.name || `${prefix}-${Date.now()}.${extension}`;
  return {
    uri: asset.uri,
    name,
    type: asset.type || 'image/jpeg',
  };
}

function buildSteps(
  arrivalRequired: boolean,
  requiresDeodorize: boolean,
  requiresBagDropPhoto: boolean,
  requiresGatePhoto: boolean,
  disposalCopy: ReturnType<typeof buildDisposalCopy>,
): VisitStepConfig[] {
  const sequence: VisitStepConfig[] = [];
  if (arrivalRequired) {
    sequence.push({
      id: 'on_the_way',
      label: 'On the way',
      description: 'Send your ETA before you arrive on site.',
    });
    sequence.push({
      id: 'arrival',
      label: 'Confirm arrival',
      description: 'Verify you are on site to unlock the next steps.',
    });
  }

  sequence.push(
    {
      id: 'setup',
      label: 'Mount phone',
      description: 'Lock the phone in the mount so it stays stable for captures.',
    },
    // Note: test_capture is now integrated into capture.tsx as a calibration overlay
    {
      id: 'capture',
      label: 'Capture deposits',
      description: 'Log each pickup and make sure fresh samples are analyzed.',
    },
    {
      id: 'confirm',
      label: 'Confirm yard is clear',
      description: 'Verify the yard is clear and the best samples are analyzed.',
    },
  );

  if (requiresDeodorize) {
    sequence.push({
      id: 'deodorize',
      label: 'Deodorizing add-on',
      description: 'Apply the pet-safe deodorizer after clearing the yard.',
    });
  }

  if (requiresBagDropPhoto) {
    sequence.push({
      id: 'bag_drop',
      label: disposalCopy.stepLabel,
      description: disposalCopy.stepDescription,
    });
  }

  if (requiresGatePhoto) {
    sequence.push({
      id: 'gate',
      label: 'Secure gate',
      description: 'Capture the closed latch before you exit.',
    });
  }

  sequence.push(
    {
      id: 'sanitation',
      label: 'Sanitation',
      description: 'Record the sanitation proof for boots and tools.',
    },
    {
      id: 'review',
      label: 'Review & summarize',
      description: 'Confirm the 3Cs and wellness summary.',
    },
    {
      id: 'notify',
      label: 'Notify & complete',
      description: 'Send the wrap-up and complete the visit.',
    },
  );

  return sequence;
}

export function VisitFlowProvider({ visitId, children }: { visitId: string; children: ReactNode }) {
  const { session } = useAuth();
  const [visit, setVisit] = useState<ScooperVisitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<SummaryDraft>(defaultSummaryDraft);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryJobId, setSummaryJobId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [arrivalSending, setArrivalSending] = useState(false);
  const [arrivalVerifying, setArrivalVerifying] = useState(false);
  const [arrivalVerifyError, setArrivalVerifyError] = useState<string | null>(null);
  const [setupConfirmed, setSetupConfirmed] = useState(false);
  const [testCaptureConfirmed, setTestCaptureConfirmed] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [confirmChecklist, setConfirmChecklistState] = useState({
    allDeposits: false,
    analyzedFresh: false,
    finalSweep: false,
    insufficientSamples: false,
    insufficientSamplesNote: '',
  });
  const [deodorizeConfirmed, setDeodorizeConfirmed] = useState(false);
  const [notificationChannel, setNotificationChannel] = useState<'SMS' | 'EMAIL'>('SMS');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [payoutCents, setPayoutCents] = useState<number | null>(null);
  const [skipReasons, setSkipReasons] = useState<SkipReason[]>([]);
  const [skipSubmitting, setSkipSubmitting] = useState(false);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);

  const refreshVisit = useCallback(async () => {
    if (!session?.token || !visitId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ visit: ScooperVisitDetail }>(
        `/api/field-tech/visits/${visitId}`,
        { token: session.token },
      );
      setVisit(response.visit);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load visit.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token, visitId]);

  const loadSkipReasons = useCallback(async () => {
    if (!session?.token) return;
    try {
      const response = await apiRequest<{ skipReasons: SkipReason[] }>(
        '/api/field-tech/skip-reasons',
        { token: session.token },
      );
      setSkipReasons(response.skipReasons ?? []);
    } catch {
      setSkipReasons([]);
    }
  }, [session?.token]);

  const updateCameraZoom = useCallback((value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setCameraZoom(clamped);
  }, []);

  useEffect(() => {
    refreshVisit();
    loadSkipReasons();
  }, [refreshVisit, loadSkipReasons]);

  useEffect(() => {
    if (!visit) return;
    if (summaryDraft.color || summaryDraft.consistency || summaryDraft.content || summaryDraft.observations) {
      return;
    }
    const insight = visit.insights?.[0];
    if (!insight) return;
    setSummaryDraft((prev) => ({
      ...prev,
      color: insight.colorIndicator ?? prev.color,
      consistency: insight.consistencyIndicator ?? prev.consistency,
      content: insight.contentIndicator ?? prev.content,
      observations: insight.observations ?? prev.observations,
      wellnessFlag: Boolean(insight.wellnessFlag),
      flagReason: insight.flagReason ?? prev.flagReason,
    }));
  }, [visit, summaryDraft.color, summaryDraft.consistency, summaryDraft.content, summaryDraft.observations]);

  useEffect(() => {
    if (!visit) return;
    const hasPhone = Boolean(visit.customer?.phone);
    const hasEmail = Boolean(visit.customer?.email);
    if (hasPhone) {
      setNotificationChannel('SMS');
    } else if (hasEmail) {
      setNotificationChannel('EMAIL');
    }
  }, [visit]);

  useEffect(() => {
    if (!summaryJobId || !session?.token || !visitId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const response = await apiRequest<SummaryJobStatus>(
          `/api/field-tech/visits/${visitId}/generate-summary?jobId=${summaryJobId}`,
          { token: session.token },
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
  }, [summaryJobId, session?.token, visitId]);

  const visitMetadata = useMemo(() => asRecord(visit?.metadata), [visit?.metadata]);
  const planMetadata = useMemo(
    () => asRecord(visit?.job?.billingPlan?.metadata),
    [visit?.job?.billingPlan?.metadata],
  );

  const accessPreferences = useMemo(
    () => asRecord(visitMetadata?.accessPreferences) ?? asRecord(planMetadata?.accessPreferences),
    [visitMetadata, planMetadata],
  );
  const disposalPreferences = useMemo(
    () => asRecord(visitMetadata?.disposalPreferences) ?? asRecord(planMetadata?.disposalPreferences),
    [visitMetadata, planMetadata],
  );
  const disposalLabelRaw =
    readString(disposalPreferences, 'trashLabel') ??
    readString(disposalPreferences, 'trashLocation');
  const disposalLabel = toStartCase(disposalLabelRaw);
  const bagDropLabel = disposalLabel ?? 'the designated bin';
  const disposalMode = useMemo(
    () => resolveDisposalMode(readString(disposalPreferences, 'mode')),
    [disposalPreferences],
  );
  const disposalTargetLabel = useMemo(
    () => resolveDisposalTargetLabel(disposalMode, bagDropLabel, disposalLabel),
    [disposalMode, bagDropLabel, disposalLabel],
  );
  const disposalCopy = useMemo(
    () => buildDisposalCopy(disposalMode, disposalTargetLabel),
    [disposalMode, disposalTargetLabel],
  );

  const gateLocation = readString(accessPreferences, 'gateLocation')?.toLowerCase();
  const requiresGatePhoto = useMemo(() => {
    const visitOverride = readBoolean(visitMetadata, 'requiresGatePhoto');
    if (visitOverride !== null) return visitOverride;
    const planOverride = readBoolean(planMetadata, 'requiresGatePhoto');
    if (planOverride !== null) return planOverride;
    const preferenceOverride = readBoolean(accessPreferences, 'requiresGatePhoto');
    if (preferenceOverride !== null) return preferenceOverride;
    if (gateLocation) {
      return gateLocation !== 'front';
    }
    return true;
  }, [visitMetadata, planMetadata, accessPreferences, gateLocation]);

  const requiresBagDropPhoto = useMemo(() => {
    if (disposalMode !== 'standard') return true;
    const visitOverride = readBoolean(visitMetadata, 'requiresBagDropPhoto');
    if (visitOverride !== null) return visitOverride;
    const planOverride = readBoolean(planMetadata, 'requiresBagDropPhoto');
    if (planOverride !== null) return planOverride;
    const disposalOverride = readBoolean(disposalPreferences, 'requiresBinConfirmation');
    if (disposalOverride !== null) return disposalOverride;
    return false;
  }, [disposalMode, visitMetadata, planMetadata, disposalPreferences]);

  const media = visit?.media ?? [];
  const insightMedia = media.filter((item) => item.assetType === 'INSIGHTSCOOP');
  const surfaceInsightMedia = insightMedia.filter(
    (item) => item.stoolSampleView !== 'CROSS_SECTION',
  );
  const analysisPending = useMemo(
    () =>
      insightMedia.some(
        (item) =>
          item.analysisStatus === 'PENDING' || item.analysisStatus === 'IN_PROGRESS',
      ),
    [insightMedia],
  );
  useEffect(() => {
    if (!analysisPending) return;
    const intervalId = setInterval(() => {
      refreshVisit();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [analysisPending, refreshVisit]);

  useEffect(() => {
    if (!analysisPending || !session?.token || !visitId) return;
    let cancelled = false;
    let pollId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        await refreshVisit();
      } catch {
        // Ignore polling errors; they'll be retried on the next tick.
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
  }, [analysisPending, session?.token, visitId, refreshVisit]);

  const bagDropMedia = media.filter((item) => item.assetType === 'BAG_DROP');
  const gateMedia = media.filter((item) => item.assetType === 'GATE');
  const sanitationVideoMedia = media.filter(
    (item) => item.assetType === 'OTHER' && item.notes === SANITATION_VIDEO_NOTE,
  );
  const sanitationShoesMedia = media.filter(
    (item) => item.assetType === 'OTHER' && item.notes === SANITATION_SHOES_NOTE,
  );
  const sanitationToolsMedia = media.filter(
    (item) => item.assetType === 'OTHER' && item.notes === SANITATION_TOOLS_NOTE,
  );

  const analyzedCount = surfaceInsightMedia.filter((item) =>
    isAnalyzedStatus(item.analysisStatus),
  ).length;
  const sanitationCaptured =
    sanitationVideoMedia.length > 0 ||
    (sanitationShoesMedia.length > 0 && sanitationToolsMedia.length > 0);

  const arrivalSent = Boolean(
    visit?.communications?.some(
      (comm) => comm.templateId === 'on_way_sms_v1' || comm.templateId === 'on_way_email_v1',
    ),
  );

  const arrivalVerification = useMemo(() => {
    const record = asRecord(visitMetadata?.arrivalVerification);
    if (!record) return null;
    return {
      verifiedAt: readString(record, 'verifiedAt'),
      distanceMeters: readNumber(record, 'distanceMeters'),
      accuracyMeters: readNumber(record, 'accuracyMeters'),
      withinThreshold: readBoolean(record, 'withinThreshold'),
      thresholdMeters: readNumber(record, 'thresholdMeters'),
    } satisfies ArrivalVerification;
  }, [visitMetadata]);

  const arrivalVerifiedAt = readString(visitMetadata, 'arrivalVerifiedAt');
  const arrivalVerified = Boolean(
    arrivalVerifiedAt ||
      arrivalVerification?.withinThreshold ||
      (arrivalVerification?.verifiedAt && arrivalVerification?.withinThreshold !== false),
  );

  const analysisGoal =
    surfaceInsightMedia.length >= 5
      ? 5
      : surfaceInsightMedia.length >= 3
        ? 3
        : surfaceInsightMedia.length;
  const hasMetAnalysisMinimum = analysisGoal === 0 ? false : analyzedCount >= analysisGoal;

  const missingRequiredMedia = useMemo(() => {
    const missing: string[] = [];
    if (surfaceInsightMedia.length === 0) {
      missing.push('Sample photos');
    }
    if (requiresBagDropPhoto && bagDropMedia.length === 0) {
      missing.push(disposalMode === 'standard' ? 'Bag drop photo' : 'Disposal proof photo');
    }
    if (requiresGatePhoto && gateMedia.length === 0) {
      missing.push('Gate photo');
    }
    return missing;
  }, [
    surfaceInsightMedia.length,
    requiresBagDropPhoto,
    bagDropMedia.length,
    disposalMode,
    requiresGatePhoto,
    gateMedia.length,
  ]);

  const arrivalRequired = Boolean(visit?.geo);
  const requiresDeodorize = useMemo(() => {
    const mode =
      typeof visit?.job?.deodorizeMode === 'string'
        ? visit.job.deodorizeMode.toUpperCase()
        : null;
    if (mode === 'EACH_VISIT') return true;
    if (mode === 'FIRST_VISIT') {
      return Boolean(visit?.deodorize);
    }
    return Boolean(visit?.deodorize);
  }, [visit?.deodorize, visit?.job?.deodorizeMode]);

  const confirmComplete =
    confirmChecklist.allDeposits &&
    confirmChecklist.analyzedFresh &&
    confirmChecklist.finalSweep &&
    (hasMetAnalysisMinimum || confirmChecklist.insufficientSamples);

  const isStepComplete = useCallback(
    (stepId: VisitStep) => {
      switch (stepId) {
        case 'on_the_way':
          return !arrivalRequired || arrivalSent;
        case 'arrival':
          return !arrivalRequired || arrivalVerified;
        case 'setup':
          return setupConfirmed;
        case 'test_capture':
          // test_capture is now integrated into capture.tsx - always return true
          // This ensures backward compatibility for any existing URLs
          return true;
        case 'capture':
          return surfaceInsightMedia.length > 0;
        case 'confirm':
          return confirmComplete;
        case 'deodorize':
          return !requiresDeodorize || deodorizeConfirmed;
        case 'bag_drop':
          return !requiresBagDropPhoto || bagDropMedia.length > 0;
        case 'gate':
          return !requiresGatePhoto || gateMedia.length > 0;
        case 'sanitation':
          return sanitationCaptured;
        case 'review':
          return Boolean(
            summaryDraft.color.trim() &&
              summaryDraft.consistency.trim() &&
              summaryDraft.content.trim(),
          );
        case 'notify':
          return visit?.status === 'COMPLETED';
        default:
          return false;
      }
    },
    [
      arrivalRequired,
      arrivalSent,
      arrivalVerified,
      setupConfirmed,
      testCaptureConfirmed,
      surfaceInsightMedia.length,
      confirmComplete,
      requiresDeodorize,
      deodorizeConfirmed,
      requiresBagDropPhoto,
      bagDropMedia.length,
      requiresGatePhoto,
      gateMedia.length,
      sanitationCaptured,
      summaryDraft.color,
      summaryDraft.consistency,
      summaryDraft.content,
      visit?.status,
    ],
  );

  const steps = useMemo(
    () =>
      buildSteps(
        arrivalRequired,
        requiresDeodorize,
        requiresBagDropPhoto,
        requiresGatePhoto,
        disposalCopy,
      ),
    [
      arrivalRequired,
      requiresDeodorize,
      requiresBagDropPhoto,
      requiresGatePhoto,
      disposalCopy,
    ],
  );

  const isScheduledToday = useMemo(
    () => isSameLocalDay(visit?.scheduledDate),
    [visit?.scheduledDate],
  );

  const nextRequiredStep = useMemo(() => {
    const next = steps.find((step) => !isStepComplete(step.id));
    return next ? next.id : null;
  }, [steps, isStepComplete]);

  const canAccessStep = useCallback(
    (stepId: VisitStep) => {
      if (!isScheduledToday) return false;
      const idx = steps.findIndex((step) => step.id === stepId);
      if (idx === -1) return false;
      const firstIncompleteIndex = steps.findIndex((step) => !isStepComplete(step.id));
      if (firstIncompleteIndex === -1) return true;
      return idx <= firstIncompleteIndex;
    },
    [steps, isStepComplete, isScheduledToday],
  );

  const getNextStep = useCallback(
    (current: VisitStep) => {
      const idx = steps.findIndex((step) => step.id === current);
      if (idx === -1 || idx >= steps.length - 1) return null;
      return steps[idx + 1].id;
    },
    [steps],
  );

  const getPreviousStep = useCallback(
    (current: VisitStep) => {
      const idx = steps.findIndex((step) => step.id === current);
      if (idx <= 0) return null;
      return steps[idx - 1].id;
    },
    [steps],
  );

  const verifyArrival = useCallback(
    async (coords: { latitude: number; longitude: number; accuracy?: number }) => {
      if (!session?.token || !visitId) return false;
      setArrivalVerifying(true);
      setArrivalVerifyError(null);
      try {
        const response = await apiRequest<{
          withinThreshold?: boolean;
          distanceMeters?: number;
          thresholdMeters?: number;
        }>(`/api/field-tech/visits/${visitId}/arrival-check`, {
          method: 'POST',
          token: session.token,
          body: coords,
        });
        await refreshVisit();
        if (response?.withinThreshold === false) {
          const distanceLabel = formatDistanceMeters(response.distanceMeters);
          setArrivalVerifyError(
            distanceLabel
              ? `You are ${distanceLabel} from the address. Move closer to verify.`
              : 'You are not close enough to the address yet.',
          );
          return false;
        }
        setArrivalVerifyError(null);
        return Boolean(response?.withinThreshold);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to verify arrival location.';
        setArrivalVerifyError(message);
        return false;
      } finally {
        setArrivalVerifying(false);
      }
    },
    [session?.token, visitId, refreshVisit],
  );

  const setConfirmChecklist = useCallback(
    (updates: Partial<VisitFlowContextValue['confirmChecklist']>) => {
      setConfirmChecklistState((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const updateSummaryDraft = useCallback((updates: Partial<SummaryDraft>) => {
    setSummaryDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  const generateSummary = useCallback(async () => {
    if (!session?.token || !visitId) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await apiRequest<any>(
        `/api/field-tech/visits/${visitId}/generate-summary`,
        { method: 'POST', token: session.token },
      );
      if (response.summary) {
        const result = response.summary as SummaryResult;
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
  }, [session?.token, visitId]);

  const uploadMedia = useCallback(
    async (asset: UploadAsset, options: UploadOptions) => {
      if (!session?.token || !visitId) return null;
      setUploadingType(options.assetType);
      setError(null);
      try {
        const file = resolveAssetUpload(asset, options.assetType.toLowerCase());
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as unknown as Blob);
        formData.append('assetType', options.assetType);
        if (options.assetType === 'INSIGHTSCOOP') {
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
              });
              const last = await Location.getLastKnownPositionAsync();
              const candidates = [current, last].filter(
                (entry): entry is Location.LocationObject => Boolean(entry?.coords),
              );
              const position = candidates.sort(
                (a, b) => (a.coords.accuracy ?? 9999) - (b.coords.accuracy ?? 9999),
              )[0];
              if (position?.coords) {
                formData.append('gpsLat', String(position.coords.latitude));
                formData.append('gpsLng', String(position.coords.longitude));
                if (Number.isFinite(position.coords.accuracy)) {
                  formData.append('gpsAccuracy', String(position.coords.accuracy));
                }
              }
            }
          } catch (locationError) {
            console.warn('visit.media.location.skipped', locationError);
          }
        }
        if (options.notes) {
          formData.append('notes', options.notes);
        }
        if (options.analysisMode) {
          formData.append('analysisMode', options.analysisMode);
        }
        if (options.stoolSampleView) {
          formData.append('stoolSampleView', options.stoolSampleView);
        }
        if (options.stoolSampleId) {
          formData.append('stoolSampleId', options.stoolSampleId);
        }
        const response = await apiUpload<{ media?: ScooperVisitMedia }>(
          `/api/field-tech/visits/${visitId}/media`,
          {
            token: session.token,
            body: formData,
          },
        );
        await refreshVisit();
        return response?.media ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to upload media.';
        setError(message);
      } finally {
        setUploadingType(null);
      }
      return null;
    },
    [session?.token, visitId, refreshVisit],
  );

  const deleteMedia = useCallback(
    async (mediaId: string) => {
      if (!session?.token || !visitId) return;
      if (!mediaId) return;
      setError(null);
      try {
        await apiRequest(`/api/field-tech/visits/${visitId}/media/${mediaId}`, {
          method: 'DELETE',
          token: session.token,
        });
        await refreshVisit();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to remove media.';
        setError(message);
      }
    },
    [session?.token, visitId, refreshVisit],
  );

  const sendArrival = useCallback(
    async (etaMinutes?: number, includePetReminder = true) => {
      if (!session?.token || !visitId) return;
      setArrivalSending(true);
      setError(null);
      try {
        await apiRequest(`/api/field-tech/visits/${visitId}/arrival`, {
          method: 'POST',
          token: session.token,
          body: {
            etaMinutes,
            includePetReminder,
          },
        });
        await refreshVisit();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to send arrival notice.';
        setError(message);
      } finally {
        setArrivalSending(false);
      }
    },
    [session?.token, visitId, refreshVisit],
  );

  const completeVisit = useCallback(async () => {
    if (!session?.token || !visitId) return false;
    if (!summaryDraft.color || !summaryDraft.consistency || !summaryDraft.content) {
      setCompleteError('Add color, consistency, and content before completing.');
      return false;
    }
    setCompleting(true);
    setCompleteError(null);
    try {
      const payload = {
        color: summaryDraft.color,
        consistency: summaryDraft.consistency,
        content: summaryDraft.content,
        observations: summaryDraft.observations.trim() || undefined,
        wellnessFlag: summaryDraft.wellnessFlag,
        flagReason: summaryDraft.wellnessFlag ? summaryDraft.flagReason.trim() || undefined : undefined,
        notificationChannel,
        sampleCount: summaryDraft.sampleCount,
        flaggedSampleReasons: summaryDraft.flaggedSampleReasons.length
          ? summaryDraft.flaggedSampleReasons
          : undefined,
        insufficientSamples: confirmChecklist.insufficientSamples || undefined,
        insufficientSamplesNote: confirmChecklist.insufficientSamples
          ? confirmChecklist.insufficientSamplesNote.trim() || undefined
          : undefined,
      };
      const response = await apiRequest<{ payoutCents?: number }>(
        `/api/field-tech/visits/${visitId}/complete`,
        { method: 'POST', body: payload, token: session.token },
      );
      setPayoutCents(response.payoutCents ?? null);
      await refreshVisit();
      return true;
    } catch (err) {
      const details =
        err instanceof ApiError && err.details && typeof err.details === 'object'
          ? (err.details as { missing?: string[]; error?: string })
          : null;
      if (details?.missing && Array.isArray(details.missing)) {
        const missing = details.missing.map((item) => item.replace('_', ' ')).join(', ');
        setCompleteError(`Missing required media: ${missing}`);
      } else if (details?.error === 'missing_sanitation_proof') {
        setCompleteError('Missing sanitation proof. Upload the sanitation clip or both shoes + tools photos.');
      } else {
        const message = err instanceof Error ? err.message : 'Unable to complete visit.';
        setCompleteError(message);
      }
      return false;
    } finally {
      setCompleting(false);
    }
  }, [
    session?.token,
    visitId,
    summaryDraft,
    notificationChannel,
    confirmChecklist.insufficientSamples,
    confirmChecklist.insufficientSamplesNote,
    refreshVisit,
  ]);

  const skipVisit = useCallback(
    async (reasonId: string, note?: string) => {
      if (!session?.token || !visitId) return;
      if (!reasonId) {
        setCompleteError('Select a skip reason first.');
        return;
      }
      setSkipSubmitting(true);
      setCompleteError(null);
      try {
        await apiRequest(`/api/field-tech/visits/${visitId}/skip`, {
          method: 'POST',
          token: session.token,
          body: {
            reasonId,
            note: note?.trim() || undefined,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to skip visit.';
        setCompleteError(message);
      } finally {
        setSkipSubmitting(false);
      }
    },
    [session?.token, visitId],
  );

  const handoffVisit = useCallback(
    async (reason?: string) => {
      if (!session?.token || !visitId) return;
      setHandoffSubmitting(true);
      setCompleteError(null);
      try {
        await apiRequest(`/api/field-tech/visits/${visitId}/handoff`, {
          method: 'POST',
          token: session.token,
          body: {
            reason: reason?.trim() || undefined,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to handoff visit.';
        setCompleteError(message);
      } finally {
        setHandoffSubmitting(false);
      }
    },
    [session?.token, visitId],
  );

  const value: VisitFlowContextValue = {
    visitId,
    visit,
    loading,
    error,
    refreshVisit,
    nextRequiredStep,
    canAccessStep,
    isStepComplete,
    steps,
    getNextStep,
    getPreviousStep,
    isScheduledToday,
    arrivalRequired,
    arrivalSent,
    arrivalVerified,
    arrivalVerification,
    arrivalVerifying,
    arrivalVerifyError,
    verifyArrival,
    setupConfirmed,
    setSetupConfirmed,
    testCaptureConfirmed,
    setTestCaptureConfirmed,
    cameraZoom,
    setCameraZoom: updateCameraZoom,
    confirmChecklist,
    setConfirmChecklist,
    requiresDeodorize,
    deodorizeConfirmed,
    setDeodorizeConfirmed,
    requiresGatePhoto,
    requiresBagDropPhoto,
    disposalMode,
    disposalCopy,
    disposalTargetLabel,
    analyzedCount,
    analysisGoal,
    hasMetAnalysisMinimum,
    analysisPending,
    sanitationCaptured,
    missingRequiredMedia,
    media,
    insightMedia,
    bagDropMedia,
    gateMedia,
    sanitationVideoMedia,
    sanitationShoesMedia,
    sanitationToolsMedia,
    summaryDraft,
    updateSummaryDraft,
    summaryResult,
    summaryLoading,
    summaryError,
    generateSummary,
    uploadingType,
    uploadMedia,
    deleteMedia,
    arrivalSending,
    sendArrival,
    notificationChannel,
    setNotificationChannel,
    completing,
    completeError,
    payoutCents,
    completeVisit,
    skipReasons,
    skipVisit,
    skipSubmitting,
    handoffVisit,
    handoffSubmitting,
  };

  return <VisitFlowContext.Provider value={value}>{children}</VisitFlowContext.Provider>;
}

export function useVisitFlow() {
  const context = useContext(VisitFlowContext);
  if (!context) {
    throw new Error('useVisitFlow must be used within VisitFlowProvider');
  }
  return context;
}

export const SANITATION_NOTES = {
  video: SANITATION_VIDEO_NOTE,
  shoes: SANITATION_SHOES_NOTE,
  tools: SANITATION_TOOLS_NOTE,
};
