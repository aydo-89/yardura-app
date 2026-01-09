import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import BottomSheet from '@/components/ui/BottomSheet';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { DARK_MAP_STYLE } from '@/lib/maps/style';
import type { TrackingState } from '@/lib/wellness/useWalkTracking';

type WalkMapViewProps = {
  points: LatLng[];
  isTracking: boolean;
  trackingState: TrackingState;
  distanceLabel: string;
  durationLabel: string;
  paceLabel: string;
  dogLabel: string;
  dateLabel: string;
};

export default function WalkMapView({
  points,
  isTracking,
  trackingState,
  distanceLabel,
  durationLabel,
  paceLabel,
  dogLabel,
  dateLabel,
}: WalkMapViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const mapRef = useRef<MapView | null>(null);
  const fullscreenMapRef = useRef<MapView | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);

  // Get initial region from device location
  useEffect(() => {
    if (points.length > 0 || region) return;
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) return null;
        return Location.getLastKnownPositionAsync({});
      })
      .then((position) => {
        if (!position?.coords) return;
        setRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      })
      .catch(() => null);
  }, [points.length, region]);

  // Fit map to points when they change
  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;
    if (points.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: points[0].latitude,
          longitude: points[0].longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        400,
      );
      return;
    }
    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 50, bottom: 100, left: 40, right: 40 },
      animated: true,
    });
  }, [points]);

  const defaultRegion = region ?? {
    latitude: 44.98,
    longitude: -93.26,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const mapStyle = colorScheme === 'dark' ? (DARK_MAP_STYLE as any) : undefined;
  const mapType = Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'mutedStandard' : 'standard') : 'standard';

  return (
    <>
      <View style={[styles.container, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Route</Text>
          {points.length > 0 && (
            <Pressable onPress={() => setExpanded(true)} style={[styles.expandButton, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="expand" size={12} color={palette.tint} />
              <Text style={[styles.expandText, { color: palette.tint }]}>Fullscreen</Text>
            </Pressable>
          )}
        </View>

        {/* Map */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={(ref) => { mapRef.current = ref; }}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            mapType={mapType}
            customMapStyle={mapStyle}
            showsUserLocation={isTracking}
            showsMyLocationButton={isTracking}
            initialRegion={defaultRegion}
          >
            {points.length > 0 && (
              <>
                <Polyline
                  coordinates={points}
                  strokeWidth={10}
                  strokeColor={colorScheme === 'dark' ? 'rgba(244, 100, 91, 0.25)' : 'rgba(244, 100, 91, 0.2)'}
                />
                <Polyline coordinates={points} strokeWidth={4} strokeColor={palette.tint} />
                <Marker coordinate={points[0]} title="Start" pinColor="#22C55E" />
                <Marker coordinate={points[points.length - 1]} title="Finish" pinColor={palette.tint} />
              </>
            )}
          </MapView>

          {/* Empty state overlay */}
          {points.length === 0 && (
            <View style={[styles.emptyOverlay, { backgroundColor: colorScheme === 'dark' ? 'rgba(2,6,23,0.5)' : 'rgba(15,23,42,0.06)' }]}>
              <View style={[styles.emptyIcon, { backgroundColor: `${palette.muted}15` }]}>
                <FontAwesome name="map" size={18} color={palette.muted} />
              </View>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Start a walk to see the route
              </Text>
            </View>
          )}

          {/* Stats overlay (collapsed) */}
          {points.length > 0 && (
            <Pressable
              onPress={() => setExpanded(true)}
              style={[styles.statsOverlay, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.statsOverlayRow}>
                <Text style={[styles.statsOverlayValue, { color: palette.text }]}>{distanceLabel}</Text>
                <Text style={[styles.statsOverlayDot, { color: palette.muted }]}>·</Text>
                <Text style={[styles.statsOverlayValue, { color: palette.text }]}>{durationLabel}</Text>
              </View>
              <Text style={[styles.statsOverlayLabel, { color: palette.muted }]}>
                {trackingState === 'idle' ? dogLabel : 'Live tracking'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Fullscreen Bottom Sheet */}
      <BottomSheet visible={expanded} onClose={() => setExpanded(false)} snapPoints={[0.92]}>
        <View style={styles.fullscreenContent}>
          {/* Header */}
          <View style={styles.fullscreenHeader}>
            <View style={styles.fullscreenTitleRow}>
              <Text style={[styles.fullscreenTitle, { color: palette.text }]}>{dogLabel}</Text>
              <Text style={[styles.fullscreenDate, { color: palette.muted }]}>{dateLabel}</Text>
            </View>
            <Pressable onPress={() => setExpanded(false)} style={[styles.closeButton, { borderColor: palette.border }]}>
              <FontAwesome name="times" size={16} color={palette.text} />
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={styles.fullscreenStats}>
            <View style={styles.fullscreenStat}>
              <Text style={[styles.fullscreenStatValue, { color: palette.text }]}>{distanceLabel}</Text>
              <Text style={[styles.fullscreenStatLabel, { color: palette.muted }]}>Distance</Text>
            </View>
            <View style={styles.fullscreenStat}>
              <Text style={[styles.fullscreenStatValue, { color: palette.text }]}>{durationLabel}</Text>
              <Text style={[styles.fullscreenStatLabel, { color: palette.muted }]}>Time</Text>
            </View>
            <View style={styles.fullscreenStat}>
              <Text style={[styles.fullscreenStatValue, { color: palette.text }]}>{paceLabel}</Text>
              <Text style={[styles.fullscreenStatLabel, { color: palette.muted }]}>Pace</Text>
            </View>
          </View>

          {/* Fullscreen map */}
          <View style={styles.fullscreenMapWrapper}>
            <MapView
              ref={(ref) => { fullscreenMapRef.current = ref; }}
              style={styles.fullscreenMap}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              mapType={mapType}
              customMapStyle={mapStyle}
              showsUserLocation={isTracking}
              showsMyLocationButton
              initialRegion={
                points.length > 0
                  ? {
                      latitude: points[0].latitude,
                      longitude: points[0].longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }
                  : defaultRegion
              }
              onLayout={() => {
                if (points.length > 1) {
                  setTimeout(() => {
                    fullscreenMapRef.current?.fitToCoordinates(points, {
                      edgePadding: { top: 40, bottom: 40, left: 40, right: 40 },
                      animated: true,
                    });
                  }, 300);
                }
              }}
            >
              {points.length > 0 && (
                <>
                  <Polyline
                    coordinates={points}
                    strokeWidth={12}
                    strokeColor={colorScheme === 'dark' ? 'rgba(244, 100, 91, 0.25)' : 'rgba(244, 100, 91, 0.2)'}
                  />
                  <Polyline coordinates={points} strokeWidth={5} strokeColor={palette.tint} />
                  <Marker coordinate={points[0]} title="Start" pinColor="#22C55E" />
                  <Marker coordinate={points[points.length - 1]} title="Finish" pinColor={palette.tint} />
                </>
              )}
            </MapView>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  expandText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapWrapper: {
    height: 260,
    margin: 14,
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  statsOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  statsOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsOverlayValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  statsOverlayDot: {
    fontSize: 14,
  },
  statsOverlayLabel: {
    fontSize: 11,
  },
  // Fullscreen styles
  fullscreenContent: {
    flex: 1,
    gap: 14,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  fullscreenTitleRow: {
    flex: 1,
    gap: 4,
  },
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  fullscreenDate: {
    fontSize: 13,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenStats: {
    flexDirection: 'row',
    gap: 12,
  },
  fullscreenStat: {
    flex: 1,
    gap: 4,
  },
  fullscreenStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  fullscreenStatLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullscreenMapWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 300,
  },
  fullscreenMap: {
    flex: 1,
  },
});
