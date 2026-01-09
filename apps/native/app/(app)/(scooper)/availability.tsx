import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Device from 'expo-device';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import TileScheduleSheet, { type TileSchedule, type AvailabilityWindow } from '@/components/scooper/TileScheduleSheet';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { DARK_MAP_STYLE } from '@/lib/maps/style';

type ServiceTileStatus = 'LIVE' | 'WAITLIST' | 'DRAFT' | 'SUSPENDED';

type TileGeometry =
  | {
      type: 'Polygon';
      coordinates: number[][][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: number[][][][];
    };

type TileFeature = {
  type: 'Feature';
  geometry: TileGeometry | null;
};

type TileGeometryCollection = {
  type: 'FeatureCollection';
  features: TileFeature[];
};

type TileApiEntry = {
  tile: {
    slug: string;
    name: string;
    status: ServiceTileStatus;
    geometry: TileGeometryCollection | null;
    cities: string[];
    zips: string[];
  };
};

type AvailabilityEntry = {
  id: string;
  weekday: number;
  window: AvailabilityWindow;
  maxStops: number | null;
  tile: {
    id: string;
    slug: string;
    name: string;
    status: ServiceTileStatus;
  };
};

type TileDisplay = {
  slug: string;
  name: string;
  status: ServiceTileStatus;
  cities: string[];
  polygons: LatLng[][];
  center: LatLng | null;
};

type TileSelection = {
  slug: string;
  selected: boolean;
  weekdays: number[];
  window: AvailabilityWindow;
  maxStops: number;
};

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

const STATUS_LABELS: Record<ServiceTileStatus, string> = {
  LIVE: 'Live',
  WAITLIST: 'Waitlist',
  DRAFT: 'Draft',
  SUSPENDED: 'Paused',
};

const DEFAULT_WEEKDAYS = ALL_WEEKDAYS;
const FALLBACK_REGION = {
  latitude: 44.9778,
  longitude: -93.2650,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};

function extractPolygons(geometry: TileGeometryCollection | null): LatLng[][] {
  if (!geometry) return [];
  const polygons: LatLng[][] = [];

  for (const feature of geometry.features) {
    const shape = feature.geometry;
    if (!shape) continue;
    if (shape.type === 'Polygon') {
      const ring = shape.coordinates[0] ?? [];
      polygons.push(ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
    } else if (shape.type === 'MultiPolygon') {
      shape.coordinates.forEach((polygon) => {
        const ring = polygon[0] ?? [];
        polygons.push(ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
      });
    }
  }

  return polygons;
}

function computeCenter(polygons: LatLng[][]): LatLng | null {
  const coords = polygons.flat();
  if (coords.length === 0) return null;
  const totals = coords.reduce(
    (acc, current) => ({
      latitude: acc.latitude + current.latitude,
      longitude: acc.longitude + current.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: totals.latitude / coords.length,
    longitude: totals.longitude / coords.length,
  };
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function buildDefaultSelection(tile: TileApiEntry): TileSelection {
  return {
    slug: tile.tile.slug,
    selected: false,
    weekdays: DEFAULT_WEEKDAYS,
    window: 'FULL',
    maxStops: tile.tile.status === 'LIVE' ? 20 : 10,
  };
}

function formatWeekdaySummary(weekdays: number[]) {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === ALL_WEEKDAYS.length) return 'All days';
  if (sorted.length === 0) return 'No days selected';
  return sorted.map((day) => WEEKDAY_LABELS[day] ?? String(day)).join(', ');
}

function formatWindowSummary(window: AvailabilityWindow) {
  switch (window) {
    case 'AM':
      return 'Morning';
    case 'PM':
      return 'Afternoon';
    case 'FULL':
    default:
      return 'Full day';
  }
}

function isFullWeekSelection(weekdays: number[]) {
  if (weekdays.length !== ALL_WEEKDAYS.length) return false;
  return ALL_WEEKDAYS.every((day) => weekdays.includes(day));
}

export default function ScooperAvailability() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const mapCardOffset = useRef(0);
  const mapRef = useRef<MapView | null>(null);
  const [tiles, setTiles] = useState<TileDisplay[]>([]);
  const [selections, setSelections] = useState<Record<string, TileSelection>>({});
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null);
  const [scheduleSheetSlug, setScheduleSheetSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [locationChecked, setLocationChecked] = useState(false);
  const [isMapExpanded, setMapExpanded] = useState(false);
  const [fullMapReady, setFullMapReady] = useState(false);
  const fullMapRef = useRef<MapView | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const availabilityResponse = await apiRequest<{
        orgId: string;
        availability: AvailabilityEntry[];
      }>('/api/mobile/scooper/availability', { token: session.token });

      const nextSelections: Record<string, TileSelection> = {};
      availabilityResponse.availability.forEach((entry) => {
        const slug = entry.tile.slug;
        const current = nextSelections[slug] ?? {
          slug,
          selected: true,
          weekdays: [],
          window: entry.window ?? 'FULL',
          maxStops: entry.maxStops ?? 10,
        };
        current.selected = true;
        current.weekdays = Array.from(new Set([...current.weekdays, entry.weekday]));
        current.window = entry.window ?? current.window;
        current.maxStops = entry.maxStops ?? current.maxStops;
        nextSelections[slug] = current;
      });

      Object.values(nextSelections).forEach((selection) => {
        selection.weekdays.sort((a, b) => a - b);
      });

      setSelections(nextSelections);
      const tileResponse = await apiRequest<{ data: TileApiEntry[] }>(
        `/api/marketplace/tiles?org=${availabilityResponse.orgId}`,
      );
      const nextTiles = tileResponse.data.map((entry) => {
        const polygons = extractPolygons(entry.tile.geometry);
        return {
          slug: entry.tile.slug,
          name: entry.tile.name,
          status: entry.tile.status,
          cities: entry.tile.cities,
          polygons,
          center: computeCenter(polygons),
        };
      });
      setTiles(nextTiles);
      setSelections((prev) => {
        const merged: Record<string, TileSelection> = { ...prev };
        nextTiles.forEach((tile) => {
          if (!merged[tile.slug]) {
            const apiEntry = tileResponse.data.find(
              (entry) => entry.tile.slug === tile.slug,
            );
            merged[tile.slug] = apiEntry ? buildDefaultSelection(apiEntry) : {
              slug: tile.slug,
              selected: false,
              weekdays: DEFAULT_WEEKDAYS,
              window: 'FULL',
              maxStops: 10,
            };
          }
        });
        return merged;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load service areas.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (locationChecked) return;
    let active = true;
    const hydrateLocation = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (active) setLocationChecked(true);
          return;
        }
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (active && lastKnown?.coords) {
          setLocation({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
          setLocationChecked(true);
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (active && current?.coords) {
          setLocation({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        }
      } catch {
        // Silent fallback for location hydration.
      } finally {
        if (active) setLocationChecked(true);
      }
    };
    hydrateLocation();
    return () => {
      active = false;
    };
  }, [locationChecked]);

  const handleUseLocation = async () => {
    setLocationError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Location permission denied. Enable it to see nearby tiles.');
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocation(coords);
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...coords,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          },
          350,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to access location.';
      setLocationError(
        Device.isDevice !== true
          ? 'Set a simulated location in the simulator to continue.'
          : message,
      );
    }
  };

  const tileLookup = useMemo(
    () =>
      tiles.reduce<Record<string, TileDisplay>>((acc, tile) => {
        acc[tile.slug] = tile;
        return acc;
      }, {}),
    [tiles],
  );

  const visibleCoordinates = useMemo(() => {
    const coords = tiles.flatMap((tile) => tile.polygons.flat());
    if (location) coords.push(location);
    return coords;
  }, [tiles, location]);

  const mapRegion = useMemo(() => {
    if (location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      };
    }
    const centers = tiles
      .map((tile) => tile.center)
      .filter((center): center is LatLng => Boolean(center));
    if (centers.length) {
      const totals = centers.reduce(
        (acc, current) => ({
          latitude: acc.latitude + current.latitude,
          longitude: acc.longitude + current.longitude,
        }),
        { latitude: 0, longitude: 0 },
      );
      return {
        latitude: totals.latitude / centers.length,
        longitude: totals.longitude / centers.length,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };
    }
    return FALLBACK_REGION;
  }, [location, tiles]);

  const handleMapReady = () => {
    setMapReady(true);
  };

  const handleFullMapReady = () => {
    setFullMapReady(true);
  };

  const handleMapLayout = (event: LayoutChangeEvent) => {
    setMapHeight(event.nativeEvent.layout.height);
  };

  const handleMapCardLayout = (event: LayoutChangeEvent) => {
    mapCardOffset.current = event.nativeEvent.layout.y;
  };

  const scrollToMap = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      y: Math.max(mapCardOffset.current - 12, 0),
      animated: true,
    });
  }, []);

  const centerOnSelection = useCallback(
    (slug: string) => {
      const tile = tileLookup[slug];
      if (!tile?.center || !mapRef.current) return;
      mapRef.current.animateToRegion(
        {
          latitude: tile.center.latitude,
          longitude: tile.center.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        350,
      );
    },
    [tileLookup],
  );

  const focusTile = useCallback(
    (slug: string, options?: { scroll?: boolean }) => {
      setFocusedSlug(slug);
      centerOnSelection(slug);
      if (options?.scroll) {
        scrollToMap();
      }
    },
    [centerOnSelection, scrollToMap],
  );

  const toggleTile = (slug: string, value: boolean) => {
    const tile = tileLookup[slug];
    const defaultMaxStops = tile?.status === 'LIVE' ? 20 : 10;
    setSelections((prev) => {
      const current = prev[slug] ?? {
        slug,
        selected: value,
        weekdays: DEFAULT_WEEKDAYS,
        window: 'FULL' as AvailabilityWindow,
        maxStops: defaultMaxStops,
      };
      return {
        ...prev,
        [slug]: {
          ...current,
          selected: value,
        },
      };
    });
    if (value) {
      focusTile(slug);
    }
  };

  const openScheduleSheet = (slug: string) => {
    setScheduleSheetSlug(slug);
  };

  const handleScheduleSave = (slug: string, schedule: TileSchedule) => {
    setSelections((prev) => {
      const current = prev[slug];
      if (!current) return prev;
      return {
        ...prev,
        [slug]: {
          ...current,
          weekdays: schedule.weekdays,
          window: schedule.window,
          maxStops: schedule.maxStops,
        },
      };
    });
    setScheduleSheetSlug(null);
  };

  const handleRemoveTile = (slug: string) => {
    toggleTile(slug, false);
    setScheduleSheetSlug(null);
  };

  const handleSave = async () => {
    if (!session?.token) return;
    setError(null);
    setSaveMessage(null);
    const selectedTiles = Object.values(selections).filter((selection) => selection.selected);
    if (selectedTiles.length === 0) {
      setError('Select at least one service area.');
      return;
    }
    const invalid = selectedTiles.find((selection) => selection.weekdays.length === 0);
    if (invalid) {
      setError('Choose at least one day for each selected area.');
      return;
    }
    const blocks = selectedTiles.flatMap((selection) =>
      selection.weekdays.map((weekday) => ({
        tileSlug: selection.slug,
        weekday,
        window: selection.window,
        maxStops: selection.maxStops,
      })),
    );
    setSaving(true);
    try {
      await apiRequest('/api/mobile/scooper/availability', {
        method: 'PUT',
        token: session.token,
        body: { blocks },
      });
      setSaveMessage('Availability updated.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to save availability.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const tileRows = useMemo(() => {
    const rows = tiles.map((tile) => {
      const selection =
        selections[tile.slug] ?? {
          slug: tile.slug,
          selected: false,
          weekdays: DEFAULT_WEEKDAYS,
          window: 'FULL',
          maxStops: tile.status === 'LIVE' ? 20 : 10,
        };
      const distance =
        location && tile.center ? haversineMeters(location, tile.center) : null;
      return {
        tile,
        selection,
        distance,
      };
    });
    rows.sort((a, b) => {
      if (a.selection?.selected && !b.selection?.selected) return -1;
      if (!a.selection?.selected && b.selection?.selected) return 1;
      if (a.distance === null || b.distance === null) {
        return a.tile.name.localeCompare(b.tile.name);
      }
      return a.distance - b.distance;
    });
    return rows;
  }, [tiles, selections, location]);

  const mapPadding = useMemo(
    () => ({
      top: 40,
      bottom: Math.max(40, mapHeight * 0.2),
      left: 40,
      right: 40,
    }),
    [mapHeight],
  );

  const fullMapPadding = useMemo(
    () => ({
      top: 80,
      bottom: 80,
      left: 40,
      right: 40,
    }),
    [],
  );

  useEffect(() => {
    if (!mapReady || visibleCoordinates.length === 0 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(visibleCoordinates, {
      edgePadding: mapPadding,
      animated: false,
    });
  }, [mapReady, visibleCoordinates, mapPadding]);

  useEffect(() => {
    if (
      !isMapExpanded ||
      !fullMapReady ||
      visibleCoordinates.length === 0 ||
      !fullMapRef.current
    ) {
      return;
    }
    fullMapRef.current.fitToCoordinates(visibleCoordinates, {
      edgePadding: fullMapPadding,
      animated: false,
    });
  }, [isMapExpanded, fullMapReady, visibleCoordinates, fullMapPadding]);

  const selectedFillColor =
    colorScheme === 'light' ? 'rgba(243, 100, 91, 0.15)' : 'rgba(25, 180, 163, 0.2)';
  const defaultFillColor =
    colorScheme === 'light' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.08)';
  const focusedFillColor =
    colorScheme === 'light' ? 'rgba(25, 180, 163, 0.22)' : 'rgba(243, 100, 91, 0.24)';

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.mapFallback, { backgroundColor: palette.background }]}>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Map preview is available on iOS and Android devices.
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'mutedStandard' : 'standard') : 'standard'}
        customMapStyle={colorScheme === 'dark' ? DARK_MAP_STYLE : []}
        initialRegion={mapRegion}
        onMapReady={handleMapReady}
        onLayout={handleMapLayout}
        showsUserLocation={Boolean(location)}
        showsMyLocationButton={Boolean(location)}
      >
        {tiles.map((tile) =>
          tile.polygons.map((polygon, index) => {
            const isFocused = focusedSlug === tile.slug;
            const isSelected = selections[tile.slug]?.selected;
            const strokeColor = isFocused
              ? palette.accent
              : isSelected
                ? palette.tint
                : palette.border;
            const fillColor = isFocused
              ? focusedFillColor
              : isSelected
                ? selectedFillColor
                : defaultFillColor;
            return (
              <Polygon
                key={`${tile.slug}-${index}`}
                coordinates={polygon}
                strokeColor={strokeColor}
                fillColor={fillColor}
                strokeWidth={2}
                tappable
                onPress={() => focusTile(tile.slug)}
              />
            );
          }),
        )}
        {location ? (
          <Marker coordinate={location} title="You" pinColor={palette.accent} />
        ) : null}
      </MapView>
    );
  };

  return (
    <Screen>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Service areas</Text>
          <Text style={[styles.title, { color: palette.text }]}>Coverage & availability</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Turn on tiles to receive all offers. Set a schedule only if you need to restrict days or windows.
          </Text>
        </View>

        <View
          style={[styles.card, styles.cardShadow, { backgroundColor: palette.card, borderColor: palette.border }]}
          onLayout={handleMapCardLayout}
        >
          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Coverage map</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Tiles are shown relative to your current location.
              </Text>
            </View>
            <View style={styles.mapHeaderActions}>
              <Button
                title="Use my location"
                onPress={handleUseLocation}
                variant="ghost"
                style={styles.mapHeaderCta}
                labelStyle={styles.mapHeaderCtaLabel}
              />
              <Button
                title="Full screen"
                onPress={() => setMapExpanded(true)}
                variant="secondary"
                style={styles.mapHeaderCta}
                labelStyle={styles.mapHeaderCtaLabel}
              />
            </View>
          </View>
          <View style={styles.mapContainer} onLayout={handleMapLayout}>
            {renderMap()}
            {tiles.length === 0 ? (
              <View style={styles.mapOverlay}>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Tiles will appear once service areas are published.
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => setMapExpanded(true)}
              style={[
                styles.expandHint,
                {
                  borderColor:
                    colorScheme === 'dark'
                      ? 'rgba(248, 250, 252, 0.45)'
                      : palette.border,
                  backgroundColor:
                    colorScheme === 'dark'
                      ? 'rgba(15, 23, 42, 0.72)'
                      : 'rgba(255, 255, 255, 0.92)',
                },
              ]}
            >
              <Text
                style={[
                  styles.expandHintText,
                  { color: colorScheme === 'dark' ? palette.text : '#0B1220' },
                ]}
              >
                Expand map
              </Text>
            </Pressable>
          </View>
          {locationError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{locationError}</Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading service areas...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
        ) : null}

        {tileRows.length === 0 && !loading ? (
          <View style={[styles.card, styles.cardShadow, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>No tiles yet</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              New service areas will appear once operations publishes tiles for your region.
            </Text>
          </View>
        ) : (
          tileRows.map(({ tile, selection, distance }) => {
            const isSelected = selection?.selected ?? false;
            const isFocused = focusedSlug === tile.slug;
            const distanceMiles =
              distance !== null ? `${(distance / 1609.34).toFixed(1)} mi away` : null;
            const cityLabel =
              tile.cities.length > 0 ? tile.cities.slice(0, 2).join(', ') : 'Service area';
            const defaultMaxStops = tile.status === 'LIVE' ? 20 : 10;
            const weekdayLabel = selection ? formatWeekdaySummary(selection.weekdays) : null;
            const windowLabel = selection ? formatWindowSummary(selection.window) : null;
            const isFullWeek = selection ? isFullWeekSelection(selection.weekdays) : false;
            const isFullSchedule =
              isSelected &&
              isFullWeek &&
              selection?.window === 'FULL' &&
              (selection?.maxStops ?? defaultMaxStops) === defaultMaxStops;
            const hasCustomSchedule = isSelected && !isFullSchedule;
            const scheduleSummary = !isSelected
              ? 'Off • Turn on to receive offers from this tile.'
              : isFullSchedule
                ? 'All offers enabled'
                : `${weekdayLabel ?? 'Selected days'} • ${windowLabel ?? 'Window set'}${selection?.maxStops ? ` • Max ${selection.maxStops} stops/day` : ''}`;
            return (
              <View
                key={tile.slug}
                style={[
                  styles.card,
                  styles.cardShadow,
                  isFocused ? styles.cardFocused : null,
                  {
                    backgroundColor: palette.card,
                    borderColor: isFocused ? palette.accent : palette.border,
                  },
                ]}
              >
                <View style={styles.tileHeader}>
                  <View style={styles.tileHeaderRow}>
                    <Pressable
                      onPress={() => focusTile(tile.slug, { scroll: true })}
                      style={styles.tileHeaderCopy}
                    >
                      <View style={styles.tileTitleRow}>
                        <Text style={[styles.cardTitle, { color: palette.text }]}>
                          {tile.name}
                        </Text>
                        <View style={[styles.statusPill, { borderColor: palette.border }]}>
                          <Text style={[styles.statusText, { color: palette.muted }]}>
                            {STATUS_LABELS[tile.status]}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    <Button
                      title={isSelected ? 'On' : 'Off'}
                      onPress={() => toggleTile(tile.slug, !isSelected)}
                      variant={isSelected ? 'primary' : 'secondary'}
                      style={styles.toggleButton}
                    />
                  </View>
                  <View style={styles.tileMetaRow}>
                    <Text style={[styles.cardBody, { color: palette.muted }]}>{cityLabel}</Text>
                    {distanceMiles ? (
                      <Text style={[styles.cardMeta, { color: palette.muted }]}>
                        {distanceMiles}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.tileActionsRow}>
                    <Pressable
                      onPress={() => focusTile(tile.slug, { scroll: true })}
                      style={[styles.viewOnMapButton, { borderColor: palette.border }]}
                    >
                      <Text style={[styles.viewOnMapText, { color: palette.tint }]}>
                        View on map
                      </Text>
                    </Pressable>
                    {isSelected ? (
                      <Pressable
                        onPress={() => openScheduleSheet(tile.slug)}
                        style={[styles.scheduleButton, { borderColor: palette.border }]}
                      >
                        <Text style={[styles.scheduleButtonText, { color: palette.text }]}>
                          {hasCustomSchedule ? 'Edit schedule' : 'Set schedule'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[styles.tileSummaryText, { color: palette.muted }]}>
                    {scheduleSummary}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {saveMessage ? (
          <Text style={[styles.cardBody, { color: palette.tint }]}>{saveMessage}</Text>
        ) : null}
        <Button
          title={saving ? 'Saving availability...' : 'Save availability'}
          onPress={handleSave}
          disabled={saving}
        />
      </ScrollView>

      <Modal
        visible={isMapExpanded}
        animationType="slide"
        onRequestClose={() => setMapExpanded(false)}
      >
        <SafeAreaView
          style={[
            styles.fullMapContainer,
            { backgroundColor: palette.background },
          ]}
        >
          <View
            style={[
              styles.fullMapHeader,
              { paddingTop: Math.max(insets.top, 12) },
            ]}
          >
            <View>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Coverage map</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Pan and zoom to explore your service tiles.
              </Text>
            </View>
            <Button title="Done" variant="ghost" onPress={() => setMapExpanded(false)} />
          </View>
          <View style={styles.fullMapBody}>
            <MapView
              ref={fullMapRef}
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              mapType={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'mutedStandard' : 'standard') : 'standard'}
              customMapStyle={colorScheme === 'dark' ? DARK_MAP_STYLE : []}
              initialRegion={mapRegion}
              onMapReady={handleFullMapReady}
              showsUserLocation={Boolean(location)}
              showsMyLocationButton={Boolean(location)}
            >
              {tiles.map((tile) =>
                tile.polygons.map((polygon, index) => {
                  const isFocused = focusedSlug === tile.slug;
                  const isSelected = selections[tile.slug]?.selected;
                  const strokeColor = isFocused
                    ? palette.accent
                    : isSelected
                      ? palette.tint
                      : palette.border;
                  const fillColor = isFocused
                    ? focusedFillColor
                    : isSelected
                      ? selectedFillColor
                      : defaultFillColor;
                  return (
                    <Polygon
                      key={`full-${tile.slug}-${index}`}
                      coordinates={polygon}
                      strokeColor={strokeColor}
                      fillColor={fillColor}
                      strokeWidth={2}
                      tappable
                      onPress={() => focusTile(tile.slug)}
                    />
                  );
                }),
              )}
              {location ? (
                <Marker coordinate={location} title="You" pinColor={palette.accent} />
              ) : null}
            </MapView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Schedule Sheet */}
      {scheduleSheetSlug ? (
        <TileScheduleSheet
          visible={Boolean(scheduleSheetSlug)}
          tileName={tileLookup[scheduleSheetSlug]?.name ?? 'Schedule'}
          tileStatus={tileLookup[scheduleSheetSlug]?.status ?? 'LIVE'}
          schedule={{
            weekdays: selections[scheduleSheetSlug]?.weekdays ?? ALL_WEEKDAYS,
            window: selections[scheduleSheetSlug]?.window ?? 'FULL',
            maxStops: selections[scheduleSheetSlug]?.maxStops ?? 20,
          }}
          palette={palette}
          colorScheme={colorScheme}
          onClose={() => setScheduleSheetSlug(null)}
          onSave={(schedule) => handleScheduleSave(scheduleSheetSlug, schedule)}
          onRemove={() => handleRemoveTile(scheduleSheetSlug)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 6,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    fontSize: 12,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  mapHeaderCopy: {
    flex: 1,
    minWidth: 220,
  },
  mapHeaderActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  mapHeaderCta: {
    alignSelf: 'flex-start',
  },
  mapHeaderCtaLabel: {
    fontSize: 14,
  },
  mapContainer: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  expandHint: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#0B1220',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  expandHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fullMapContainer: {
    flex: 1,
  },
  fullMapHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  fullMapBody: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  tileHeader: {
    gap: 6,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  tileMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tileActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  tileHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  viewOnMapButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewOnMapText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scheduleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tileSummaryText: {
    fontSize: 12,
    marginTop: 2,
  },
  tileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardFocused: {
    borderWidth: 2,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleButton: {
    minWidth: 88,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
});
