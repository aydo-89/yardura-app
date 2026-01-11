import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polygon, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import MapLegend from '@/components/wellness/MapLegend';
import PointDetailCard from '@/components/wellness/PointDetailCard';
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
};

type HomeLocation = { lat: number; lng: number } | null;
type MapViewMode = 'pins' | 'heat';
type TimeFilter = '7d' | '30d' | 'all';
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

const TIME_FILTER_OPTIONS: Array<{ key: TimeFilter; label: string; days: number | null }> = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
];

export default function WellnessPoopMapScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [points, setPoints] = useState<PoopMapPoint[]>([]);
  const [homeLocation, setHomeLocation] = useState<HomeLocation>(null);
  const [parcel, setParcel] = useState<ParcelBoundary | null>(null);
  const [parcelAvailability, setParcelAvailability] = useState<ParcelAvailability>('unknown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>('pins');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementTarget, setPlacementTarget] = useState<{
    id: string;
    lat: number;
    lng: number;
    accuracy?: number | null;
  } | null>(null);

  const resolvedBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        points: PoopMapPoint[];
        homeLocation: HomeLocation;
        parcel?: ParcelBoundary | null;
        parcelAvailability?: ParcelAvailability;
      }>('/api/mobile/customer/poop-map', {
        token: session.token,
        timeoutMs: 15000,
      });
      setPoints(data.points ?? []);
      setHomeLocation(data.homeLocation ?? null);
      const nextParcel = data.parcel ?? null;
      const nextAvailability = data.parcelAvailability ?? (nextParcel ? 'available' : 'unknown');
      setParcel(nextParcel);
      setParcelAvailability(nextAvailability);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load poop map.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  const openPlacement = useCallback((point: PoopMapPoint) => {
    if (point.source !== 'OWNER') return;
    setPlacementTarget({
      id: point.sourceId,
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracy ?? null,
    });
    setPlacementOpen(true);
  }, []);

  const handlePlacementSave = useCallback(
    async (nextLocation: { lat: number; lng: number; accuracy?: number | null }) => {
      if (!session?.token || !placementTarget) return;
      try {
        await apiRequest(`/api/mobile/customer/wellness-captures/${placementTarget.id}`, {
          method: 'PATCH',
          token: session.token,
          body: {
            lat: nextLocation.lat,
            lng: nextLocation.lng,
            accuracy: nextLocation.accuracy ?? 3,
            rawLat: placementTarget.lat,
            rawLng: placementTarget.lng,
            rawAccuracy: placementTarget.accuracy,
          },
        });
        await loadData();
        setPlacementOpen(false);
        setPlacementTarget(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save location.';
        console.warn('poop-map.location.update.failed', err);
        setError(message);
        setPlacementOpen(false);
        setPlacementTarget(null);
      }
    },
    [loadData, placementTarget, session?.token],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter points by time
  const filteredPoints = useMemo(() => {
    const filterDays = TIME_FILTER_OPTIONS.find((opt) => opt.key === timeFilter)?.days;
    if (!filterDays) return points;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filterDays);
    return points.filter((point) => new Date(point.capturedAt) >= cutoff);
  }, [points, timeFilter]);

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
    if (filteredPoints.length === 0) return null;
    const coords = filteredPoints.map((point) => ({ latitude: point.lat, longitude: point.lng }));
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
  }, [parcelCoordinates, homeLocation, filteredPoints]);

  const ownerColor = Colors.brand.mint;
  const proColor = Colors.brand.coral;
  const heatBase = '243, 100, 91';

  const pointsWithMeta = useMemo(
    () =>
      filteredPoints.map((point) => {
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
    [filteredPoints],
  );

  const selectedPoint = useMemo(
    () => pointsWithMeta.find((point) => point.id === selectedPointId) ?? null,
    [pointsWithMeta, selectedPointId],
  );

  const selectedImageUri = useMemo(() => {
    if (!selectedPoint?.imageUrl || typeof selectedPoint.imageUrl !== 'string') return null;
    return selectedPoint.imageUrl.startsWith('http')
      ? selectedPoint.imageUrl
      : `${resolvedBaseUrl}${selectedPoint.imageUrl.startsWith('/') ? '' : '/'}${selectedPoint.imageUrl}`;
  }, [selectedPoint, resolvedBaseUrl]);

  // Stats
  const ownerCount = useMemo(
    () => filteredPoints.filter((p) => p.source === 'OWNER').length,
    [filteredPoints],
  );
  const proCount = useMemo(
    () => filteredPoints.filter((p) => p.source === 'PRO').length,
    [filteredPoints],
  );

  useEffect(() => {
    if (viewMode === 'heat') {
      setSelectedPointId(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (selectedPointId && !filteredPoints.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [filteredPoints, selectedPointId]);

  const heatBuckets = useMemo(() => {
    if (!filteredPoints.length) return [];
    const gridMeters = 6;
    const buckets = new Map<string, { lat: number; lng: number; count: number; weight: number }>();
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
  }, [pointsWithMeta, filteredPoints.length]);

  const heatMax = useMemo(
    () => heatBuckets.reduce((max, item) => Math.max(max, item.weight), 0.0001),
    [heatBuckets],
  );

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (parcelCoordinates.length > 0) {
      mapRef.current.fitToCoordinates(parcelCoordinates, {
        edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
        animated: true,
      });
    }
  }, [mapReady, parcelCoordinates]);

  const parcelStroke = hexToRgba(palette.accent, 0.65);
  const parcelFill = hexToRgba(palette.accent, 0.14);

  const hasParcel = parcelCoordinates.length > 0;
  const needsAddress = !loading && !error && !homeLocation;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: Colors.brand.coral }]}>
          <View style={styles.heroIcon}>
            <FontAwesome name="map-marker" size={28} color="#fff" />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Yard Map</Text>
            <Text style={styles.heroSubtitle}>
              Track yard patterns from owner captures and scooper visits
            </Text>
          </View>
        </View>

        {/* Stats Summary */}
        {!loading && !error && filteredPoints.length > 0 && (
          <View style={[styles.statsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
                  <FontAwesome name="camera" size={14} color={Colors.brand.mint} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: palette.text }]}>{ownerCount}</Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Owner</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.coral}15` }]}>
                  <FontAwesome name="paw" size={14} color={Colors.brand.coral} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: palette.text }]}>{proCount}</Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Pro</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: `${palette.tint}15` }]}>
                  <FontAwesome name="map" size={14} color={palette.tint} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: palette.text }]}>{filteredPoints.length}</Text>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>Total</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Time Filter */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="calendar" size={16} color={palette.tint} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Time Period</Text>
          </View>
          <View style={styles.chipRow}>
            {TIME_FILTER_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.key}
                label={option.label}
                selected={timeFilter === option.key}
                onPress={() => setTimeFilter(option.key)}
              />
            ))}
          </View>
        </View>

        {/* Loading / Error States */}
        {loading && (
          <View style={[styles.statusCard, { backgroundColor: `${palette.tint}10`, borderColor: `${palette.tint}30` }]}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.statusText, { color: palette.muted }]}>Loading map data...</Text>
          </View>
        )}

        {error && (
          <View style={[styles.statusCard, { backgroundColor: `${palette.danger}10`, borderColor: `${palette.danger}30` }]}>
            <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
            <Text style={[styles.statusText, { color: palette.danger }]}>{error}</Text>
          </View>
        )}

        {needsAddress && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="home" size={24} color={Colors.brand.gold} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>Add your address</Text>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                We need your home location to anchor the map to your yard
              </Text>
              <Button
                title="Add address"
                variant="secondary"
                onPress={() => router.push('/(app)/(customer)/address')}
              />
            </View>
          </View>
        )}

        {/* Map Card */}
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
              showsCompass={true}
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
              {viewMode === 'pins' ? (
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
              ) : (
                heatBuckets.map((bucket, index) => {
                  const intensity = clampNumber(bucket.weight / heatMax, 0, 1);
                  const alpha = 0.2 + intensity * 0.5;
                  const radius = 2 + Math.sqrt(intensity) * 6;
                  return (
                    <Circle
                      key={`${bucket.lat}-${bucket.lng}-${index}`}
                      center={{ latitude: bucket.lat, longitude: bucket.lng }}
                      radius={radius}
                      strokeColor={`rgba(${heatBase}, ${Math.min(alpha + 0.2, 0.9)})`}
                      fillColor={`rgba(${heatBase}, ${alpha})`}
                      strokeWidth={1}
                    />
                  );
                })
              )}
            </MapView>
          ) : (
            <View style={styles.mapEmpty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${palette.muted}15` }]}>
                <FontAwesome name="map-o" size={24} color={palette.muted} />
              </View>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                No map points yet. Capture a stool or complete a scoop to populate.
              </Text>
            </View>
          )}

          <MapLegend viewMode={viewMode} onChangeMode={setViewMode} />
        </View>

        {/* Selected Point Detail */}
        {selectedPoint && viewMode === 'pins' && (
          <PointDetailCard
            sourceType={selectedPoint.source}
            capturedAt={selectedPoint.capturedAt}
            imageUrl={selectedImageUri}
            onClose={() => setSelectedPointId(null)}
            onAdjustLocation={selectedPoint.source === 'OWNER' ? () => openPlacement(selectedPoint) : undefined}
          />
        )}

        {/* Insights Card */}
        {!loading && !error && filteredPoints.length >= 3 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconContainer, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="lightbulb-o" size={16} color={Colors.brand.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Insights</Text>
            </View>
            <View style={styles.insightsList}>
              <View style={styles.insightItem}>
                <FontAwesome name="check-circle" size={14} color={Colors.brand.mint} />
                <Text style={[styles.insightText, { color: palette.muted }]}>
                  {filteredPoints.length} deposits tracked in selected period
                </Text>
              </View>
              {heatBuckets.length > 0 && (
                <View style={styles.insightItem}>
                  <FontAwesome name="fire" size={14} color={Colors.brand.coral} />
                  <Text style={[styles.insightText, { color: palette.muted }]}>
                    Switch to heat view to see hotspot clusters
                  </Text>
                </View>
              )}
              {ownerCount > 0 && proCount > 0 && (
                <View style={styles.insightItem}>
                  <FontAwesome name="users" size={14} color={palette.tint} />
                  <Text style={[styles.insightText, { color: palette.muted }]}>
                    Comparing owner vs pro capture locations
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Refresh Button */}
        <Pressable onPress={loadData} style={styles.refreshButton}>
          <FontAwesome name="refresh" size={12} color={palette.muted} />
          <Text style={[styles.refreshText, { color: palette.muted }]}>Refresh map</Text>
        </Pressable>
      </ScrollView>

      {placementTarget && session?.token && (
        <PoopMapPlacementModal
          visible={placementOpen}
          token={session.token}
          mapEndpoint="/api/mobile/customer/poop-map"
          initialLocation={{
            lat: placementTarget.lat,
            lng: placementTarget.lng,
            accuracy: placementTarget.accuracy ?? null,
          }}
          onClose={() => setPlacementOpen(false)}
          onSave={handlePlacementSave}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  statsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 13,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mapCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  map: {
    height: 350,
    width: '100%',
  },
  mapEmpty: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  insightsList: {
    gap: 10,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightText: {
    fontSize: 13,
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  refreshText: {
    fontSize: 12,
  },
});
