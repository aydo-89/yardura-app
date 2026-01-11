import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';

import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiRequest } from '@/lib/api/client';
import type { OutboundLead, ServiceAreaSummary, TeamLocation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSales } from '@/lib/sales/SalesProvider';
import { formatLeadAddress, formatLeadName, getLeadCoordinates, stageColorToHex } from '@/lib/sales/utils';
import { DARK_MAP_STYLE } from '@/lib/maps/style';

type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

type GeoJsonFeature = {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties?: Record<string, unknown>;
};

function extractPolygons(geometry: GeoJsonGeometry): LatLng[][] {
  if (geometry.type === 'Polygon') {
    const [outer] = geometry.coordinates;
    if (!outer) return [];
    return [
      outer.map((coord) => ({
        latitude: coord[1],
        longitude: coord[0],
      })),
    ];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => {
      const [outer] = polygon;
      if (!outer) return [];
      return [
        outer.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        })),
      ];
    });
  }
  return [];
}

function resolveFeaturePolygons(feature?: GeoJsonFeature | null): LatLng[][] {
  if (!feature || !feature.geometry) return [];
  return extractPolygons(feature.geometry);
}

function resolveServiceAreaColors(status?: string | null, colorScheme?: string) {
  if (status === 'LIVE') {
    return {
      fill: colorScheme === 'dark' ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)',
      stroke: colorScheme === 'dark' ? 'rgba(16,185,129,0.65)' : 'rgba(16,185,129,0.45)',
    };
  }
  if (status === 'WAITLIST') {
    return {
      fill: colorScheme === 'dark' ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)',
      stroke: colorScheme === 'dark' ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.45)',
    };
  }
  return {
    fill: colorScheme === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.08)',
    stroke: colorScheme === 'dark' ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.35)',
  };
}

export default function SalesMapScreen() {
  const { leadId: initialLeadId } = useLocalSearchParams<{ leadId?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { session } = useAuth();
  const { filteredLeads } = useSales();
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [fallbackCenter, setFallbackCenter] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaSummary[]>([]);
  const [serviceAreasLoading, setServiceAreasLoading] = useState(false);
  const [showServiceAreas, setShowServiceAreas] = useState(true);
  const [showTeamRadar, setShowTeamRadar] = useState(false);
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const [dropPinMode, setDropPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);
  const [selectedLead, setSelectedLead] = useState<OutboundLead | null>(null);

  useEffect(() => {
    if (!selectedLead) return;
    const stillVisible = filteredLeads.some((lead) => lead.id === selectedLead.id);
    if (!stillVisible) {
      setSelectedLead(null);
    }
  }, [filteredLeads, selectedLead]);

  // Handle incoming leadId from "View on map" navigation
  useEffect(() => {
    if (!initialLeadId || filteredLeads.length === 0 || !mapReady) return;
    const lead = filteredLeads.find((l) => l.id === initialLeadId);
    if (lead) {
      setSelectedLead(lead);
      const coords = getLeadCoordinates(lead);
      if (coords && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    }
  }, [initialLeadId, filteredLeads, mapReady]);

  const leadsWithCoords = useMemo(
    () =>
      filteredLeads
        .map((lead) => {
          const coords = getLeadCoordinates(lead);
          return coords ? { lead, coords } : null;
        })
        .filter((value): value is { lead: OutboundLead; coords: LatLng } => Boolean(value)),
    [filteredLeads],
  );
  const addressLine = useMemo(() => {
    const address = session?.user?.address ?? null;
    const city = session?.user?.city ?? null;
    const zip = session?.user?.zipCode ?? null;
    const parts = [address, city, zip].map((part) => part?.trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }, [session?.user?.address, session?.user?.city, session?.user?.zipCode]);

  const serviceAreaPolygons = useMemo(() => {
    return serviceAreas.flatMap((area) => {
      const feature = area.tileGeometry as GeoJsonFeature | null | undefined;
      const polygons = resolveFeaturePolygons(feature);
      return polygons.map((coordinates) => ({
        id: area.tile.slug,
        status: area.tile.status,
        coordinates,
      }));
    });
  }, [serviceAreas]);

  const fitMapToCoordinates = useCallback(() => {
    if (!mapReady || !mapRef.current) return;
    const coords = leadsWithCoords.map((item) => item.coords);
    if (!coords.length) {
      const fallback = location ?? fallbackCenter;
      if (fallback) {
        mapRef.current.animateToRegion(
          {
            latitude: fallback.latitude,
            longitude: fallback.longitude,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          },
          350,
        );
      }
      return;
    }
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, bottom: 80, left: 80, right: 80 },
      animated: true,
    });
  }, [mapReady, leadsWithCoords, location, fallbackCenter]);

  useEffect(() => {
    fitMapToCoordinates();
  }, [fitMapToCoordinates]);

  useEffect(() => {
    const hydrateLocation = async () => {
      if (Platform.OS === 'web') return;
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      } catch (err) {
        console.warn('Unable to read location', err);
      }
    };
    void hydrateLocation();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (location || fallbackCenter || !addressLine) return;
    let mounted = true;
    const geocode = async () => {
      try {
        const results = await Location.geocodeAsync(addressLine);
        if (!mounted || !results.length) return;
        setFallbackCenter({
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        });
      } catch (err) {
        console.warn('Unable to geocode sales address', err);
      }
    };
    void geocode();
    return () => {
      mounted = false;
    };
  }, [addressLine, fallbackCenter, location]);

  const handleUseLocation = async () => {
    if (Platform.OS === 'web') return;
    setLocationError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Location permission denied.');
      return;
    }
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (err) {
      setLocationError('Unable to fetch location.');
    }
  };

  const loadServiceAreas = useCallback(async () => {
    setServiceAreasLoading(true);
    try {
      const payload = await apiRequest<{ serviceAreas?: ServiceAreaSummary[] }>(
        '/api/admin/service-areas',
        { token: session?.token ?? undefined },
      );
      setServiceAreas(payload.serviceAreas ?? []);
    } catch (err) {
      console.warn('Failed to load service areas', err);
    } finally {
      setServiceAreasLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    void loadServiceAreas();
  }, [loadServiceAreas]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let interval: ReturnType<typeof setInterval> | null = null;

      const fetchTeam = async () => {
        if (!session?.token) return;
        try {
          const data = await apiRequest<TeamLocation[]>(
            '/api/leads/outbound/team',
            { token: session.token },
          );
          if (active) {
            setTeamLocations(Array.isArray(data) ? data : []);
          }
        } catch (err) {
          if (active) setTeamLocations([]);
        }
      };

      if (showTeamRadar) {
        void fetchTeam();
        interval = setInterval(fetchTeam, 30000);
      }

      return () => {
        active = false;
        if (interval) clearInterval(interval);
      };
    }, [session?.token, showTeamRadar]),
  );

  const handleMapPress = (event: { nativeEvent: { coordinate: LatLng; action?: string } }) => {
    if (event.nativeEvent.action === 'marker-press') return;
    if (dropPinMode) {
      setPendingPin(event.nativeEvent.coordinate);
      return;
    }
    setSelectedLead(null);
  };

  const handleDropPinAtLocation = async () => {
    if (Platform.OS === 'web') return;
    setLocationError(null);

    let currentLocation = location;
    if (!currentLocation) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied.');
        return;
      }
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        currentLocation = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setLocation(currentLocation);
      } catch (err) {
        setLocationError('Unable to fetch location.');
        return;
      }
    }

    if (!currentLocation) return;
    setPendingPin(currentLocation);
    setDropPinMode(false);
    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      },
      250,
    );
  };

  const handleCreateFromPin = () => {
    if (!pendingPin) return;
    router.push({
      pathname: '/(app)/(sales)/lead/new',
      params: {
        lat: pendingPin.latitude.toString(),
        lng: pendingPin.longitude.toString(),
      },
    });
    setPendingPin(null);
    setDropPinMode(false);
  };

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <View style={[styles.mapFallback, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.mapFallbackText, { color: palette.muted }]}>
            The interactive map is available on iOS and Android.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          mapType={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'mutedStandard' : 'standard') : 'standard'}
          customMapStyle={colorScheme === 'dark' ? DARK_MAP_STYLE : []}
          initialRegion={{
            latitude: location?.latitude ?? fallbackCenter?.latitude ?? 37.773972,
            longitude: location?.longitude ?? fallbackCenter?.longitude ?? -122.431297,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          }}
          onMapReady={() => setMapReady(true)}
          onPress={handleMapPress}
          showsUserLocation={Boolean(location)}
          showsMyLocationButton={Boolean(location)}
          showsCompass={true}
        >
          {showServiceAreas
            ? serviceAreaPolygons.map((polygon, index) => {
                const colors = resolveServiceAreaColors(polygon.status, colorScheme);
                return (
                  <Polygon
                    key={`${polygon.id}-${index}`}
                    coordinates={polygon.coordinates}
                    strokeColor={colors.stroke}
                    fillColor={colors.fill}
                    strokeWidth={2}
                  />
                );
              })
            : null}

          {leadsWithCoords.map(({ lead, coords }) => (
            <Marker
              key={lead.id}
              coordinate={coords}
              pinColor={stageColorToHex(lead.stageColor)}
              title={formatLeadName(lead)}
              description={formatLeadAddress(lead)}
              onPress={(event) => {
                event.stopPropagation?.();
                setSelectedLead(lead);
              }}
            />
          ))}

          {showTeamRadar
            ? teamLocations.map((member) => (
                <Marker
                  key={member.userId}
                  coordinate={{
                    latitude: member.latitude,
                    longitude: member.longitude,
                  }}
                  pinColor={Colors.brand.mint}
                  title={member.name || member.email || 'Team rep'}
                />
              ))
            : null}

          {pendingPin ? (
            <Marker coordinate={pendingPin} pinColor={palette.tint} />
          ) : null}
        </MapView>

        <View style={styles.mapControls}>
          <Pressable
            onPress={() => setShowServiceAreas((prev) => !prev)}
            style={[
              styles.mapControl,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome
              name={showServiceAreas ? 'map' : 'map-o'}
              size={14}
              color={palette.text}
            />
            <Text style={[styles.mapControlLabel, { color: palette.text }]}>
              {showServiceAreas ? 'Hide areas' : 'Show areas'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowTeamRadar((prev) => !prev)}
            style={[
              styles.mapControl,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome
              name={showTeamRadar ? 'users' : 'user-o'}
              size={14}
              color={palette.text}
            />
            <Text style={[styles.mapControlLabel, { color: palette.text }]}>
              {showTeamRadar ? 'Hide team' : 'Team radar'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDropPinMode((prev) => !prev)}
            style={[
              styles.mapControl,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome
              name={dropPinMode ? 'map-marker' : 'map-marker'}
              size={14}
              color={dropPinMode ? palette.tint : palette.text}
            />
            <Text style={[styles.mapControlLabel, { color: palette.text }]}>
              {dropPinMode ? 'Drop pin on' : 'Drop pin'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleDropPinAtLocation}
            style={[
              styles.mapControl,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome name="crosshairs" size={14} color={palette.text} />
            <Text style={[styles.mapControlLabel, { color: palette.text }]}>Drop here</Text>
          </Pressable>
          <Pressable
            onPress={handleUseLocation}
            style={[
              styles.mapControl,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome name="location-arrow" size={14} color={palette.text} />
            <Text style={[styles.mapControlLabel, { color: palette.text }]}>Locate</Text>
          </Pressable>
        </View>

        {locationError ? (
          <View style={styles.mapBanner}>
            <Text style={[styles.mapBannerText, { color: palette.danger }]}>
              {locationError}
            </Text>
          </View>
        ) : null}

        {serviceAreasLoading ? (
          <View style={styles.mapBanner}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.mapBannerText, { color: palette.muted }]}>
              Loading service areas...
            </Text>
          </View>
        ) : null}

        {pendingPin ? (
          <View style={[styles.mapBanner, styles.pinBanner, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.mapBannerText, { color: palette.text }]}>
              Pin ready for a new lead.
            </Text>
            <Button title="Create lead" onPress={handleCreateFromPin} />
          </View>
        ) : null}

        {selectedLead ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/(sales)/lead/[leadId]',
                params: { leadId: selectedLead.id },
              })
            }
            style={[
              styles.leadPeek,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.leadPeekHeader}>
              <Text style={[styles.leadPeekTitle, { color: palette.text }]}>
                {formatLeadName(selectedLead)}
              </Text>
              <FontAwesome name="chevron-right" size={14} color={palette.muted} />
            </View>
            {formatLeadAddress(selectedLead) ? (
              <Text style={[styles.leadPeekSubtitle, { color: palette.muted }]}>
                {formatLeadAddress(selectedLead)}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 20,
    left: 20,
    gap: 8,
  },
  mapControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  mapControlLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapBanner: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.75)',
  },
  mapBannerText: {
    fontSize: 12,
  },
  pinBanner: {
    bottom: 120,
    borderWidth: 1,
  },
  leadPeek: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  leadPeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leadPeekTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  leadPeekSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  mapFallback: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
  },
  mapFallbackText: {
    fontSize: 14,
  },
});
