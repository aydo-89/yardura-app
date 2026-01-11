import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Location from 'expo-location';

import Colors from '@/constants/Colors';
import {
  getWalkPreferences,
  setWalkPreferences,
  RADIUS_PRESETS,
  formatRadius,
  type WalkTrackingMode,
  type WalkPreferences,
} from '@/lib/wellness/walkPreferences';

type Props = {
  colorScheme: 'light' | 'dark';
  palette: typeof Colors.light;
  isPremium?: boolean;
  onPreferencesChange?: (prefs: WalkPreferences) => void;
};

type TrackingModeOption = {
  mode: WalkTrackingMode;
  icon: string;
  title: string;
  description: string;
  premiumOnly?: boolean;
};

const TRACKING_MODES: TrackingModeOption[] = [
  {
    mode: 'everywhere',
    icon: 'globe',
    title: 'Track everywhere',
    description: 'Detect walks anywhere you go',
  },
  {
    mode: 'near_home',
    icon: 'home',
    title: 'Only near home',
    description: 'Only detect walks starting near your home',
  },
  {
    mode: 'disabled',
    icon: 'ban',
    title: 'Disabled',
    description: 'Turn off automatic walk detection',
  },
];

export default function WalkTrackingSettings({
  colorScheme,
  palette,
  isPremium = false,
  onPreferencesChange,
}: Props) {
  const [preferences, setPreferencesState] = useState<WalkPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingLocation, setSettingLocation] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await getWalkPreferences();
      setPreferencesState(prefs);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleModeChange = async (mode: WalkTrackingMode) => {
    if (!preferences || saving) return;
    setSaving(true);
    try {
      const updated = await setWalkPreferences({ mode });
      setPreferencesState(updated);
      onPreferencesChange?.(updated);
    } catch (err) {
      Alert.alert('Error', 'Unable to save preference');
    } finally {
      setSaving(false);
    }
  };

  const handleSetHomeLocation = async () => {
    if (settingLocation) return;
    setSettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to set your home location.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const updated = await setWalkPreferences({
        homeLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      });
      setPreferencesState(updated);
      onPreferencesChange?.(updated);
      Alert.alert('Home location set', 'Your current location has been saved as your home location for walk tracking.');
    } catch (err) {
      Alert.alert('Error', 'Unable to get your location. Please try again.');
    } finally {
      setSettingLocation(false);
    }
  };

  const handleClearHomeLocation = async () => {
    if (saving) return;
    Alert.alert('Clear home location?', 'This will remove your saved home location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const updated = await setWalkPreferences({ homeLocation: null });
            setPreferencesState(updated);
            onPreferencesChange?.(updated);
          } catch {
            Alert.alert('Error', 'Unable to clear home location');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleRadiusChange = async (radius: number) => {
    if (!preferences || saving) return;
    setSaving(true);
    try {
      const updated = await setWalkPreferences({ homeRadiusMeters: radius });
      setPreferencesState(updated);
      onPreferencesChange?.(updated);
    } catch {
      Alert.alert('Error', 'Unable to save radius');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.tint} />
          <Text style={[styles.loadingText, { color: palette.muted }]}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  if (!preferences) return null;

  const currentMode = TRACKING_MODES.find((m) => m.mode === preferences.mode) ?? TRACKING_MODES[0];

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {/* Header */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
          <FontAwesome name="cog" size={18} color={Colors.brand.gold} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Walk Tracking Settings</Text>
          <Text style={[styles.headerSubtitle, { color: palette.muted }]}>
            {currentMode.title}
          </Text>
        </View>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={palette.muted}
        />
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          {/* Tracking Mode Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.muted }]}>Detection Mode</Text>
            <View style={styles.modeList}>
              {TRACKING_MODES.map((option) => {
                const isSelected = preferences.mode === option.mode;
                const isDisabled = option.premiumOnly && !isPremium;
                return (
                  <Pressable
                    key={option.mode}
                    onPress={() => !isDisabled && handleModeChange(option.mode)}
                    disabled={isDisabled || saving}
                    style={[
                      styles.modeOption,
                      {
                        backgroundColor: isSelected ? `${palette.tint}10` : 'transparent',
                        borderColor: isSelected ? palette.tint : palette.border,
                        opacity: isDisabled ? 0.5 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.modeIcon,
                        {
                          backgroundColor: isSelected
                            ? `${palette.tint}15`
                            : `${palette.muted}10`,
                        },
                      ]}
                    >
                      <FontAwesome
                        name={option.icon as any}
                        size={16}
                        color={isSelected ? palette.tint : palette.muted}
                      />
                    </View>
                    <View style={styles.modeText}>
                      <Text
                        style={[
                          styles.modeTitle,
                          { color: isSelected ? palette.tint : palette.text },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text style={[styles.modeDescription, { color: palette.muted }]}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkIcon, { backgroundColor: palette.tint }]}>
                        <FontAwesome name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Home Location Section - Only show when "near home" mode */}
          {preferences.mode === 'near_home' && (
            <>
              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.muted }]}>Home Location</Text>

                {preferences.homeLocation ? (
                  <View style={styles.homeLocationSet}>
                    <View style={[styles.homeLocationBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
                      <FontAwesome name="check-circle" size={16} color={Colors.brand.mint} />
                      <Text style={[styles.homeLocationText, { color: Colors.brand.mint }]}>
                        Location saved
                      </Text>
                    </View>
                    <View style={styles.homeLocationActions}>
                      <Pressable
                        onPress={handleSetHomeLocation}
                        disabled={settingLocation}
                        style={[styles.updateButton, { borderColor: palette.border }]}
                      >
                        {settingLocation ? (
                          <ActivityIndicator size="small" color={palette.tint} />
                        ) : (
                          <>
                            <FontAwesome name="refresh" size={12} color={palette.tint} />
                            <Text style={[styles.updateButtonText, { color: palette.tint }]}>
                              Update
                            </Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={handleClearHomeLocation}
                        disabled={saving}
                        style={[styles.clearButton, { borderColor: palette.danger }]}
                      >
                        <FontAwesome name="times" size={12} color={palette.danger} />
                        <Text style={[styles.clearButtonText, { color: palette.danger }]}>
                          Clear
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleSetHomeLocation}
                    disabled={settingLocation}
                    style={[styles.setLocationButton, { backgroundColor: `${palette.tint}10`, borderColor: palette.tint }]}
                  >
                    {settingLocation ? (
                      <ActivityIndicator size="small" color={palette.tint} />
                    ) : (
                      <>
                        <View style={[styles.setLocationIcon, { backgroundColor: `${palette.tint}15` }]}>
                          <FontAwesome name="map-marker" size={16} color={palette.tint} />
                        </View>
                        <View style={styles.setLocationText}>
                          <Text style={[styles.setLocationTitle, { color: palette.tint }]}>
                            Set current location as home
                          </Text>
                          <Text style={[styles.setLocationHint, { color: palette.muted }]}>
                            Tap while at home to save your location
                          </Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Detection Radius Section */}
              {preferences.homeLocation && (
                <>
                  <View style={[styles.divider, { backgroundColor: palette.border }]} />

                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: palette.muted }]}>Detection Radius</Text>
                    <Text style={[styles.radiusHint, { color: palette.muted }]}>
                      Walks starting within this distance from home will be detected
                    </Text>
                    <View style={styles.radiusOptions}>
                      {RADIUS_PRESETS.map((preset) => {
                        const isSelected = preferences.homeRadiusMeters === preset.value;
                        return (
                          <Pressable
                            key={preset.value}
                            onPress={() => handleRadiusChange(preset.value)}
                            disabled={saving}
                            style={[
                              styles.radiusChip,
                              {
                                backgroundColor: isSelected ? `${palette.tint}15` : 'transparent',
                                borderColor: isSelected ? palette.tint : palette.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.radiusChipText,
                                { color: isSelected ? palette.tint : palette.text },
                              ]}
                            >
                              {preset.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </>
          )}

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: `${Colors.brand.gold}08`, borderColor: Colors.brand.gold }]}>
            <FontAwesome name="lightbulb-o" size={14} color={Colors.brand.gold} />
            <Text style={[styles.infoText, { color: palette.muted }]}>
              {preferences.mode === 'near_home'
                ? 'Perfect for dog owners who walk without their dog elsewhere. Only walks starting near your home will be detected.'
                : preferences.mode === 'disabled'
                ? 'Auto-detection is off. You can still manually track walks using the Start button.'
                : 'All your walks will be automatically detected, regardless of location.'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  loadingText: {
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 13,
  },
  content: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeList: {
    gap: 8,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    flex: 1,
    gap: 2,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeDescription: {
    fontSize: 12,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
  },
  homeLocationSet: {
    gap: 10,
  },
  homeLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  homeLocationText: {
    fontSize: 13,
    fontWeight: '600',
  },
  homeLocationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  updateButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  setLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  setLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setLocationText: {
    flex: 1,
    gap: 2,
  },
  setLocationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  setLocationHint: {
    fontSize: 12,
  },
  radiusHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  radiusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  radiusChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
