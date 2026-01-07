import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import {
  clearPendingPassiveWalk,
  disablePassiveWalkDetection,
  enablePassiveWalkDetection,
  getPendingPassiveWalk,
  syncPassiveWalkDetection,
  type PassiveWalkPending,
} from '@/lib/wellness/passiveWalk';
import type { CustomerSummary, DogSummary, WellnessWalk } from '@/lib/api/types';

type WalkPoint = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  timestamp?: string | null;
};

type TrackingState = 'idle' | 'recording' | 'paused' | 'saving';

const MAX_POINTS = 5000;
const MIN_POINT_DISTANCE_METERS = 2;
const MAX_ACCURACY_METERS = 50;

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
];

const formatDistance = (meters: number) => {
  if (!Number.isFinite(meters)) return '0.0 mi';
  const miles = meters / 1609.34;
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.28084);
    return `${feet} ft`;
  }
  return `${miles.toFixed(2)} mi`;
};

const formatDuration = (seconds: number) => {
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

const toLatLng = (point: WalkPoint): LatLng => ({
  latitude: point.lat,
  longitude: point.lng,
});

const haversineMeters = (a: WalkPoint, b: WalkPoint) => {
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

export default function WellnessWalksScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<WalkPoint | null>(null);
  const resumeSkipRef = useRef(true);
  const distanceRef = useRef(0);

  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [walks, setWalks] = useState<WellnessWalk[]>([]);
  const [selectedWalkId, setSelectedWalkId] = useState<string | null>(null);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingState>('idle');
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingPoints, setTrackingPoints] = useState<WalkPoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [pauseStartedAt, setPauseStartedAt] = useState<Date | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [ticker, setTicker] = useState(0);
  const [loading, setLoading] = useState(false);
  const [passiveEnabled, setPassiveEnabled] = useState(false);
  const [pendingWalk, setPendingWalk] = useState<PassiveWalkPending | null>(null);
  const [pendingDogId, setPendingDogId] = useState<string | null>(null);
  const [passiveError, setPassiveError] = useState<string | null>(null);
  const [passiveLoading, setPassiveLoading] = useState(false);
  const [confirmingPending, setConfirmingPending] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  const access = summary?.wellnessAccess ?? null;
  const hasAccess = Boolean(access);
  const isPremium =
    access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO' || access?.hasActiveService;

  const selectedWalk = useMemo(
    () => walks.find((walk) => walk.id === selectedWalkId) ?? walks[0] ?? null,
    [walks, selectedWalkId],
  );

  const mapPoints = useMemo(() => {
    if (trackingState !== 'idle' && trackingPoints.length) {
      return trackingPoints.map(toLatLng);
    }
    if (selectedWalk?.path?.length) {
      return selectedWalk.path.map((point) => ({
        latitude: point.lat,
        longitude: point.lng,
      }));
    }
    return [];
  }, [trackingPoints, trackingState, selectedWalk]);

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0;
    const now = pauseStartedAt ?? new Date();
    const raw = now.getTime() - startedAt.getTime() - pausedMs;
    return Math.max(0, Math.floor(raw / 1000));
  }, [startedAt, pausedMs, pauseStartedAt, ticker]);

  const displayDistanceMeters =
    trackingState === 'idle' ? selectedWalk?.distanceMeters ?? 0 : distanceMeters;
  const displayDurationSeconds =
    trackingState === 'idle' ? selectedWalk?.durationSeconds ?? 0 : elapsedSeconds;

  const paceLabel = useMemo(() => {
    if (!displayDistanceMeters || displayDistanceMeters <= 0) return '—';
    const miles = displayDistanceMeters / 1609.34;
    if (miles <= 0) return '—';
    const paceSeconds = Math.round(displayDurationSeconds / miles);
    return `${formatDuration(paceSeconds)} / mi`;
  }, [displayDistanceMeters, displayDurationSeconds]);

  const activeDogLabel = useMemo(() => {
    if (trackingState !== 'idle') {
      return selectedDogId ? dogs.find((dog) => dog.id === selectedDogId)?.name ?? 'Dog' : 'Household';
    }
    return selectedWalk?.dogName ?? 'Household';
  }, [dogs, selectedDogId, selectedWalk, trackingState]);

  const activeDateLabel = useMemo(() => {
    if (trackingState !== 'idle') {
      return startedAt
        ? startedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : 'In progress';
    }
    if (!selectedWalk?.startedAt) return 'Route preview';
    return new Date(selectedWalk.startedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedWalk?.startedAt, startedAt, trackingState]);

  const loadSummary = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
        token: session.token,
      });
      setSummary(data);
    } catch (err) {
      console.warn('load-summary.failed', err);
    }
  }, [session?.token]);

  const loadDogs = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
        token: session.token,
      });
      setDogs(data.dogs ?? []);
    } catch (err) {
      console.warn('load-dogs.failed', err);
    }
  }, [session?.token]);

  const loadWalks = useCallback(async () => {
    if (!session?.token || !isPremium) return;
    setLoading(true);
    try {
      const data = await apiRequest<{ walks: WellnessWalk[] }>('/api/mobile/customer/walks?limit=20', {
        token: session.token,
      });
      setWalks(data.walks ?? []);
      setSelectedWalkId((prev) => prev ?? data.walks?.[0]?.id ?? null);
    } catch (err) {
      console.warn('load-walks.failed', err);
    } finally {
      setLoading(false);
    }
  }, [session?.token, isPremium]);

  const loadPassiveState = useCallback(async () => {
    const [state, pending] = await Promise.all([
      syncPassiveWalkDetection(),
      getPendingPassiveWalk(),
    ]);
    setPassiveEnabled(state?.enabled ?? false);
    setPendingWalk(pending);
    if (pending && !pendingDogId) {
      setPendingDogId(null);
    }
  }, [pendingDogId]);

  useEffect(() => {
    loadSummary();
    loadDogs();
  }, [loadSummary, loadDogs]);

  useFocusEffect(
    useCallback(() => {
      loadPassiveState();
    }, [loadPassiveState]),
  );

  useEffect(() => {
    if (isPremium) {
      loadWalks();
    }
  }, [isPremium, loadWalks]);

  useEffect(() => {
    if (!hasAccess) return;
    if (isPremium || !passiveEnabled) return;
    disablePassiveWalkDetection()
      .catch(() => null)
      .finally(() => setPassiveEnabled(false));
  }, [hasAccess, isPremium, passiveEnabled]);

  useEffect(() => {
    if (trackingState !== 'recording') return;
    const interval = setInterval(() => setTicker((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [trackingState]);

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapPoints.length > 0 || mapRegion) return;
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) return null;
        return Location.getLastKnownPositionAsync({});
      })
      .then((position) => {
        if (!position?.coords) return;
        setMapRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      })
      .catch(() => null);
  }, [mapPoints.length, mapRegion]);

  useEffect(() => {
    if (!mapRef.current || mapPoints.length === 0) return;
    if (mapPoints.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: mapPoints[0].latitude,
          longitude: mapPoints[0].longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        400,
      );
      return;
    }
    mapRef.current.fitToCoordinates(mapPoints, {
      edgePadding: { top: 70, bottom: 120, left: 50, right: 50 },
      animated: true,
    });
  }, [mapPoints]);

  const clearTracking = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    lastPointRef.current = null;
    resumeSkipRef.current = true;
    distanceRef.current = 0;
    setTrackingPoints([]);
    setDistanceMeters(0);
    setStartedAt(null);
    setPauseStartedAt(null);
    setPausedMs(0);
    setTicker(0);
  };

  const appendPoint = (point: WalkPoint) => {
    if (trackingPoints.length >= MAX_POINTS) return;
    if (point.accuracy && point.accuracy > MAX_ACCURACY_METERS) return;

    const last = lastPointRef.current;
    if (resumeSkipRef.current || !last) {
      lastPointRef.current = point;
      resumeSkipRef.current = false;
      setTrackingPoints((prev) => [...prev, point]);
      return;
    }
    const delta = haversineMeters(last, point);
    if (delta < MIN_POINT_DISTANCE_METERS) return;
    lastPointRef.current = point;
    distanceRef.current += delta;
    setDistanceMeters(distanceRef.current);
    setTrackingPoints((prev) => [...prev, point]);
  };

  const startLocationWatch = async () => {
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
  };

  const handleStart = async () => {
    if (trackingState !== 'idle') return;
    setTrackingError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setTrackingError('Location permission is required to track walks.');
      return;
    }
    clearTracking();
    setStartedAt(new Date());
    setTrackingState('recording');
    resumeSkipRef.current = true;
    await startLocationWatch();
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
  };

  const handlePause = () => {
    if (trackingState !== 'recording') return;
    watchRef.current?.remove();
    watchRef.current = null;
    setPauseStartedAt(new Date());
    setTrackingState('paused');
  };

  const handleResume = async () => {
    if (trackingState !== 'paused') return;
    if (pauseStartedAt) {
      setPausedMs((prev) => prev + (new Date().getTime() - pauseStartedAt.getTime()));
    }
    setPauseStartedAt(null);
    setTrackingState('recording');
    resumeSkipRef.current = true;
    await startLocationWatch();
  };

  const handleFinish = async () => {
    if (trackingState === 'saving' || trackingState === 'idle') return;
    watchRef.current?.remove();
    watchRef.current = null;
    if (!session?.token || !startedAt) {
      setTrackingError('Unable to save the walk. Please try again.');
      setTrackingState('paused');
      return;
    }
    setTrackingState('saving');
    try {
      let points = trackingPoints;
      let distance = distanceRef.current;
      if (points.length < 2) {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        }).catch(() => null);
        if (current?.coords) {
          const newPoint = {
            lat: current.coords.latitude,
            lng: current.coords.longitude,
            accuracy: current.coords.accuracy ?? null,
            timestamp: new Date(current.timestamp).toISOString(),
          };
          if (points.length === 1) {
            distance += haversineMeters(points[0], newPoint);
          }
          points = [...points, newPoint];
          distanceRef.current = distance;
          setDistanceMeters(distance);
          setTrackingPoints(points);
        }
      }
      if (points.length < 2) {
        setTrackingError('Add a little more movement to save the walk.');
        setTrackingState('paused');
        return;
      }
      const endedAt = new Date();
      const durationSeconds = Math.max(1, Math.floor((endedAt.getTime() - startedAt.getTime() - pausedMs) / 1000));
      const payload = {
        dogId: selectedDogId ?? null,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds,
        distanceMeters: Math.max(0, distance),
        path: points,
        metadata: {
          pointsCount: points.length,
          avgAccuracyMeters:
            points.length > 0
              ? Math.round(
                  points.reduce((sum, point) => sum + (point.accuracy ?? 0), 0) / points.length,
                )
              : null,
        },
      };
      const data = await apiRequest<{ walk: WellnessWalk }>(
        '/api/mobile/customer/walks',
        {
          method: 'POST',
          token: session.token,
          body: payload,
        },
      );
      if (data?.walk) {
        setWalks((prev) => [data.walk, ...prev]);
        setSelectedWalkId(data.walk.id);
      }
      clearTracking();
      setTrackingState('idle');
    } catch (err) {
      setTrackingError(err instanceof Error ? err.message : 'Unable to save walk.');
      setTrackingState('paused');
    }
  };

  const handleDeleteWalk = (walk: WellnessWalk) => {
    if (!session?.token) return;
    Alert.alert('Delete walk?', 'This removes the walk from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/api/mobile/customer/walks/${walk.id}`, {
              method: 'DELETE',
              token: session.token,
            });
            setWalks((prev) => prev.filter((item) => item.id !== walk.id));
            if (selectedWalkId === walk.id) {
              setSelectedWalkId(null);
            }
          } catch (err) {
            Alert.alert('Unable to delete', err instanceof Error ? err.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const handlePassiveToggle = async (value: boolean) => {
    if (passiveLoading) return;
    setPassiveError(null);
    setPassiveLoading(true);
    try {
      if (value) {
        await enablePassiveWalkDetection();
      } else {
        await disablePassiveWalkDetection();
      }
      setPassiveEnabled(value);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to update passive walk tracking.';
      setPassiveError(message);
      setPassiveEnabled(false);
    } finally {
      setPassiveLoading(false);
    }
  };

  const handleDismissPending = async () => {
    await clearPendingPassiveWalk();
    setPendingWalk(null);
    setPendingDogId(null);
  };

  const handleConfirmPending = async () => {
    if (!session?.token || !pendingWalk) return;
    if (!pendingWalk.path || pendingWalk.path.length < 2) {
      setPassiveError('Walk route is too short to save. Please track manually.');
      return;
    }
    setConfirmingPending(true);
    setPassiveError(null);
    try {
      const payload = {
        dogId: pendingDogId ?? null,
        startedAt: pendingWalk.startedAt,
        endedAt: pendingWalk.endedAt,
        durationSeconds: pendingWalk.durationSeconds,
        distanceMeters: pendingWalk.distanceMeters,
        path: pendingWalk.path,
        metadata: {
          source: 'passive',
          averageSpeedMps: pendingWalk.averageSpeedMps,
          maxSpeedMps: pendingWalk.maxSpeedMps,
        },
      };
      const data = await apiRequest<{ walk: WellnessWalk }>('/api/mobile/customer/walks', {
        method: 'POST',
        token: session.token,
        body: payload,
      });
      if (data?.walk) {
        setWalks((prev) => [data.walk, ...prev]);
        setSelectedWalkId(data.walk.id);
      }
      await clearPendingPassiveWalk();
      setPendingWalk(null);
      setPendingDogId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to save the walk.';
      setPassiveError(message);
    } finally {
      setConfirmingPending(false);
    }
  };

  const distanceLabel = formatDistance(displayDistanceMeters);
  const durationLabel = formatDuration(displayDurationSeconds);
  const pendingDistanceLabel = pendingWalk ? formatDistance(pendingWalk.distanceMeters) : null;
  const pendingDurationLabel = pendingWalk ? formatDuration(pendingWalk.durationSeconds) : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Premium walk tracker</Text>
          <Text style={[styles.title, { color: palette.text }]}>Track every walk</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            GPS distance, duration, and route history for your pup.
          </Text>
        </View>

        {!isPremium ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Premium feature</Text>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Upgrade to unlock GPS walk tracking, route history, and distance stats.
            </Text>
            <Button
              title="Upgrade wellness"
              onPress={() => {
                router.push('/(app)/(customer)/wellness-upgrade' as any);
              }}
            />
          </View>
        ) : (
          <>
            {pendingWalk ? (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>We detected a walk</Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  {pendingDistanceLabel ?? '--'} · {pendingDurationLabel ?? '--'}
                </Text>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Confirm the walk and choose the dog that went with you.
                </Text>
                <View style={styles.chipRow}>
                  <ChoiceChip
                    label="Household"
                    selected={!pendingDogId}
                    onPress={() => setPendingDogId(null)}
                  />
                  {dogs.map((dog) => (
                    <ChoiceChip
                      key={dog.id}
                      label={dog.name}
                      selected={pendingDogId === dog.id}
                      onPress={() => setPendingDogId(dog.id)}
                    />
                  ))}
                </View>
                <View style={styles.actionRow}>
                  <Button
                    title={confirmingPending ? 'Saving...' : 'Confirm walk'}
                    onPress={handleConfirmPending}
                    disabled={confirmingPending}
                  />
                  <Button
                    title="Not a walk"
                    onPress={handleDismissPending}
                    variant="secondary"
                    disabled={confirmingPending}
                  />
                </View>
                {passiveError ? (
                  <Text style={[styles.helperText, { color: palette.danger }]}>{passiveError}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Passive walk detection
                </Text>
                <Switch value={passiveEnabled} onValueChange={handlePassiveToggle} />
              </View>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                We will look for walking pace movement and prompt you to confirm.
              </Text>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Requires background location permission and may increase battery usage.
              </Text>
              {passiveLoading ? (
                <Text style={[styles.helperText, { color: palette.muted }]}>Updating...</Text>
              ) : null}
              {passiveError ? (
                <Text style={[styles.helperText, { color: palette.danger }]}>{passiveError}</Text>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Walk controls</Text>
                {trackingState === 'recording' ? (
                  <View style={[styles.liveBadge, { backgroundColor: palette.tint }]}>
                    <Text style={styles.liveBadgeText}>Live</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Keep the app open while tracking for the most accurate route.
              </Text>

              <Text style={[styles.fieldLabel, { color: palette.muted }]}>Dog (optional)</Text>
              <View style={styles.chipRow}>
                <ChoiceChip
                  label="Household"
                  selected={!selectedDogId}
                  onPress={() => setSelectedDogId(null)}
                />
                {dogs.map((dog) => (
                  <ChoiceChip
                    key={dog.id}
                    label={dog.name}
                    selected={selectedDogId === dog.id}
                    onPress={() => setSelectedDogId(dog.id)}
                  />
                ))}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: palette.text }]}>{distanceLabel}</Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Distance</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: palette.text }]}>{durationLabel}</Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Time</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: palette.text }]}>{paceLabel}</Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Pace</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                {trackingState === 'idle' ? (
                  <Button title="Start walk" onPress={handleStart} />
                ) : trackingState === 'recording' ? (
                  <>
                    <Button title="Pause" onPress={handlePause} variant="secondary" />
                    <Button title="Finish" onPress={handleFinish} />
                  </>
                ) : trackingState === 'paused' ? (
                  <>
                    <Button title="Resume" onPress={handleResume} />
                    <Button title="Finish" onPress={handleFinish} variant="secondary" />
                  </>
                ) : (
                  <View style={styles.inlineRow}>
                    <ActivityIndicator size="small" color={palette.tint} />
                    <Text style={[styles.helperText, { color: palette.muted }]}>Saving...</Text>
                  </View>
                )}
              </View>
              {trackingError ? (
                <Text style={[styles.helperText, { color: palette.danger }]}>{trackingError}</Text>
              ) : null}
            </View>

            <View style={[styles.mapCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Route preview</Text>
              <View style={styles.mapWrapper}>
                <MapView
                  ref={(ref) => {
                    mapRef.current = ref;
                  }}
                  style={styles.map}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  mapType={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'mutedStandard' : 'standard') : 'standard'}
                  customMapStyle={colorScheme === 'dark' ? DARK_MAP_STYLE : []}
                  showsUserLocation={trackingState !== 'idle'}
                  showsMyLocationButton={trackingState !== 'idle'}
                  initialRegion={
                    mapRegion ?? {
                      latitude: 44.98,
                      longitude: -93.26,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }
                  }
                >
                  {mapPoints.length > 0 ? (
                    <>
                      <Polyline
                        coordinates={mapPoints}
                        strokeWidth={10}
                        strokeColor={colorScheme === 'dark' ? 'rgba(244, 100, 91, 0.25)' : 'rgba(244, 100, 91, 0.2)'}
                      />
                      <Polyline coordinates={mapPoints} strokeWidth={4} strokeColor={palette.tint} />
                      <Marker coordinate={mapPoints[0]} title="Start" pinColor="#22C55E" />
                      <Marker
                        coordinate={mapPoints[mapPoints.length - 1]}
                        title="Finish"
                        pinColor={palette.tint}
                      />
                    </>
                  ) : null}
                </MapView>
                <View style={[styles.routeOverlay, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.routeLabel, { color: palette.muted }]}>
                    {trackingState === 'idle' ? 'Route preview' : 'Live walk'}
                  </Text>
                  <Text style={[styles.routeTitle, { color: palette.text }]}>{activeDogLabel}</Text>
                  <Text style={[styles.routeMeta, { color: palette.muted }]}>{activeDateLabel}</Text>
                  <View style={styles.routeStats}>
                    <View style={styles.routeStat}>
                      <Text style={[styles.routeStatValue, { color: palette.text }]}>{distanceLabel}</Text>
                      <Text style={[styles.routeStatLabel, { color: palette.muted }]}>Distance</Text>
                    </View>
                    <View style={styles.routeStat}>
                      <Text style={[styles.routeStatValue, { color: palette.text }]}>{durationLabel}</Text>
                      <Text style={[styles.routeStatLabel, { color: palette.muted }]}>Time</Text>
                    </View>
                    <View style={styles.routeStat}>
                      <Text style={[styles.routeStatValue, { color: palette.text }]}>{paceLabel}</Text>
                      <Text style={[styles.routeStatLabel, { color: palette.muted }]}>Pace</Text>
                    </View>
                  </View>
                </View>
                {mapPoints.length === 0 ? (
                  <View style={[styles.mapEmpty, { backgroundColor: colorScheme === 'dark' ? 'rgba(2,6,23,0.35)' : 'rgba(15,23,42,0.06)' }]}>
                    <FontAwesome name="map" size={18} color={palette.muted} />
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Start a walk to see the route.
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent walks</Text>
              <Pressable onPress={loadWalks}>
                <Text style={[styles.helperText, { color: palette.tint }]}>Refresh</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.helperText, { color: palette.muted }]}>Loading walks...</Text>
              </View>
            ) : walks.length === 0 ? (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  No walks logged yet. Start one to build your history.
                </Text>
              </View>
            ) : (
              walks.map((walk) => {
                const dogLabel = walk.dogName ?? 'Household';
                const dateLabel = new Date(walk.startedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <Pressable
                    key={walk.id}
                    onPress={() => setSelectedWalkId(walk.id)}
                    style={[
                      styles.walkCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: walk.id === selectedWalk?.id ? palette.tint : palette.border,
                      },
                    ]}
                  >
                    <View style={styles.walkHeader}>
                      <Text style={[styles.walkTitle, { color: palette.text }]}>{dateLabel}</Text>
                      <Text style={[styles.helperText, { color: palette.muted }]}>{dogLabel}</Text>
                    </View>
                    <View style={styles.walkMetaRow}>
                      <Text style={[styles.helperText, { color: palette.muted }]}>
                        {formatDistance(walk.distanceMeters)} • {formatDuration(walk.durationSeconds)}
                      </Text>
                      <Pressable onPress={() => handleDeleteWalk(walk)}>
                        <Text style={[styles.helperText, { color: palette.danger }]}>Delete</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  mapCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  mapWrapper: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  routeOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  routeLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '600',
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  routeMeta: {
    fontSize: 12,
  },
  routeStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  routeStat: {
    flex: 1,
    minWidth: 90,
    gap: 2,
  },
  routeStatValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  routeStatLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mapEmpty: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 90,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walkCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  walkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walkTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  walkMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  liveBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
