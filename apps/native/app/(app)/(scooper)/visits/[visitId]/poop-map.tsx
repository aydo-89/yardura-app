import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Circle, Marker, Polygon, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { DARK_MAP_STYLE } from '@/lib/maps/style';
import PoopMapPlacementModal from '@/components/maps/PoopMapPlacementModal';
import { API_BASE_URL } from '@/lib/config';
import {
  LOW_CONFIDENCE_THRESHOLD_METERS,
  clampNumber,
  getAccuracyFactor,
  getAccuracyMeters,
  getAccuracyWeight,
  getDecayWeight,
} from '@/lib/maps/poopMap';

type PoopMapPoint = {
  id: string;
  sourceId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  capturedAt: string;
  source: 'OWNER' | 'PRO';
  imageUrl?: string | null;
  visitId?: string | null;
};

type HomeLocation = { lat: number; lng: number } | null;
type MapViewMode = 'pins' | 'heat';
type ParcelBoundary = {
  parcelId: string;
  source: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};
type ParcelAvailability = 'available' | 'missing' | 'unknown';
type ParcelPolygon = {
  outline: LatLng[];
  holes: LatLng[][];
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function ScooperPoopMapScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const resolvedVisitId = Array.isArray(visitId) ? visitId[0] : visitId;
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [points, setPoints] = useState<PoopMapPoint[]>([]);
  const [homeLocation, setHomeLocation] = useState<HomeLocation>(null);
  const [parcel, setParcel] = useState<ParcelBoundary | null>(null);
  const [parcelAvailability, setParcelAvailability] =
    useState<ParcelAvailability>('unknown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>('pins');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [revealedImages, setRevealedImages] = useState<Record<string, boolean>>({});
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementTarget, setPlacementTarget] = useState<{
    id: string;
    lat: number;
    lng: number;
    accuracy?: number | null;
  } | null>(null);

  const resolvedBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

  const loadData = useCallback(async () => {
    if (!session?.token || !resolvedVisitId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        points: PoopMapPoint[];
        homeLocation: HomeLocation;
        parcel?: ParcelBoundary | null;
        parcelAvailability?: ParcelAvailability;
      }>(`/api/field-tech/visits/${resolvedVisitId}/poop-map`, {
        token: session.token,
        timeoutMs: 15000,
      });
      setPoints(data.points ?? []);
      setHomeLocation(data.homeLocation ?? null);
      const nextParcel = data.parcel ?? null;
      const nextAvailability =
        data.parcelAvailability ?? (nextParcel ? 'available' : 'unknown');
      setParcel(nextParcel);
      setParcelAvailability(nextAvailability);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load poop map.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token, resolvedVisitId]);

  const openPlacement = useCallback(
    (point: PoopMapPoint) => {
      if (point.source !== 'PRO' || point.visitId !== resolvedVisitId) return;
      setPlacementTarget({
        id: point.sourceId,
        lat: point.lat,
        lng: point.lng,
        accuracy: point.accuracy ?? null,
      });
      setPlacementOpen(true);
    },
    [resolvedVisitId],
  );

  const handlePlacementSave = useCallback(
    async (nextLocation: { lat: number; lng: number; accuracy?: number | null }) => {
      if (!session?.token || !resolvedVisitId || !placementTarget) return;
      try {
        await apiRequest(`/api/field-tech/visits/${resolvedVisitId}/media/${placementTarget.id}`, {
          method: 'PATCH',
          token: session.token,
          body: {
            lat: nextLocation.lat,
            lng: nextLocation.lng,
            accuracy: 3,
            rawLat: placementTarget.lat,
            rawLng: placementTarget.lng,
            rawAccuracy: placementTarget.accuracy ?? null,
          },
        });
        await loadData();
      } catch (err) {
        console.warn('poop-map.location.update.failed', err);
      } finally {
        setPlacementOpen(false);
        setPlacementTarget(null);
      }
    },
    [loadData, placementTarget, resolvedVisitId, session?.token],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const parcelPolygons = useMemo<ParcelPolygon[]>(() => {
    if (!parcel?.geometry) return [];
    const polygons =
      parcel.geometry.type === 'Polygon'
        ? [parcel.geometry.coordinates]
        : parcel.geometry.coordinates;
    return polygons.map((rings) => {
      const [outer, ...holes] = rings;
      return {
        outline: outer.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
        holes: holes.map((ring) => ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))),
      };
    });
  }, [parcel]);
  const parcelCoordinates = useMemo(
    () => parcelPolygons.flatMap((polygon) => polygon.outline),
    [parcelPolygons],
  );

  const mapRegion = useMemo(() => {
    if (parcelCoordinates.length > 0) {
      const lats = parcelCoordinates.map((coord) => coord.latitude);
      const lngs = parcelCoordinates.map((coord) => coord.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(0.002, maxLat - minLat + 0.002),
        longitudeDelta: Math.max(0.002, maxLng - minLng + 0.002),
      };
    }
    if (homeLocation) {
      return {
        latitude: homeLocation.lat,
        longitude: homeLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    if (points.length === 0) return null;
    const coords = points.map((point) => ({ latitude: point.lat, longitude: point.lng }));
    const lats = coords.map((coord) => coord.latitude);
    const lngs = coords.map((coord) => coord.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, maxLat - minLat + 0.01),
      longitudeDelta: Math.max(0.01, maxLng - minLng + 0.01),
    };
  }, [parcelCoordinates, homeLocation, points]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (parcelCoordinates.length > 0) {
      mapRef.current.fitToCoordinates(parcelCoordinates, {
        edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
        animated: true,
      });
    }
  }, [mapReady, parcelCoordinates]);

  const ownerColor = Colors.brand.mint;
  const proColor = Colors.brand.coral;
  const heatBase = '243, 100, 91';
  const pointsWithMeta = useMemo(
    () =>
      points.map((point) => {
        const accuracyMeters = getAccuracyMeters(point.accuracy);
        const decayWeight = getDecayWeight(point.capturedAt);
        const accuracyFactor = getAccuracyFactor(accuracyMeters);
        const opacity = clampNumber(decayWeight, 0.15, 1);
        const showMarker = accuracyMeters <= LOW_CONFIDENCE_THRESHOLD_METERS;
        return {
          ...point,
          accuracyMeters,
          decayWeight,
          accuracyFactor,
          opacity,
          showMarker,
        };
      }),
    [points],
  );
  const selectedPoint = useMemo(
    () => pointsWithMeta.find((point) => point.id === selectedPointId) ?? null,
    [pointsWithMeta, selectedPointId],
  );
  const selectedImageUri =
    selectedPoint?.imageUrl &&
    typeof selectedPoint.imageUrl === 'string'
      ? selectedPoint.imageUrl.startsWith('http')
        ? selectedPoint.imageUrl
        : `${resolvedBaseUrl}${selectedPoint.imageUrl.startsWith('/') ? '' : '/'}${selectedPoint.imageUrl}`
      : null;
  const selectedMeta = useMemo(() => {
    if (!selectedPoint) return null;
    const label = selectedPoint.source === 'OWNER' ? 'Owner capture' : 'Scooper capture';
    const parsed = new Date(selectedPoint.capturedAt);
    const when = Number.isNaN(parsed.getTime())
      ? selectedPoint.capturedAt
      : parsed.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
    return { label, when };
  }, [selectedPoint]);

  useEffect(() => {
    if (viewMode === 'heat') {
      setSelectedPointId(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (selectedPointId && !points.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [points, selectedPointId]);

  const heatBuckets = useMemo(() => {
    if (!points.length) return [];
    const gridMeters = 6;
    const buckets = new Map<
      string,
      { lat: number; lng: number; count: number; weight: number }
    >();
    pointsWithMeta.forEach((point) => {
      const metersPerLat = 111111;
      const metersPerLng = Math.max(1, 111111 * Math.cos((point.lat * Math.PI) / 180));
      const latSize = gridMeters / metersPerLat;
      const lngSize = gridMeters / metersPerLng;
      const latKey = Math.round(point.lat / latSize);
      const lngKey = Math.round(point.lng / lngSize);
      const key = `${latKey}:${lngKey}`;
      const bucketLat = latKey * latSize;
      const bucketLng = lngKey * lngSize;
      const weight = getAccuracyWeight(point.accuracyMeters) * point.decayWeight;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        existing.weight += weight;
      } else {
        buckets.set(key, { lat: bucketLat, lng: bucketLng, count: 1, weight });
      }
    });
    return Array.from(buckets.values());
  }, [pointsWithMeta, points.length]);
  const heatMax = useMemo(
    () => heatBuckets.reduce((max, item) => Math.max(max, item.weight), 0.0001),
    [heatBuckets],
  );
  const parcelStroke = hexToRgba(palette.accent, 0.65);
  const parcelFill = hexToRgba(palette.accent, 0.14);
  const hasParcel = parcelCoordinates.length > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <Text style={[styles.backText, { color: palette.tint }]}>Back</Text>
            </Pressable>
            <Text style={[styles.kicker, { color: palette.muted }]}>Poop map</Text>
          </View>
        <Text style={[styles.title, { color: palette.text }]}>Most active spots</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
            Optional reference before you capture a sample. Rings show GPS confidence.
        </Text>
      </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading map...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        <View style={[styles.mapCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {mapRegion ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              mapType={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'mutedStandard' : 'standard') : 'standard'}
              customMapStyle={colorScheme === 'dark' ? DARK_MAP_STYLE : []}
              onMapReady={() => setMapReady(true)}
              onPress={() => setSelectedPointId(null)}
            >
              {parcelPolygons.map((polygon, index) => (
                <Polygon
                  key={`parcel-${index}`}
                  coordinates={polygon.outline}
                  holes={polygon.holes.length ? polygon.holes : undefined}
                  strokeColor={parcelStroke}
                  fillColor={parcelFill}
                  strokeWidth={2}
                />
              ))}
              {/* No approx fence circle - only show actual parcel boundaries */}
              {viewMode === 'pins'
                ? (
                  <>
                    {pointsWithMeta.map((point) => {
                      const baseColor = point.source === 'OWNER' ? ownerColor : proColor;
                      const ringAlpha = clampNumber(
                        (0.08 + 0.22 * point.accuracyFactor) * point.decayWeight,
                        0.05,
                        0.5,
                      );
                      const ringStroke = clampNumber(
                        (0.18 + 0.35 * point.accuracyFactor) * point.decayWeight,
                        0.08,
                        0.7,
                      );
                      return (
                        <Circle
                          key={`${point.id}-accuracy`}
                          center={{ latitude: point.lat, longitude: point.lng }}
                          radius={point.accuracyMeters}
                          strokeColor={hexToRgba(baseColor, ringStroke)}
                          fillColor={hexToRgba(baseColor, ringAlpha)}
                          strokeWidth={1}
                        />
                      );
                    })}
                    {pointsWithMeta
                      .filter((point) => point.showMarker)
                      .map((point) => {
                        const baseColor = point.source === 'OWNER' ? ownerColor : proColor;
                        return (
                        <Marker
                          key={point.id}
                          coordinate={{ latitude: point.lat, longitude: point.lng } as LatLng}
                          pinColor={baseColor}
                          opacity={point.opacity}
                          onPress={() => setSelectedPointId(point.id)}
                        />
                        );
                      })}
                  </>
                )
                : heatBuckets.map((bucket, index) => {
                    const intensity = clampNumber(bucket.weight / heatMax, 0, 1);
                    const alpha = 0.15 + intensity * 0.65;
                    const radius = 6 + Math.sqrt(intensity) * 22;
                    return (
                      <Circle
                        key={`${bucket.lat}-${bucket.lng}-${index}`}
                        center={{ latitude: bucket.lat, longitude: bucket.lng }}
                        radius={radius}
                        strokeColor={`rgba(${heatBase}, ${Math.min(alpha + 0.15, 0.8)})`}
                        fillColor={`rgba(${heatBase}, ${alpha})`}
                      />
                    );
                  })}
            </MapView>
          ) : (
            <View style={styles.mapEmpty}>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                No map points yet. Capture a stool or complete a scoop to populate.
              </Text>
            </View>
          )}

          <View style={styles.toggleRow}>
            {(['pins', 'heat'] as MapViewMode[]).map((mode) => {
              const isActive = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setViewMode(mode)}
                  style={[
                    styles.toggleChip,
                    {
                      borderColor: isActive ? palette.tint : palette.border,
                      backgroundColor: isActive ? palette.tint : palette.card,
                    },
                  ]}
                >
                  <Text style={[styles.toggleText, { color: isActive ? '#FFFFFF' : palette.text }]}>
                    {mode === 'pins' ? 'Pins' : 'Heatmap'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!hasParcel && parcelAvailability === 'missing' ? (
            <View style={styles.noticeRow}>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Parcel boundaries aren’t available here yet. Pins still show captured locations.
              </Text>
            </View>
          ) : !hasParcel && parcelAvailability === 'unknown' ? (
            <View style={styles.noticeRow}>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Parcel boundaries couldn’t be loaded right now. Try refreshing in a moment.
              </Text>
            </View>
          ) : null}

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ownerColor }]} />
              <Text style={[styles.helperText, { color: palette.muted }]}>Owner capture</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: proColor }]} />
              <Text style={[styles.helperText, { color: palette.muted }]}>Pro capture</Text>
            </View>
          </View>
          <View style={styles.noticeRow}>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Rings show GPS confidence. Larger rings mean lower accuracy. Older points fade out automatically.
            </Text>
          </View>
        </View>

        {selectedPoint && viewMode === 'pins' ? (
          <View style={[styles.detailCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.detailHeaderRow}>
              <View>
                <Text style={[styles.detailTitle, { color: palette.text }]}>Sample details</Text>
                <Text style={[styles.detailMeta, { color: palette.muted }]}>
                  {selectedMeta?.label ?? 'Capture'} · {selectedMeta?.when ?? ''}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedPointId(null)}>
                <Text style={[styles.detailClose, { color: palette.tint }]}>Hide</Text>
              </Pressable>
            </View>

            {selectedImageUri ? (
              <Pressable
                onPress={() =>
                  setRevealedImages((prev) => ({
                    ...prev,
                    [selectedPoint.id]: !prev[selectedPoint.id],
                  }))
                }
                style={styles.detailImageWrap}
              >
                <Image
                  source={{ uri: selectedImageUri }}
                  style={styles.detailImage}
                  resizeMode="cover"
                  blurRadius={revealedImages[selectedPoint.id] ? 0 : 16}
                />
                {!revealedImages[selectedPoint.id] ? (
                  <View style={styles.blurOverlay}>
                    <FontAwesome name="eye" size={14} color="#F8FAFC" />
                    <Text style={styles.blurTitle}>Tap to reveal</Text>
                  </View>
                ) : (
                  <View style={styles.revealPill}>
                    <FontAwesome name="eye-slash" size={12} color="#F8FAFC" />
                    <Text style={styles.revealPillText}>Tap to blur</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <View style={[styles.noImage, { backgroundColor: palette.background }]}>
                <Text style={[styles.helperText, { color: palette.muted }]}>Photo unavailable</Text>
              </View>
            )}

            <Text style={[styles.detailHint, { color: palette.muted }]}>
              Precise pins build the hot-spot map so future visits here are faster and more complete.
            </Text>

            {selectedPoint.source === 'PRO' && selectedPoint.visitId === resolvedVisitId ? (
              <Button
                title="Adjust location"
                variant="secondary"
                onPress={() => openPlacement(selectedPoint)}
              />
            ) : null}
          </View>
        ) : null}

        <Pressable onPress={loadData}>
          <Text style={[styles.refreshText, { color: palette.muted }]}>Refresh map</Text>
        </Pressable>
      </ScrollView>
      {placementTarget && session?.token && resolvedVisitId ? (
        <PoopMapPlacementModal
          visible={placementOpen}
          token={session.token}
          mapEndpoint={`/api/field-tech/visits/${resolvedVisitId}/poop-map`}
          initialLocation={{
            lat: placementTarget.lat,
            lng: placementTarget.lng,
            accuracy: placementTarget.accuracy ?? null,
          }}
          title="Adjust pin placement"
          subtitle="Drag the pin to the exact spot. This builds a more accurate hot-spot map for faster future visits."
          onClose={() => setPlacementOpen(false)}
          onSave={handlePlacementSave}
        />
      ) : null}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
  },
  mapCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  map: {
    height: 280,
    width: '100%',
  },
  mapEmpty: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  toggleRow: {
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  toggleChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  noticeRow: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  detailClose: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailImage: {
    width: '100%',
    height: 160,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  blurTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  revealPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revealPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  noImage: {
    height: 160,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  refreshText: {
    textAlign: 'center',
    fontSize: 12,
  },
});
