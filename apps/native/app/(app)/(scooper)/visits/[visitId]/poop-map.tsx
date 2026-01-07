import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Circle, Marker, Polygon, type LatLng } from 'react-native-maps';

import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';

type PoopMapPoint = {
  id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  capturedAt: string;
  source: 'OWNER' | 'PRO';
};

type HomeLocation = { lat: number; lng: number } | null;
type MapViewMode = 'pins' | 'heat';
type ParcelBoundary = {
  parcelId: string;
  source: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};
type ParcelAvailability = 'available' | 'missing' | 'unknown';
type ApproxFence = { lat: number; lng: number; radiusMeters: number };
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
  const [approxFence, setApproxFence] = useState<ApproxFence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>('pins');

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
        approxFence?: ApproxFence | null;
      }>(`/api/field-tech/visits/${resolvedVisitId}/poop-map`, {
        token: session.token,
        timeoutMs: 15000,
      });
      setPoints(data.points ?? []);
      setHomeLocation(data.homeLocation ?? null);
      setParcel(data.parcel ?? null);
      setParcelAvailability(data.parcelAvailability ?? 'unknown');
      setApproxFence(data.approxFence ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load poop map.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token, resolvedVisitId]);

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
    if (approxFence) {
      const metersPerLat = 111111;
      const latDelta = (approxFence.radiusMeters / metersPerLat) * 2.4;
      const lngDelta =
        latDelta / Math.max(0.2, Math.cos((approxFence.lat * Math.PI) / 180));
      return {
        latitude: approxFence.lat,
        longitude: approxFence.lng,
        latitudeDelta: Math.max(0.002, latDelta),
        longitudeDelta: Math.max(0.002, lngDelta),
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
  }, [parcelCoordinates, approxFence, homeLocation, points]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (parcelCoordinates.length > 0) {
      mapRef.current.fitToCoordinates(parcelCoordinates, {
        edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
        animated: true,
      });
      return;
    }
    if (approxFence) {
      mapRef.current.animateToRegion(
        {
          latitude: approxFence.lat,
          longitude: approxFence.lng,
          latitudeDelta: Math.max(0.002, (approxFence.radiusMeters / 111111) * 2.4),
          longitudeDelta:
            Math.max(0.002, (approxFence.radiusMeters / 111111) * 2.4) /
            Math.max(0.2, Math.cos((approxFence.lat * Math.PI) / 180)),
        },
        450,
      );
    }
  }, [mapReady, parcelCoordinates, approxFence]);

  const ownerColor = Colors.brand.mint;
  const proColor = Colors.brand.coral;
  const heatBase = '243, 100, 91';
  const heatBuckets = useMemo(() => {
    if (!points.length) return [];
    const gridMeters = 6;
    const buckets = new Map<string, { lat: number; lng: number; count: number }>();
    points.forEach((point) => {
      const metersPerLat = 111111;
      const metersPerLng = Math.max(1, 111111 * Math.cos((point.lat * Math.PI) / 180));
      const latSize = gridMeters / metersPerLat;
      const lngSize = gridMeters / metersPerLng;
      const latKey = Math.round(point.lat / latSize);
      const lngKey = Math.round(point.lng / lngSize);
      const key = `${latKey}:${lngKey}`;
      const bucketLat = latKey * latSize;
      const bucketLng = lngKey * lngSize;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, { lat: bucketLat, lng: bucketLng, count: 1 });
      }
    });
    return Array.from(buckets.values());
  }, [points]);
  const heatMax = useMemo(
    () => heatBuckets.reduce((max, item) => Math.max(max, item.count), 1),
    [heatBuckets],
  );
  const parcelStroke = hexToRgba(palette.accent, 0.65);
  const parcelFill = hexToRgba(palette.accent, 0.14);
  const approxStroke = hexToRgba(palette.tint, 0.5);
  const approxFill = hexToRgba(palette.tint, 0.08);

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
            Optional reference before you capture a sample.
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
              onMapReady={() => setMapReady(true)}
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
              {approxFence && parcelPolygons.length === 0 ? (
                <Circle
                  center={{ latitude: approxFence.lat, longitude: approxFence.lng }}
                  radius={approxFence.radiusMeters}
                  strokeColor={approxStroke}
                  fillColor={approxFill}
                  strokeWidth={2}
                />
              ) : null}
              {viewMode === 'pins'
                ? points.map((point) => (
                    <Marker
                      key={point.id}
                      coordinate={{ latitude: point.lat, longitude: point.lng } as LatLng}
                      pinColor={point.source === 'OWNER' ? ownerColor : proColor}
                    />
                  ))
                : heatBuckets.map((bucket, index) => {
                    const intensity = Math.min(1, bucket.count / heatMax);
                    const alpha = 0.2 + intensity * 0.55;
                    const radius = 6 + Math.min(18, bucket.count * 3);
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

          {parcelAvailability === 'missing' ? (
            <View style={styles.noticeRow}>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Parcel boundaries are still loading here. Showing an approximate yard area.
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
        </View>

        <Pressable onPress={loadData}>
          <Text style={[styles.refreshText, { color: palette.muted }]}>Refresh map</Text>
        </Pressable>
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
  refreshText: {
    textAlign: 'center',
    fontSize: 12,
  },
});
