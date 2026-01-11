import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import StatePicker from '@/components/ui/StatePicker';
import Switch from '@/components/ui/ThemedSwitch';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { DARK_MAP_STYLE } from '@/lib/maps/style';

type AvailabilityWindow = 'AM' | 'PM' | 'FULL';

type TileGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

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
  { title: 'Finalize', subtitle: 'Confirm details and submit.' },
];

const WEEKDAYS = [
  { key: 0, label: 'Sun' },
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
];

const DEFAULT_RADIUS_MILES = 15;
const FALLBACK_REGION = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const aCalc =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
}

function extractPolygons(geometry: TileGeometryCollection | null): LatLng[][] {
  if (!geometry?.features) return [];
  const result: LatLng[][] = [];
  geometry.features.forEach((feature) => {
    const geo = feature.geometry;
    if (!geo) return;
    if (geo.type === 'Polygon') {
      geo.coordinates.forEach((ring) => {
        result.push(ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
      });
    } else if (geo.type === 'MultiPolygon') {
      geo.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          result.push(ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
        });
      });
    }
  });
  return result;
}

function polygonCenter(rings: LatLng[][]): LatLng | null {
  const all = rings.flat();
  if (!all.length) return null;
  const sumLat = all.reduce((acc, p) => acc + p.latitude, 0);
  const sumLng = all.reduce((acc, p) => acc + p.longitude, 0);
  return { latitude: sumLat / all.length, longitude: sumLng / all.length };
}

function buildDefaultSelection(tile: TileDisplay): TileSelection {
  return {
    slug: tile.slug,
    name: tile.name,
    status: tile.status,
    selected: false,
    weekdays: [],
    window: 'FULL',
    maxStops: '',
  };
}

export default function ScooperApplyScreen() {
  const { session, setActiveRole } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mapRef = useRef<MapView>(null);

  // Form state
  const [name, setName] = useState(session?.user?.name ?? '');
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [homeState, setHomeState] = useState('');
  const [homeZip, setHomeZip] = useState('');
  const [homeLocation, setHomeLocation] = useState<LatLng | null>(null);
  const [vehicleDetail, setVehicleDetail] = useState('');
  const [backgroundConsent, setBackgroundConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);

  // Tiles and availability
  const [tiles, setTiles] = useState<TileDisplay[]>([]);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [tileSelections, setTileSelections] = useState<Record<string, TileSelection>>({});
  const [preferredRadius, setPreferredRadius] = useState(DEFAULT_RADIUS_MILES);
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});

  // UI state
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Load tiles
  const loadTiles = useCallback(async () => {
    setTilesLoading(true);
    try {
      const data = await apiRequest<{ data: TileApiEntry[] }>('/api/marketplace/tiles');
      const mapped = (data.data ?? []).map((entry) => {
        const polygons = extractPolygons(entry.tile.geometry ?? null);
        return {
          slug: entry.tile.slug,
          name: entry.tile.name,
          status: entry.tile.status,
          cities: entry.tile.cities ?? [],
          zips: entry.tile.zips ?? [],
          polygons,
          center: polygonCenter(polygons),
        };
      });
      setTiles(mapped);
    } catch {
      setTiles([]);
    } finally {
      setTilesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTiles();
  }, [loadTiles]);

  const visibleTiles = useMemo(() => {
    return tiles
      .map((tile) => {
        const selection = tileSelections[tile.slug] ?? buildDefaultSelection(tile);
        const distanceMiles =
          homeLocation && tile.center
            ? Math.round((haversineMeters(homeLocation, tile.center) / 1609.34) * 10) / 10
            : null;
        return { tile, selection, distanceMiles };
      })
      .filter(({ distanceMiles }) => {
        if (!homeLocation || distanceMiles === null) return true;
        return distanceMiles <= preferredRadius;
      })
      .sort((a, b) => {
        if (a.distanceMiles === null && b.distanceMiles === null) return 0;
        if (a.distanceMiles === null) return 1;
        if (b.distanceMiles === null) return -1;
        return a.distanceMiles - b.distanceMiles;
      });
  }, [homeLocation, tileSelections, tiles, preferredRadius]);

  const selectedTiles = useMemo(
    () => Object.values(tileSelections).filter((s) => s.selected),
    [tileSelections],
  );

  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const handleToggleTile = (slug: string) => {
    setTileSelections((prev) => {
      const existing = prev[slug];
      if (existing) {
        return { ...prev, [slug]: { ...existing, selected: !existing.selected } };
      }
      const tile = tiles.find((t) => t.slug === slug);
      if (!tile) return prev;
      return { ...prev, [slug]: { ...buildDefaultSelection(tile), selected: true } };
    });
  };

  const handleToggleWeekday = (slug: string, weekday: number) => {
    setTileSelections((prev) => {
      const selection = prev[slug];
      if (!selection) return prev;
      const weekdays = selection.weekdays.includes(weekday)
        ? selection.weekdays.filter((d) => d !== weekday)
        : [...selection.weekdays, weekday];
      return { ...prev, [slug]: { ...selection, weekdays } };
    });
  };

  const handleWindowChange = (slug: string, window: AvailabilityWindow) => {
    setTileSelections((prev) => {
      const selection = prev[slug];
      if (!selection) return prev;
      return { ...prev, [slug]: { ...selection, window } };
    });
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is required.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setHomeLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Unable to get location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleGeocodeHomeBase = async () => {
    const address = [homeAddress, homeCity, homeZip].filter(Boolean).join(', ');
    if (!address) {
      setLocationError('Enter your home base address first.');
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    try {
      const results = await Location.geocodeAsync(address);
      if (!results.length) {
        setLocationError('Could not find that address.');
        return;
      }
      setHomeLocation({ latitude: results[0].latitude, longitude: results[0].longitude });
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Geocoding failed.');
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

  const validateStep = (index: number) => {
    if (index === 0 && (!name.trim() || !email.trim())) {
      return 'Name and email are required.';
    }
    if (index === 1 && selectedTiles.length === 0) {
      return 'Select at least one service tile.';
    }
    if (index === 2) {
      const invalid = selectedTiles.some((t) => t.weekdays.length === 0);
      if (invalid) return 'Pick at least one day for each tile.';
    }
    if (index === 3) {
      if (!vehicleDetail.trim()) return 'Vehicle details are required.';
      if (!backgroundConsent || !termsConsent) {
        return 'Confirm the background check and terms consents.';
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
      const mappedAvailability = selectedTiles.flatMap((entry) =>
        entry.weekdays.map((weekday) => ({
          tileSlug: entry.slug,
          weekday,
          window: entry.window,
        })),
      );

      await apiRequest('/api/scoopers/apply', {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          vehicleDetail: vehicleDetail.trim(),
          homeBaseAddress: homeAddress.trim() || undefined,
          homeBaseCity: homeCity.trim() || undefined,
          homeBaseState: homeState.trim().toUpperCase() || undefined,
          homeBaseZip: homeZip.trim() || undefined,
          location: homeLocation
            ? { lat: homeLocation.latitude, lng: homeLocation.longitude }
            : undefined,
          availability: mappedAvailability,
          applicationSource: 'mobile-onboarding',
          preferredRadiusMiles: preferredRadius,
          backgroundConsent,
          termsConsent,
        },
      });

      // Update active role to TECH for the session
      await setActiveRole('TECH');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueToScooper = () => {
    router.replace('/(app)/(scooper)');
  };

  if (success) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <FontAwesome name="check-circle" size={48} color={Colors.brand.mint} />
          <Text style={[styles.successTitle, { color: palette.text }]}>
            Application submitted!
          </Text>
          <Text style={[styles.successBody, { color: palette.muted }]}>
            We received your application and will follow up via email with next steps. In the
            meantime, you can explore the scooper dashboard.
          </Text>
          <Button title="Go to Scooper Dashboard" onPress={handleContinueToScooper} />
        </View>
      </Screen>
    );
  }

  const step = STEPS[stepIndex];
  const statusColor = (status: string) => {
    switch (status) {
      case 'LIVE':
        return Colors.brand.mint;
      case 'WAITLIST':
        return Colors.brand.gold;
      default:
        return Colors.brand.graphiteSoft;
    }
  };

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
            <Text style={[styles.kicker, { color: palette.muted }]}>Become a scooper</Text>
            <Text style={[styles.title, { color: palette.text }]}>{step.title}</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>{step.subtitle}</Text>
            <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
              <View
                style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: palette.tint }]}
              />
            </View>
            <Text style={[styles.stepLabel, { color: palette.muted }]}>
              Step {stepIndex + 1} of {STEPS.length}
            </Text>
          </View>

          {stepIndex === 0 && (
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
            </View>
          )}

          {stepIndex === 1 && (
            <View style={{ gap: 16 }}>
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Home base</Text>
                <TextInput
                  placeholder="Street address"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={homeAddress}
                  onChangeText={setHomeAddress}
                />
                <TextInput
                  placeholder="City"
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                  value={homeCity}
                  onChangeText={setHomeCity}
                />
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <StatePicker value={homeState} onSelect={setHomeState} />
                  </View>
                  <TextInput
                    placeholder="ZIP"
                    placeholderTextColor={palette.muted}
                    style={[styles.input, styles.zipInput, { color: palette.text, borderColor: palette.border }]}
                    value={homeZip}
                    onChangeText={setHomeZip}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={styles.buttonRow}>
                  <Button
                    title={locationLoading ? 'Locating...' : 'Use current location'}
                    onPress={handleUseCurrentLocation}
                    variant="secondary"
                    disabled={locationLoading}
                  />
                  <Button
                    title="Find address"
                    onPress={handleGeocodeHomeBase}
                    variant="secondary"
                    disabled={locationLoading}
                  />
                </View>
                {locationError && (
                  <Text style={[styles.errorText, { color: palette.danger }]}>{locationError}</Text>
                )}
              </View>

              <View style={[styles.mapCard, { borderColor: palette.border }]}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={mapRegion}
                  customMapStyle={colorScheme === 'dark' ? DARK_MAP_STYLE : undefined}
                >
                  {homeLocation && (
                    <Marker coordinate={homeLocation} title="Home base">
                      <View style={styles.homeMarker}>
                        <FontAwesome name="home" size={16} color="#FFFFFF" />
                      </View>
                    </Marker>
                  )}
                  {visibleTiles.map(({ tile }) =>
                    tile.polygons.map((ring, i) => (
                      <Polygon
                        key={`${tile.slug}-${i}`}
                        coordinates={ring}
                        fillColor={statusColor(tile.status) + '30'}
                        strokeColor={statusColor(tile.status)}
                        strokeWidth={1}
                      />
                    )),
                  )}
                </MapView>
              </View>

              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Select tiles</Text>
                {tilesLoading && <ActivityIndicator color={palette.tint} />}
                {visibleTiles.map(({ tile, selection, distanceMiles }) => (
                  <Pressable
                    key={tile.slug}
                    style={[
                      styles.tileRow,
                      { borderColor: selection.selected ? palette.tint : palette.border },
                    ]}
                    onPress={() => handleToggleTile(tile.slug)}
                  >
                    <View style={styles.tileInfo}>
                      <Text style={[styles.tileName, { color: palette.text }]}>{tile.name}</Text>
                      <Text style={[styles.tileMeta, { color: palette.muted }]}>
                        {tile.status} {distanceMiles !== null ? `• ${distanceMiles} mi` : ''}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: palette.border },
                        selection.selected && { backgroundColor: palette.tint, borderColor: palette.tint },
                      ]}
                    >
                      {selection.selected && <FontAwesome name="check" size={12} color="#FFF" />}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {stepIndex === 2 && (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Availability</Text>
              {selectedTiles.map((selection) => (
                <View key={selection.slug} style={styles.tileSchedule}>
                  <Text style={[styles.tileName, { color: palette.text }]}>{selection.name}</Text>
                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map((day) => (
                      <Pressable
                        key={day.key}
                        style={[
                          styles.weekdayChip,
                          { borderColor: palette.border },
                          selection.weekdays.includes(day.key) && {
                            backgroundColor: palette.tint,
                            borderColor: palette.tint,
                          },
                        ]}
                        onPress={() => handleToggleWeekday(selection.slug, day.key)}
                      >
                        <Text
                          style={[
                            styles.weekdayLabel,
                            { color: selection.weekdays.includes(day.key) ? '#FFF' : palette.muted },
                          ]}
                        >
                          {day.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.windowRow}>
                    {(['AM', 'PM', 'FULL'] as AvailabilityWindow[]).map((w) => (
                      <ChoiceChip
                        key={w}
                        label={w}
                        selected={selection.window === w}
                        onPress={() => handleWindowChange(selection.slug, w)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {stepIndex === 3 && (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Vehicle & consents</Text>
              <TextInput
                placeholder="Vehicle details (e.g., 2020 Honda Civic)"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                value={vehicleDetail}
                onChangeText={setVehicleDetail}
              />
              <View style={styles.consentRow}>
                <Switch value={backgroundConsent} onValueChange={setBackgroundConsent} />
                <Text style={[styles.consentText, { color: palette.text }]}>
                  I consent to a background check
                </Text>
              </View>
              <View style={styles.consentRow}>
                <Switch value={termsConsent} onValueChange={setTermsConsent} />
                <Pressable onPress={() => Linking.openURL('https://insightscoop.com/legal/scooper-terms')}>
                  <Text style={[styles.consentText, { color: palette.tint }]}>
                    I agree to the Scooper Terms
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {error && <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>}

          <View style={styles.navRow}>
            {stepIndex > 0 && (
              <Button title="Back" onPress={handleBack} variant="secondary" />
            )}
            {stepIndex < STEPS.length - 1 ? (
              <Button title="Next" onPress={handleNext} />
            ) : (
              <Button
                title={submitting ? 'Submitting...' : 'Submit application'}
                onPress={handleSubmit}
                disabled={submitting}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40, gap: 16 },
  header: { gap: 6 },
  kicker: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 12 },
  progressFill: { height: 6, borderRadius: 3 },
  stepLabel: { fontSize: 12, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  row: { flexDirection: 'row', gap: 12 },
  zipInput: { width: 100 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  mapCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', height: 200 },
  map: { flex: 1 },
  homeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    gap: 12,
  },
  tileInfo: { flex: 1 },
  tileName: { fontSize: 14, fontWeight: '600' },
  tileMeta: { fontSize: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSchedule: { gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekdayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  weekdayLabel: { fontSize: 12, fontWeight: '600' },
  windowRow: { flexDirection: 'row', gap: 8 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  consentText: { flex: 1, fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  successBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
