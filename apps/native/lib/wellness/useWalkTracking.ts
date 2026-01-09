import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type WalkPoint = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  timestamp?: string | null;
};

export type TrackingState = 'idle' | 'recording' | 'paused' | 'saving';

const MAX_POINTS = 5000;
const MIN_POINT_DISTANCE_METERS = 2;
const MAX_ACCURACY_METERS = 50;

/**
 * Calculate distance in meters between two points using Haversine formula
 */
export const haversineMeters = (a: WalkPoint, b: WalkPoint): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.sqrt(h));
};

/**
 * Format meters to human-readable distance string
 */
export const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters)) return '0.0 mi';
  const miles = meters / 1609.34;
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.28084);
    return `${feet} ft`;
  }
  return `${miles.toFixed(2)} mi`;
};

/**
 * Format seconds to human-readable duration string
 */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Convert WalkPoint to LatLng format for react-native-maps
 */
export const toLatLng = (point: WalkPoint) => ({
  latitude: point.lat,
  longitude: point.lng,
});

export type UseWalkTrackingReturn = {
  // State
  state: TrackingState;
  points: WalkPoint[];
  distanceMeters: number;
  elapsedSeconds: number;
  error: string | null;
  startedAt: Date | null;

  // Computed values
  distanceLabel: string;
  durationLabel: string;
  paceLabel: string;

  // Actions
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  finish: () => Promise<{ points: WalkPoint[]; distance: number } | null>;
  reset: () => void;
};

export function useWalkTracking(): UseWalkTrackingReturn {
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<WalkPoint | null>(null);
  const resumeSkipRef = useRef(true);
  const distanceRef = useRef(0);

  const [state, setState] = useState<TrackingState>('idle');
  const [points, setPoints] = useState<WalkPoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [pauseStartedAt, setPauseStartedAt] = useState<Date | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [ticker, setTicker] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Calculate elapsed seconds
  const elapsedSeconds = (() => {
    if (!startedAt) return 0;
    const now = pauseStartedAt ?? new Date();
    const raw = now.getTime() - startedAt.getTime() - pausedMs;
    return Math.max(0, Math.floor(raw / 1000));
  })();

  // Computed labels
  const distanceLabel = formatDistance(distanceMeters);
  const durationLabel = formatDuration(elapsedSeconds);
  const paceLabel = (() => {
    if (!distanceMeters || distanceMeters <= 0) return '—';
    const miles = distanceMeters / 1609.34;
    if (miles <= 0) return '—';
    const paceSeconds = Math.round(elapsedSeconds / miles);
    return `${formatDuration(paceSeconds)} / mi`;
  })();

  // Timer tick for live updates
  useEffect(() => {
    if (state !== 'recording') return;
    const interval = setInterval(() => setTicker((v) => v + 1), 1000);
    return () => clearInterval(interval);
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, []);

  const clearTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    lastPointRef.current = null;
    resumeSkipRef.current = true;
    distanceRef.current = 0;
    setPoints([]);
    setDistanceMeters(0);
    setStartedAt(null);
    setPauseStartedAt(null);
    setPausedMs(0);
    setTicker(0);
    setError(null);
  }, []);

  const appendPoint = useCallback((point: WalkPoint) => {
    setPoints((prev) => {
      if (prev.length >= MAX_POINTS) return prev;
      if (point.accuracy && point.accuracy > MAX_ACCURACY_METERS) return prev;

      const last = lastPointRef.current;
      if (resumeSkipRef.current || !last) {
        lastPointRef.current = point;
        resumeSkipRef.current = false;
        return [...prev, point];
      }

      const delta = haversineMeters(last, point);
      if (delta < MIN_POINT_DISTANCE_METERS) return prev;

      lastPointRef.current = point;
      distanceRef.current += delta;
      setDistanceMeters(distanceRef.current);
      return [...prev, point];
    });
  }, []);

  const startLocationWatch = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 5,
        timeInterval: 4000,
      },
      (position) => {
        const coords = position.coords;
        if (!coords) return;
        appendPoint({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy ?? null,
          timestamp: new Date(position.timestamp).toISOString(),
        });
      },
    );
  }, [appendPoint]);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    setError(null);

    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setError('Location permission is required to track walks.');
      return;
    }

    clearTracking();
    setStartedAt(new Date());
    setState('recording');
    resumeSkipRef.current = true;

    await startLocationWatch();

    // Get initial position
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    }).catch(() => null);

    if (current?.coords) {
      appendPoint({
        lat: current.coords.latitude,
        lng: current.coords.longitude,
        accuracy: current.coords.accuracy ?? null,
        timestamp: new Date(current.timestamp).toISOString(),
      });
    }
  }, [state, clearTracking, startLocationWatch, appendPoint]);

  const pause = useCallback(() => {
    if (state !== 'recording') return;
    watchRef.current?.remove();
    watchRef.current = null;
    setPauseStartedAt(new Date());
    setState('paused');
  }, [state]);

  const resume = useCallback(async () => {
    if (state !== 'paused') return;
    if (pauseStartedAt) {
      setPausedMs((prev) => prev + (new Date().getTime() - pauseStartedAt.getTime()));
    }
    setPauseStartedAt(null);
    setState('recording');
    resumeSkipRef.current = true;
    await startLocationWatch();
  }, [state, pauseStartedAt, startLocationWatch]);

  const finish = useCallback(async (): Promise<{ points: WalkPoint[]; distance: number } | null> => {
    if (state === 'saving' || state === 'idle') return null;

    watchRef.current?.remove();
    watchRef.current = null;

    if (!startedAt) {
      setError('Unable to save the walk. Please try again.');
      setState('paused');
      return null;
    }

    setState('saving');

    try {
      let finalPoints = [...points];
      let distance = distanceRef.current;

      // If we don't have enough points, try to get current position
      if (finalPoints.length < 2) {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        }).catch(() => null);

        if (current?.coords) {
          const newPoint: WalkPoint = {
            lat: current.coords.latitude,
            lng: current.coords.longitude,
            accuracy: current.coords.accuracy ?? null,
            timestamp: new Date(current.timestamp).toISOString(),
          };

          if (finalPoints.length === 1) {
            distance += haversineMeters(finalPoints[0], newPoint);
          }
          finalPoints = [...finalPoints, newPoint];
          distanceRef.current = distance;
          setDistanceMeters(distance);
          setPoints(finalPoints);
        }
      }

      if (finalPoints.length < 2) {
        setError('Add a little more movement to save the walk.');
        setState('paused');
        return null;
      }

      return { points: finalPoints, distance };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save walk.');
      setState('paused');
      return null;
    }
  }, [state, startedAt, points]);

  const reset = useCallback(() => {
    clearTracking();
    setState('idle');
  }, [clearTracking]);

  return {
    state,
    points,
    distanceMeters,
    elapsedSeconds,
    error,
    startedAt,
    distanceLabel,
    durationLabel,
    paceLabel,
    start,
    pause,
    resume,
    finish,
    reset,
  };
}
