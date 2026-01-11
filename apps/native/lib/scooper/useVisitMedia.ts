import { useCallback, useMemo, useState } from 'react';
import * as Location from 'expo-location';

import { apiRequest, apiUpload } from '@/lib/api/client';
import type { ScooperVisitMedia, LocationSnapResult } from '@/lib/api/types';

const SANITATION_VIDEO_NOTE = 'SANITATION_VIDEO' as const;
const SANITATION_SHOES_NOTE = 'SANITATION_SHOES' as const;
const SANITATION_TOOLS_NOTE = 'SANITATION_TOOLS' as const;

export const SANITATION_NOTES = {
  video: SANITATION_VIDEO_NOTE,
  shoes: SANITATION_SHOES_NOTE,
  tools: SANITATION_TOOLS_NOTE,
} as const;

export type UploadOptions = {
  assetType: string;
  notes?: string;
  analysisMode?: 'log_only' | 'analyze';
  stoolSampleView?: 'SURFACE' | 'CROSS_SECTION';
  stoolSampleId?: string;
};

export type UploadAsset = {
  uri: string;
  name: string;
  type: string;
};

type MediaCategories = {
  all: ScooperVisitMedia[];
  insight: ScooperVisitMedia[];
  surface: ScooperVisitMedia[];
  crossSection: ScooperVisitMedia[];
  bagDrop: ScooperVisitMedia[];
  gate: ScooperVisitMedia[];
  sanitationVideo: ScooperVisitMedia[];
  sanitationShoes: ScooperVisitMedia[];
  sanitationTools: ScooperVisitMedia[];
};

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

function resolveAssetUpload(asset: UploadAsset, prefix: string): UploadAsset {
  const extension = inferExtension(asset.uri, asset.type);
  const name = asset.name || `${prefix}-${Date.now()}.${extension}`;
  return {
    uri: asset.uri,
    name,
    type: asset.type || 'image/jpeg',
  };
}

export function categorizeMedia(media: ScooperVisitMedia[]): MediaCategories {
  const insight = media.filter((item) => item.assetType === 'INSIGHTSCOOP');
  const surface = insight.filter((item) => item.stoolSampleView !== 'CROSS_SECTION');
  const crossSection = insight.filter((item) => item.stoolSampleView === 'CROSS_SECTION');
  const bagDrop = media.filter((item) => item.assetType === 'BAG_DROP');
  const gate = media.filter((item) => item.assetType === 'GATE');
  const sanitationVideo = media.filter(
    (item) => item.assetType === 'OTHER' && item.notes === SANITATION_VIDEO_NOTE,
  );
  const sanitationShoes = media.filter(
    (item) => item.assetType === 'OTHER' && item.notes === SANITATION_SHOES_NOTE,
  );
  const sanitationTools = media.filter(
    (item) => item.assetType === 'OTHER' && item.notes === SANITATION_TOOLS_NOTE,
  );

  return {
    all: media,
    insight,
    surface,
    crossSection,
    bagDrop,
    gate,
    sanitationVideo,
    sanitationShoes,
    sanitationTools,
  };
}

export function checkSanitationComplete(categories: MediaCategories): boolean {
  return (
    categories.sanitationVideo.length > 0 ||
    (categories.sanitationShoes.length > 0 && categories.sanitationTools.length > 0)
  );
}

type UseVisitMediaOptions = {
  token: string | null | undefined;
  visitId: string;
  media: ScooperVisitMedia[];
  onRefresh: () => Promise<void>;
};

type UploadResult = {
  media: ScooperVisitMedia | null;
  locationSnap: LocationSnapResult | null;
};

type UseVisitMediaResult = {
  categories: MediaCategories;
  sanitationCaptured: boolean;
  uploadingType: string | null;
  uploadError: string | null;
  lastLocationSnap: LocationSnapResult | null;
  uploadMedia: (asset: UploadAsset, options: UploadOptions) => Promise<UploadResult>;
  deleteMedia: (mediaId: string) => Promise<void>;
};

export function useVisitMedia({
  token,
  visitId,
  media,
  onRefresh,
}: UseVisitMediaOptions): UseVisitMediaResult {
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastLocationSnap, setLastLocationSnap] = useState<LocationSnapResult | null>(null);

  const categories = useMemo(() => categorizeMedia(media), [media]);
  const sanitationCaptured = useMemo(
    () => checkSanitationComplete(categories),
    [categories],
  );

  const uploadMedia = useCallback(
    async (asset: UploadAsset, options: UploadOptions): Promise<UploadResult> => {
      if (!token || !visitId) return { media: null, locationSnap: null };
      setUploadingType(options.assetType);
      setUploadError(null);
      try {
        const file = resolveAssetUpload(asset, options.assetType.toLowerCase());
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as unknown as Blob);
        formData.append('assetType', options.assetType);

        // Attach GPS for insight photos
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

        const response = await apiUpload<{
          media?: ScooperVisitMedia;
          locationSnap?: LocationSnapResult | null;
        }>(
          `/api/field-tech/visits/${visitId}/media`,
          {
            token,
            body: formData,
          },
        );
        await onRefresh();

        // Track location snap result for UI feedback
        const snapResult = response?.locationSnap ?? null;
        if (snapResult) {
          setLastLocationSnap(snapResult);
        }

        return {
          media: response?.media ?? null,
          locationSnap: snapResult,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to upload media.';
        setUploadError(message);
        return { media: null, locationSnap: null };
      } finally {
        setUploadingType(null);
      }
    },
    [token, visitId, onRefresh],
  );

  const deleteMedia = useCallback(
    async (mediaId: string) => {
      if (!token || !visitId || !mediaId) return;
      setUploadError(null);
      try {
        await apiRequest(`/api/field-tech/visits/${visitId}/media/${mediaId}`, {
          method: 'DELETE',
          token,
        });
        await onRefresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to remove media.';
        setUploadError(message);
      }
    },
    [token, visitId, onRefresh],
  );

  return {
    categories,
    sanitationCaptured,
    uploadingType,
    uploadError,
    lastLocationSnap,
    uploadMedia,
    deleteMedia,
  };
}
