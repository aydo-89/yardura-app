import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiRequest } from '@/lib/api/client';

type AvailabilityWindow = 'AM' | 'PM' | 'FULL';

type TileGeometry =
  | {
      type: 'Polygon';
      coordinates: number[][][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: number[][][][];
    };

type TileGeometryCollection = {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: TileGeometry | null }>;
};

type TileApiEntry = {
  tile: {
    slug: string;
    name: string;
    status: 'LIVE' | 'WAITLIST' | 'DRAFT' | 'SUSPENDED';
    geometry: TileGeometryCollection | null;
    cities: string[];
    zips: string[];
  };
};

type TileDisplay = {
  slug: string;
  name: string;
  status: TileApiEntry['tile']['status'];
  cities: string[];
  zips: string[];
  polygons: LatLng[][];
  center: LatLng | null;
};

type TileSelection = {
  slug: string;
  name: string;
  status: TileApiEntry['tile']['status'];
  selected: boolean;
  weekdays: number[];
  window: AvailabilityWindow;
  maxStops: string;
};

const STEPS = [
  { title: 'Contact basics', subtitle: 'Tell us how to reach you.' },
  { title: 'Home base + tiles', subtitle: 'Pick the areas you can cover.' },
  { title: 'Schedule details', subtitle: 'Set your availability by tile.' },
  { title: 'Review + submit', subtitle: 'Confirm details and send.' },
];

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const WINDOW_OPTIONS: Array<{ label: string; value: AvailabilityWindow }> = [
  { label: 'Full day', value: 'FULL' },
  { label: 'Morning', value: 'AM' },
  { label: 'Afternoon', value: 'PM' },
];

const EXPERIENCE_OPTIONS = [
  'Pet care',
  'Cleaning',
  'Landscaping',
  'Delivery/logistics',
  'Customer service',
  'Other',
];

const RADIUS_OPTIONS = [5, 10, 15, 25];

const FALLBACK_REGION = {
  latitude: 44.9778,
  longitude: -93.265,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

const ALL_WEEKDAYS = WEEKDAYS.map((day) => day.value);

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
  if (!coords.length) return null;
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

function buildDefaultSelection(tile: TileDisplay): TileSelection {
  return {
    slug: tile.slug,
    name: tile.name,
    status: tile.status,
    selected: false,
    weekdays: [...ALL_WEEKDAYS],
    window: 'FULL',
    maxStops: tile.status === 'LIVE' ? '20' : '10',
  };
}

export default function ScooperApplyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mapRef = useRef<MapView | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [tiles, setTiles] = useState<TileDisplay[]>([]);
  const [tileSelections, setTileSelections] = useState<Record<string, TileSelection>>({});
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [tilesLoading, setTilesLoading] = useState(false);
  const [tilesError, setTilesError] = useState<string | null>(null);
  const [tileSearch, setTileSearch] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleDetail, setVehicleDetail] = useState('');
  const [insuranceProofUrl, setInsuranceProofUrl] = useState('');

  const [homeAddress, setHomeAddress] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [homeZip, setHomeZip] = useState('');
  const [homeLocation, setHomeLocation] = useState<LatLng | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [preferredRadius, setPreferredRadius] = useState<number>(10);
  const [availabilityNotes, setAvailabilityNotes] = useState('');

  const [experienceTags, setExperienceTags] = useState<string[]>([]);
  const [hasReliableTransport, setHasReliableTransport] = useState(true);
  const [hasSmartphone, setHasSmartphone] = useState(true);
  const [canLift, setCanLift] = useState(true);
  const [backgroundConsent, setBackgroundConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);

  const [driversLicenseState, setDriversLicenseState] = useState('');
  const [driversLicenseLast4, setDriversLicenseLast4] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTiles = useCallback(async () => {
    setTilesLoading(true);
    setTilesError(null);
    try {
      const data = await apiRequest<{ data: TileApiEntry[] }>('/api/marketplace/tiles');
      const mapped = (data.data ?? []).map((entry) => {
        const polygons = extractPolygons(entry.tile.geometry ?? null);
        return {
          slug: entry.tile.slug,
          name: entry.tile.name,
          status: entry.tile.status,
          cities: entry.tile.cities,
          zips: entry.tile.zips,
          polygons,
          center: computeCenter(polygons),
        } satisfies TileDisplay;
      });
      setTiles(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load service tiles.';
      setTilesError(message);
    } finally {
      setTilesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTiles();
  }, [loadTiles]);

  useEffect(() => {
    if (!tiles.length) return;
    setTileSelections((prev) => {
      const next = { ...prev };
      tiles.forEach((tile) => {
        if (!next[tile.slug]) {
          next[tile.slug] = buildDefaultSelection(tile);
        }
      });
      return next;
    });
  }, [tiles]);

  const tileRows = useMemo(() => {
    const query = tileSearch.trim().toLowerCase();
    return tiles
      .filter((tile) => {
        if (!query) return true;
        return (
          tile.name.toLowerCase().includes(query) ||
          tile.cities.some((city) => city.toLowerCase().includes(query)) ||
          tile.zips.some((zip) => zip.includes(query))
        );
      })
      .map((tile) => {
        const selection = tileSelections[tile.slug] ?? buildDefaultSelection(tile);
        const distanceMiles =
          homeLocation && tile.center
            ? Math.round((haversineMeters(homeLocation, tile.center) / 1609.34) * 10) / 10
            : null;
        return {
          tile,
          selection,
          distanceMiles,
        };
      });
  }, [homeLocation, tileSearch, tileSelections, tiles]);

  const selectedTiles = useMemo(
    () =>
      Object.values(tileSelections).filter((selection) => selection.selected),
    [tileSelections],
  );

  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const handleToggleTile = (slug: string) => {
    setTileSelections((prev) => {
      const existing = prev[slug];
      if (existing) {
        return {
          ...prev,
          [slug]: {
            ...existing,
            selected: !existing.selected,
          },
        };
      }
      const tile = tiles.find((entry) => entry.slug === slug);
      if (!tile) return prev;
      return {
        ...prev,
        [slug]: { ...buildDefaultSelection(tile), selected: true },
      };
    });
  };

  const handleSelectRadius = (radius: number) => {
    setPreferredRadius(radius);
    if (!homeLocation) return;
    setTileSelections((prev) => {
      const next = { ...prev };
      tiles.forEach((tile) => {
        const selection = next[tile.slug] ?? buildDefaultSelection(tile);
        if (!tile.center) return;
        const miles = haversineMeters(homeLocation, tile.center) / 1609.34;
        if (miles <= radius) {
          next[tile.slug] = { ...selection, selected: true };
        }
      });
      return next;
    });
  };

  const handleToggleWeekday = (slug: string, weekday: number) => {
    setTileSelections((prev) => {
      const selection = prev[slug];
      if (!selection) return prev;
      const weekdays = selection.weekdays.includes(weekday)
        ? selection.weekdays.filter((day) => day !== weekday)
        : [...selection.weekdays, weekday];
      return {
        ...prev,
        [slug]: { ...selection, weekdays },
      };
    });
  };

  const handleWindowChange = (slug: string, window: AvailabilityWindow) => {
    setTileSelections((prev) => {
      const selection = prev[slug];
      if (!selection) return prev;
      return {
        ...prev,
        [slug]: { ...selection, window },
      };
    });
  };

  const handleMaxStopsChange = (slug: string, maxStops: string) => {
    setTileSelections((prev) => {
      const selection = prev[slug];
      if (!selection) return prev;
      return {
        ...prev,
        [slug]: { ...selection, maxStops },
      };
    });
  };

  const toggleExpandedTile = (slug: string) => {
    setExpandedTiles((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is required to use current position.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setHomeLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to read current location.';
      setLocationError(message);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleGeocodeHomeBase = async () => {
    const address = [homeAddress, homeCity, homeZip]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
    if (!address) {
      setLocationError('Enter your home base address first.');
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    try {
      const results = await Location.geocodeAsync(address);
      if (!results.length) {
        setLocationError('We could not find that address.');
        return;
      }
      setHomeLocation({ latitude: results[0].latitude, longitude: results[0].longitude });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to locate that address.';
      setLocationError(message);
    } finally {
      setLocationLoading(false);
    }
  };

  const mapRegion = useMemo(() => {
    if (homeLocation) {
      return {
        latitude: homeLocation.latitude,
        longitude: homeLocation.longitude,
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
      };
    }
    return FALLBACK_REGION;
  }, [homeLocation]);

  useEffect(() => {
    if (!homeLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: homeLocation.latitude,
        longitude: homeLocation.longitude,
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
      },
      600,
    );
  }, [homeLocation]);

  const resolveStatusTone = (status: TileApiEntry['tile']['status']) => {
    switch (status) {
      case 'LIVE':
        return Colors.brand.mint;
      case 'WAITLIST':
        return Colors.brand.gold;
      case 'SUSPENDED':
        return Colors.brand.coral;
      default:
        return Colors.brand.graphiteSoft;
    }
  };

  const toggleExperienceTag = (tag: string) => {
    setExperienceTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const validateStep = (index: number) => {
    if (index === 0) {
      if (!name.trim() || !email.trim()) {
        return 'Name and email are required.';
      }
    }
    if (index === 1) {
      if (selectedTiles.length === 0) {
        return 'Select at least one service tile.';
      }
    }
    if (index === 2) {
      if (!selectedTiles.length) return 'Select at least one tile.';
      const invalid = selectedTiles.some((tile) => tile.weekdays.length === 0);
      if (invalid) return 'Pick at least one day for each tile.';
    }
    if (index === 3) {
      if (!vehicleDetail.trim()) return 'Vehicle details are required.';
      if (!backgroundConsent || !termsConsent) {
        return 'Confirm the background check and terms consents to submit.';
      }
    }
    return null;
  };

  const handleNext = () => {
    const validation = validateStep(stepIndex);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    const validation = validateStep(3);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const licenseState = driversLicenseState.trim().toUpperCase();
      const licenseLast4 = driversLicenseLast4.trim();
      const mappedAvailability = selectedTiles.flatMap((entry) =>
        entry.weekdays.map((weekday) => ({
          tileSlug: entry.slug,
          weekday,
          window: entry.window,
          maxStops: entry.maxStops.trim() ? Number(entry.maxStops) : undefined,
        })),
      );

      await apiRequest('/api/scoopers/apply', {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          vehicleDetail: vehicleDetail.trim(),
          insuranceProofUrl: insuranceProofUrl.trim() || undefined,
          homeBaseAddress: homeAddress.trim() || undefined,
          homeBaseCity: homeCity.trim() || undefined,
          homeBaseZip: homeZip.trim() || undefined,
          location: homeLocation
            ? { lat: homeLocation.latitude, lng: homeLocation.longitude }
            : undefined,
          availability: mappedAvailability,
          applicationSource: 'mobile',
          preferredRadiusMiles: preferredRadius,
          availabilityNotes: availabilityNotes.trim() || undefined,
          experienceTags,
          hasReliableTransport,
          hasSmartphone,
          canLift,
          backgroundConsent,
          termsConsent,
          driversLicenseState: licenseState || undefined,
          driversLicenseLast4: licenseLast4.length === 4 ? licenseLast4 : undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: emergencyContactPhone.trim() || undefined,
          emergencyContactRelation: emergencyContactRelation.trim() || undefined,
        },
      });
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit application.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <FontAwesome name="check-circle" size={44} color={Colors.brand.mint} />
          <Text style={[styles.successTitle, { color: palette.text }]}>Application submitted</Text>
          <Text style={[styles.successBody, { color: palette.muted }]}>
            We received your details and will follow up via email with next steps.
          </Text>
          <Button title="Back to account" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const step = STEPS[stepIndex];

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.kicker, { color: palette.muted }]}>Scooper application</Text>
            <Text style={[styles.title, { color: palette.text }]}>{step.title}</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>{step.subtitle}</Text>
            <View style={[styles.progressTrack, { backgroundColor: palette.border }]}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPct}%`, backgroundColor: palette.tint },
                ]}
              />
            </View>
            <Text style={[styles.stepLabel, { color: palette.muted }]}
            >Step {stepIndex + 1} of {STEPS.length}</Text>
          </View>

          {stepIndex === 0 ? (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Contact</Text>
              <TextInput
                placeholder="Full name"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                value={name}
                onChangeText={setName}
              />
              <TextInput
                placeholder="Email"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                placeholder="Phone (optional)"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <View style={styles.tipCard}>
                <Text style={[styles.tipTitle, { color: palette.text }]}>Why scoopers love InsightScoop</Text>
                <Text style={[styles.tipBody, { color: palette.muted }]}>Flexible routes, clear payout tracking, and wellness tech that makes every visit faster.</Text>
              </View>
            </View>
          ) : null}

          {stepIndex === 1 ? (
            <View style={{ gap: 16 }}>
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Home base</Text>
                <TextInput
                  placeholder="Street address"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={homeAddress}
                  onChangeText={setHomeAddress}
                />
                <View style={styles.inlineRow}>
                  <TextInput
                    placeholder="City"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, styles.inlineInput, { color: palette.text, borderColor: palette.border }]}
                    value={homeCity}
                    onChangeText={setHomeCity}
                  />
                  <TextInput
                    placeholder="Zip"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, styles.inlineInput, { color: palette.text, borderColor: palette.border }]}
                    value={homeZip}
                    onChangeText={setHomeZip}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={styles.inlineRow}>
                  <Button
                    title={locationLoading ? 'Locating...' : 'Use current location'}
                    onPress={handleUseCurrentLocation}
                    variant="secondary"
                    style={styles.halfButton}
                  />
                  <Button
                    title="Find on map"
                    onPress={handleGeocodeHomeBase}
                    variant="secondary"
                    style={styles.halfButton}
                  />
                </View>
                {locationError ? (
                  <Text style={[styles.helperText, { color: palette.danger }]}>{locationError}</Text>
                ) : null}
              </View>

              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>Coverage map</Text>
                  {tilesLoading ? <ActivityIndicator size="small" color={palette.tint} /> : null}
                </View>
                <View style={styles.radiusRow}>
                  <Text style={[styles.helperText, { color: palette.muted }]}>Auto-add tiles within</Text>
                  <View style={styles.chipRow}>
                    {RADIUS_OPTIONS.map((radius) => (
                      <ChoiceChip
                        key={radius}
                        label={`${radius} mi`}
                        selected={preferredRadius === radius}
                        onPress={() => handleSelectRadius(radius)}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.mapWrapper}>
                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={mapRegion}
                  >
                    {tiles.map((tile) => {
                      const selection = tileSelections[tile.slug];
                      const baseColor = resolveStatusTone(tile.status);
                      const fillColor = selection?.selected
                        ? `${baseColor}55`
                        : `${baseColor}22`;
                      return tile.polygons.map((polygon, index) => (
                        <Polygon
                          key={`${tile.slug}-${index}`}
                          coordinates={polygon}
                          strokeColor={baseColor}
                          fillColor={fillColor}
                          strokeWidth={selection?.selected ? 2 : 1}
                          tappable
                          onPress={() => handleToggleTile(tile.slug)}
                        />
                      ));
                    })}
                    {homeLocation ? (
                      <Marker coordinate={homeLocation} title="Home base" />
                    ) : null}
                  </MapView>
                </View>
                <TextInput
                  placeholder="Search by city, zip, or tile"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={tileSearch}
                  onChangeText={setTileSearch}
                />
                {tilesError ? (
                  <Text style={[styles.helperText, { color: palette.danger }]}>{tilesError}</Text>
                ) : null}
                <View style={styles.tileList}>
                  {tileRows.map(({ tile, selection, distanceMiles }) => (
                    <Pressable
                      key={tile.slug}
                      onPress={() => handleToggleTile(tile.slug)}
                      style={[
                        styles.tileRow,
                        {
                          borderColor: selection.selected ? palette.tint : palette.border,
                          backgroundColor: selection.selected ? `${palette.tint}14` : palette.card,
                        },
                      ]}
                    >
                      <View style={styles.tileRowHeader}>
                        <Text style={[styles.tileName, { color: palette.text }]}>{tile.name}</Text>
                        <View style={[styles.statusPill, { backgroundColor: resolveStatusTone(tile.status) }]}>
                          <Text style={styles.statusPillText}>{tile.status}</Text>
                        </View>
                      </View>
                      <Text style={[styles.tileMeta, { color: palette.muted }]}
                      >{tile.cities.slice(0, 2).join(', ') || 'Coverage area'}</Text>
                      <View style={styles.tileRowFooter}>
                        <Text style={[styles.tileMeta, { color: palette.muted }]}>
                          {distanceMiles !== null ? `${distanceMiles} mi away` : 'Distance unavailable'}
                        </Text>
                        <Text style={[styles.tileAction, { color: selection.selected ? palette.danger : palette.tint }]}
                        >
                          {selection.selected ? 'Remove' : 'Add'}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {stepIndex === 2 ? (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Availability by tile</Text>
              <Text style={[styles.helperText, { color: palette.muted }]}
              >Tap a tile to fine-tune days and time window.</Text>
              {selectedTiles.length === 0 ? (
                <Text style={[styles.helperText, { color: palette.muted }]}>
                  No tiles selected yet.
                </Text>
              ) : (
                selectedTiles.map((tile) => (
                  <View key={tile.slug} style={[styles.availabilityBlock, { borderColor: palette.border }]}>
                    <Pressable onPress={() => toggleExpandedTile(tile.slug)} style={styles.availabilityHeader}>
                      <View>
                        <Text style={[styles.blockTitle, { color: palette.text }]}>{tile.name}</Text>
                        <Text style={[styles.tileMeta, { color: palette.muted }]}
                        >{tile.weekdays.length ? `${tile.weekdays.length} days selected` : 'No days selected'}</Text>
                      </View>
                      <FontAwesome
                        name={expandedTiles[tile.slug] ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={palette.muted}
                      />
                    </Pressable>
                    {expandedTiles[tile.slug] ? (
                      <View style={styles.availabilityBody}>
                        <Text style={[styles.inputLabel, { color: palette.muted }]}>Days</Text>
                        <View style={styles.chipRow}>
                          {WEEKDAYS.map((day) => (
                            <ChoiceChip
                              key={`${tile.slug}-${day.value}`}
                              label={day.label}
                              selected={tile.weekdays.includes(day.value)}
                              onPress={() => handleToggleWeekday(tile.slug, day.value)}
                            />
                          ))}
                        </View>
                        <Text style={[styles.inputLabel, { color: palette.muted }]}>Window</Text>
                        <View style={styles.chipRow}>
                          {WINDOW_OPTIONS.map((option) => (
                            <ChoiceChip
                              key={`${tile.slug}-${option.value}`}
                              label={option.label}
                              selected={tile.window === option.value}
                              onPress={() => handleWindowChange(tile.slug, option.value)}
                            />
                          ))}
                        </View>
                        <TextInput
                          placeholder="Max stops (optional)"
                          placeholderTextColor={palette.muted}
                          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                          value={tile.maxStops}
                          onChangeText={(value) => handleMaxStopsChange(tile.slug, value)}
                          keyboardType="number-pad"
                        />
                      </View>
                    ) : null}
                  </View>
                ))
              )}
              <Text style={[styles.inputLabel, { color: palette.muted }]}>Availability notes</Text>
              <TextInput
                placeholder="Add any schedule constraints"
                placeholderTextColor={palette.muted}
                style={[styles.input, styles.textArea, { color: palette.text, borderColor: palette.border }]}
                value={availabilityNotes}
                onChangeText={setAvailabilityNotes}
                multiline
              />
            </View>
          ) : null}

          {stepIndex === 3 ? (
            <View style={{ gap: 16 }}>
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Vehicle + insurance</Text>
                <TextInput
                  placeholder="Vehicle details (year, make, model)"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={vehicleDetail}
                  onChangeText={setVehicleDetail}
                />
                <TextInput
                  placeholder="Insurance proof URL (optional)"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={insuranceProofUrl}
                  onChangeText={setInsuranceProofUrl}
                />
              </View>

              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Experience</Text>
                <View style={styles.chipRow}>
                  {EXPERIENCE_OPTIONS.map((tag) => (
                    <ChoiceChip
                      key={tag}
                      label={tag}
                      selected={experienceTags.includes(tag)}
                      onPress={() => toggleExperienceTag(tag)}
                    />
                  ))}
                </View>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: palette.text }]}>Reliable transportation</Text>
                  <Switch
                    value={hasReliableTransport}
                    onValueChange={setHasReliableTransport}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: palette.text }]}>Smartphone with data</Text>
                  <Switch value={hasSmartphone} onValueChange={setHasSmartphone} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: palette.text }]}>Lift 40+ lbs</Text>
                  <Switch value={canLift} onValueChange={setCanLift} />
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Emergency contact</Text>
                <TextInput
                  placeholder="Contact name"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={emergencyContactName}
                  onChangeText={setEmergencyContactName}
                />
                <TextInput
                  placeholder="Contact phone"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={emergencyContactPhone}
                  onChangeText={setEmergencyContactPhone}
                  keyboardType="phone-pad"
                />
                <TextInput
                  placeholder="Relationship"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={emergencyContactRelation}
                  onChangeText={setEmergencyContactRelation}
                />
              </View>

              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Driver details</Text>
                <View style={styles.inlineRow}>
                  <TextInput
                    placeholder="State"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, styles.inlineInput, { color: palette.text, borderColor: palette.border }]}
                    value={driversLicenseState}
                    onChangeText={setDriversLicenseState}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    placeholder="License last 4"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, styles.inlineInput, { color: palette.text, borderColor: palette.border }]}
                    value={driversLicenseLast4}
                    onChangeText={setDriversLicenseLast4}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Consents</Text>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: palette.text }]}>Background check consent</Text>
                  <Switch value={backgroundConsent} onValueChange={setBackgroundConsent} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: palette.text }]}>Terms + safety policies</Text>
                  <Switch value={termsConsent} onValueChange={setTermsConsent} />
                </View>
                <Pressable
                  onPress={() =>
                    Linking.openURL('https://www.getinsightscoop.com/scooper-terms').catch(() => null)
                  }
                >
                  <Text style={[styles.linkText, { color: palette.tint }]}>
                    Read Scooper Marketplace Terms
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Free starter kit</Text>
                <View style={styles.kitCard}>
                  <View style={[styles.kitImage, { borderColor: palette.border }]}
                  >
                    <FontAwesome name="camera" size={28} color={palette.muted} />
                    <Text style={[styles.kitLabel, { color: palette.muted }]}>Device image</Text>
                  </View>
                  <View style={styles.kitCopy}>
                    <Text style={[styles.kitTitle, { color: palette.text }]}>Free after approval</Text>
                    <Text style={[styles.kitBody, { color: palette.muted }]}>
                      Once approved, we ship your free starter kit. It includes:
                      {'\n'}- Bluetooth capture device
                      {'\n'}- Branded PPE + safety gear
                      {'\n'}- Deodorizing spray
                      {'\n'}- Route-ready supplies
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {error ? (
            <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderColor: palette.border, backgroundColor: palette.background }]}>
          <View style={styles.footerRow}>
            <Button
              title="Back"
              onPress={handleBack}
              variant="secondary"
              disabled={stepIndex === 0}
              style={styles.footerButton}
            />
            {stepIndex < STEPS.length - 1 ? (
              <Button
                title="Next"
                onPress={handleNext}
                variant="cta"
                style={styles.footerButton}
              />
            ) : (
              <Button
                title={submitting ? 'Submitting...' : 'Submit application'}
                onPress={handleSubmit}
                variant="cta"
                style={styles.footerButton}
                disabled={submitting}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
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
  stepLabel: {
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineInput: {
    flex: 1,
  },
  halfButton: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tipCard: {
    backgroundColor: 'rgba(25, 180, 163, 0.08)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipBody: {
    fontSize: 12,
  },
  radiusRow: {
    gap: 8,
  },
  mapWrapper: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  tileList: {
    gap: 10,
  },
  tileRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  tileRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  tileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  tileMeta: {
    fontSize: 12,
  },
  tileRowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#1B1E23',
  },
  availabilityBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityBody: {
    gap: 10,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    fontSize: 14,
    flex: 1,
  },
  kitCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  kitImage: {
    width: 84,
    height: 84,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kitLabel: {
    fontSize: 11,
  },
  kitCopy: {
    flex: 1,
    gap: 6,
  },
  kitTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  kitBody: {
    fontSize: 12,
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  successBody: {
    fontSize: 13,
    textAlign: 'center',
  },
});
