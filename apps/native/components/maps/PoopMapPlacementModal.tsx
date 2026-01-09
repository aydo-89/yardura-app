import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiRequest } from '@/lib/api/client';
import { DARK_MAP_STYLE } from '@/lib/maps/style';
import { LOW_CONFIDENCE_THRESHOLD_METERS, getAccuracyMeters } from '@/lib/maps/poopMap';

type HomeLocation = { lat: number; lng: number } | null;
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

type PlacementTarget = {
  lat: number;
  lng: number;
  accuracy?: number | null;
};

type PoopMapPlacementModalProps = {
  visible: boolean;
  token: string;
  mapEndpoint: string;
  initialLocation: PlacementTarget;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSave: (nextLocation: PlacementTarget) => Promise<void>;
};

const isPointInRing = (point: LatLng, ring: LatLng[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].longitude;
    const yi = ring[i].latitude;
    const xj = ring[j].longitude;
    const yj = ring[j].latitude;
    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude <
        ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const isPointInPolygon = (point: LatLng, polygon: ParcelPolygon) => {
  if (!isPointInRing(point, polygon.outline)) return false;
  if (polygon.holes.length === 0) return true;
  return !polygon.holes.some((hole) => isPointInRing(point, hole));
};

export default function PoopMapPlacementModal({
  visible,
  token,
  mapEndpoint,
  initialLocation,
  title = 'Adjust placement',
  subtitle = 'Drag the pin to the correct spot inside the yard boundary.',
  onClose,
  onSave,
}: PoopMapPlacementModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parcel, setParcel] = useState<ParcelBoundary | null>(null);
  const [parcelAvailability, setParcelAvailability] =
    useState<ParcelAvailability>('unknown');
  const [homeLocation, setHomeLocation] = useState<HomeLocation>(null);
  const [marker, setMarker] = useState<LatLng>({
    latitude: initialLocation.lat,
    longitude: initialLocation.lng,
  });

  useEffect(() => {
    if (!visible) return;
    setMarker({
      latitude: initialLocation.lat,
      longitude: initialLocation.lng,
    });
  }, [visible, initialLocation.lat, initialLocation.lng]);

  const loadParcel = useCallback(async () => {
    if (!token || !visible) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        parcel?: ParcelBoundary | null;
        parcelAvailability?: ParcelAvailability;
        homeLocation?: HomeLocation;
      }>(mapEndpoint, { token, timeoutMs: 10000 });
      const nextParcel = data.parcel ?? null;
      const nextAvailability =
        data.parcelAvailability ?? (nextParcel ? 'available' : 'unknown');
      setParcel(nextParcel);
      setParcelAvailability(nextAvailability);
      setHomeLocation(data.homeLocation ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load parcel boundary.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [mapEndpoint, token, visible]);

  useEffect(() => {
    loadParcel();
  }, [loadParcel]);

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
    return {
      latitude: marker.latitude,
      longitude: marker.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [parcelCoordinates, homeLocation, marker]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (parcelCoordinates.length > 0) {
      mapRef.current.fitToCoordinates(parcelCoordinates, {
        edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
        animated: true,
      });
    }
  }, [mapReady, parcelCoordinates]);

  const isOutsideParcel = useMemo(() => {
    if (!parcelPolygons.length) return false;
    return !parcelPolygons.some((polygon) => isPointInPolygon(marker, polygon));
  }, [marker, parcelPolygons]);

  const accuracyMeters = getAccuracyMeters(initialLocation.accuracy ?? null);
  const isLowAccuracy = accuracyMeters >= LOW_CONFIDENCE_THRESHOLD_METERS;

  const handleReset = () => {
    setMarker({ latitude: initialLocation.lat, longitude: initialLocation.lng });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        lat: marker.latitude,
        lng: marker.longitude,
        accuracy: initialLocation.accuracy ?? null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const parcelStroke = `rgba(64, 219, 162, ${colorScheme === 'dark' ? 0.7 : 0.6})`;
  const parcelFill = `rgba(64, 219, 162, ${colorScheme === 'dark' ? 0.18 : 0.12})`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: palette.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={[styles.headerAction, { color: palette.tint }]}>Close</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{title}</Text>
          <Pressable onPress={handleReset}>
            <Text style={[styles.headerAction, { color: palette.tint }]}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Instruction card */}
          <View style={[styles.instructionCard, { backgroundColor: `${palette.tint}10`, borderColor: `${palette.tint}25` }]}>
            <View style={styles.instructionIcon}>
              <FontAwesome name="hand-pointer-o" size={20} color={palette.tint} />
            </View>
            <View style={styles.instructionContent}>
              <Text style={[styles.instructionTitle, { color: palette.text }]}>Drag or tap to move pin</Text>
              <Text style={[styles.instructionText, { color: palette.muted }]}>{subtitle}</Text>
            </View>
          </View>

          {/* Status badges */}
          <View style={styles.badgeRow}>
            {isLowAccuracy ? (
              <View style={[styles.statusBadge, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="exclamation-triangle" size={12} color={Colors.brand.gold} />
                <Text style={[styles.badgeText, { color: Colors.brand.gold }]}>
                  Low GPS ({Math.round(accuracyMeters)}m)
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: `${palette.muted}15` }]}>
                <FontAwesome name="location-arrow" size={12} color={palette.muted} />
                <Text style={[styles.badgeText, { color: palette.muted }]}>
                  ~{Math.round(accuracyMeters)}m accuracy
                </Text>
              </View>
            )}
            {isOutsideParcel ? (
              <View style={[styles.statusBadge, { backgroundColor: `${palette.danger}15` }]}>
                <FontAwesome name="times-circle" size={12} color={palette.danger} />
                <Text style={[styles.badgeText, { color: palette.danger }]}>Outside yard</Text>
              </View>
            ) : parcelPolygons.length > 0 ? (
              <View style={[styles.statusBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
                <FontAwesome name="check-circle" size={12} color={Colors.brand.mint} />
                <Text style={[styles.badgeText, { color: Colors.brand.mint }]}>Inside yard</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.mapCard, { borderColor: palette.border }]}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  Loading yard boundary...
                </Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={mapRegion}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                mapType={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'mutedStandard' : 'standard') : 'standard'}
                customMapStyle={colorScheme === 'dark' ? DARK_MAP_STYLE : []}
                onMapReady={() => setMapReady(true)}
                onPress={(event) => setMarker(event.nativeEvent.coordinate)}
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
                <Marker
                  coordinate={marker}
                  draggable
                  onDragEnd={(event) => setMarker(event.nativeEvent.coordinate)}
                />
              </MapView>
            )}
          </View>
          {error ? (
            <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
          ) : null}
          {parcelPolygons.length === 0 && parcelAvailability === 'missing' ? (
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Parcel boundary isn’t available for this address yet. You can still adjust the pin.
            </Text>
          ) : parcelPolygons.length === 0 && parcelAvailability === 'unknown' ? (
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Parcel boundary couldn’t be loaded right now. You can still adjust the pin.
            </Text>
          ) : null}
        </View>

        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <Button
            title={saving ? 'Saving...' : 'Save placement'}
            onPress={handleSave}
            disabled={saving}
          />
          <Button
            title="Skip for now"
            onPress={onClose}
            variant="secondary"
            disabled={saving}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerAction: {
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    gap: 12,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  instructionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  instructionContent: {
    flex: 1,
    gap: 2,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mapCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    height: 320,
  },
  map: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 10,
  },
});
