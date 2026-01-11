import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Location from 'expo-location';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest, apiUpload, ApiError } from '@/lib/api/client';
import type { CustomerSummary, DogSummary, WellnessCapture } from '@/lib/api/types';
import { captureWithFallback } from '@/lib/media/imagePicker';
import CaptureResultCard from '@/components/wellness/CaptureResultCard';
import ScanProgress from '@/components/wellness/ScanProgress';
import IndicatorPill from '@/components/wellness/IndicatorPill';
import PoopMapPlacementModal from '@/components/maps/PoopMapPlacementModal';
import { LOW_CONFIDENCE_THRESHOLD_METERS } from '@/lib/maps/poopMap';

type CaptureStatus = 'idle' | 'capturing' | 'uploading';

type ParsedAnalysis = {
  color?: string;
  consistency?: string;
  content?: string;
  hydrationScore?: number;
  firmnessScale?: number;
  indicator?: 'watch' | 'monitor' | 'vet_now';
  summary?: string;
  whatThisCouldMean?: string;
  tipsTonight?: string[];
  redFlags?: string[];
};

const parseAnalysis = (result: Record<string, unknown> | null): ParsedAnalysis | null => {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  const indicatorRaw = typeof record.indicator === 'string' ? record.indicator : undefined;
  const indicator =
    indicatorRaw === 'watch' || indicatorRaw === 'monitor' || indicatorRaw === 'vet_now'
      ? indicatorRaw
      : undefined;
  return {
    color: typeof record.color === 'string' ? record.color : undefined,
    consistency: typeof record.consistency === 'string' ? record.consistency : undefined,
    content: typeof record.content === 'string' ? record.content : undefined,
    hydrationScore:
      typeof record.hydration_score === 'number' ? record.hydration_score : undefined,
    firmnessScale:
      typeof record.firmness_scale === 'number' ? record.firmness_scale : undefined,
    indicator,
    summary: typeof record.summary === 'string' ? record.summary : undefined,
    whatThisCouldMean:
      typeof record.what_this_could_mean === 'string' ? record.what_this_could_mean : undefined,
    tipsTonight: Array.isArray(record.tips_tonight)
      ? record.tips_tonight.filter((tip) => typeof tip === 'string')
      : undefined,
    redFlags: Array.isArray(record.red_flags)
      ? record.red_flags.filter((flag) => typeof flag === 'string')
      : undefined,
  };
};

export default function OwnerCaptureScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [notSure, setNotSure] = useState(false);
  const [asset, setAsset] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [captures, setCaptures] = useState<WellnessCapture[]>([]);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementTarget, setPlacementTarget] = useState<{
    id: string;
    lat: number;
    lng: number;
    accuracy?: number | null;
  } | null>(null);

  const access = summary?.wellnessAccess ?? null;
  const scansRemaining = access
    ? Math.max(0, access.limits.scansPerMonth - access.usage.scansCount)
    : null;
  const isPremium = Boolean(
    access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO' || access?.hasActiveService
  );
  const multiDogLocked = access?.maxDogs === 1 && dogs.length > 1;

  const loadDogs = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
        token: session.token,
      });
      setDogs(data.dogs ?? []);
    } catch (err) {
      console.warn('load-dogs.failed', err);
    }
  }, [session?.token]);

  const loadCaptures = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ captures: WellnessCapture[] }>(
        '/api/mobile/customer/wellness-captures?limit=8',
        { token: session.token },
      );
      setCaptures(data.captures ?? []);
    } catch (err) {
      console.warn('load-captures.failed', err);
    }
  }, [selectedCaptureId, session?.token]);

  const loadAccess = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
        token: session.token,
      });
      setSummary(data);
    } catch (err) {
      console.warn('load-summary.failed', err);
    }
  }, [session?.token]);

  useEffect(() => {
    loadDogs();
    loadCaptures();
    loadAccess();
  }, [loadDogs, loadCaptures, loadAccess]);

  useEffect(() => {
    setSelectedCaptureId(null);
    setRecentOpen(false);
  }, []);

  useEffect(() => {
    if (multiDogLocked) {
      setSelectedDogId(null);
      setNotSure(true);
    }
  }, [multiDogLocked]);

  useEffect(() => {
    if (multiDogLocked) return;
    if (dogs.length === 1) {
      setSelectedDogId(dogs[0].id);
      setNotSure(false);
    }
  }, [dogs, multiDogLocked]);

  const selectedCapture = useMemo(() => {
    if (!captures.length || !selectedCaptureId) return null;
    return captures.find((capture) => capture.id === selectedCaptureId) ?? null;
  }, [captures, selectedCaptureId]);

  const analysis = useMemo(
    () => parseAnalysis(selectedCapture?.analysisResult ?? null),
    [selectedCapture?.analysisResult],
  );

  const handleCapture = useCallback(async () => {
    if (!session?.token) return;
    setError(null);
    setStatus('capturing');
    const result = await captureWithFallback({ kind: 'photo', source: 'camera' });
    if (!result) {
      setStatus('idle');
      setError('Camera capture was cancelled.');
      return;
    }
    setAsset({
      uri: result.uri,
      type: result.mimeType ?? 'image/jpeg',
      name: result.fileName ?? `capture-${Date.now()}.jpg`,
    });
    setSelectedCaptureId(null);
    setStatus('idle');
  }, [session?.token]);

  const handleAnalyze = useCallback(async () => {
    if (!session?.token || !asset) return;
    setStatus('uploading');
    setError(null);
    try {
      let position: Location.LocationObject | null = null;
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          const last = await Location.getLastKnownPositionAsync();
          const candidates = [current, last].filter(
            (entry): entry is Location.LocationObject => Boolean(entry?.coords),
          );
          if (candidates.length) {
            candidates.sort(
              (a, b) => (a.coords.accuracy ?? 9999) - (b.coords.accuracy ?? 9999),
            );
            position = candidates[0];
          }
        }
      } catch (locationError) {
        console.warn('capture.location.skipped', locationError);
      }

      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: asset.name ?? `capture-${Date.now()}.jpg`,
        type: asset.type ?? 'image/jpeg',
      } as any);
      const isSpecificDog = Boolean(selectedDogId) && !notSure;
      const resolvedScope = isSpecificDog ? 'DOG' : 'HOUSEHOLD';
      formData.append('scope', resolvedScope);
      if (isSpecificDog && selectedDogId) {
        formData.append('dogId', selectedDogId);
      }
      if (!isSpecificDog && dogs.length > 0) {
        formData.append('suspectedDogIds', JSON.stringify(dogs.map((dog) => dog.id)));
      }
      if (position?.coords) {
        formData.append('lat', String(position.coords.latitude));
        formData.append('lng', String(position.coords.longitude));
        if (Number.isFinite(position.coords.accuracy)) {
          formData.append('accuracy', String(position.coords.accuracy));
        }
      }

      const data = await apiUpload<{ capture: WellnessCapture }>(
        '/api/mobile/customer/wellness-captures',
        {
          token: session.token,
          body: formData,
        },
      );
      if (data.capture) {
        setCaptures((prev) => [data.capture, ...prev]);
        setSelectedCaptureId(data.capture.id);
        if (
          typeof data.capture.gpsLat === 'number' &&
          typeof data.capture.gpsLng === 'number'
        ) {
          const accuracy = data.capture.gpsAccuracy ?? null;
          if (typeof accuracy === 'number' && accuracy > LOW_CONFIDENCE_THRESHOLD_METERS) {
            setPlacementTarget({
              id: data.capture.id,
              lat: data.capture.gpsLat,
              lng: data.capture.gpsLng,
              accuracy,
            });
            setPlacementOpen(true);
          }
        }
      }
      setAsset(null);
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { error?: string } | null;
        if (details?.error === 'limit_reached') {
          setError('Free scans are used up for this month. Upgrade for unlimited scans.');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unable to analyze capture.');
      }
    } finally {
      setStatus('idle');
    }
  }, [asset, dogs, notSure, selectedDogId, session?.token]);

  const openPlacement = useCallback((capture: WellnessCapture) => {
    if (typeof capture.gpsLat !== 'number' || typeof capture.gpsLng !== 'number') {
      return;
    }
    setPlacementTarget({
      id: capture.id,
      lat: capture.gpsLat,
      lng: capture.gpsLng,
      accuracy: capture.gpsAccuracy ?? null,
    });
    setPlacementOpen(true);
  }, []);

  const handlePlacementSave = useCallback(
    async (nextLocation: { lat: number; lng: number; accuracy?: number | null }) => {
      if (!session?.token || !placementTarget) return;
      setError(null);
      try {
        const payload = {
          lat: nextLocation.lat,
          lng: nextLocation.lng,
          accuracy: 3,
          rawLat: placementTarget.lat,
          rawLng: placementTarget.lng,
          rawAccuracy: placementTarget.accuracy ?? null,
        };
        const response = await apiRequest<{ capture: WellnessCapture }>(
          `/api/mobile/customer/wellness-captures/${placementTarget.id}`,
          {
            method: 'PATCH',
            token: session.token,
            body: payload,
          },
        );
        if (response.capture) {
          setCaptures((prev) =>
            prev.map((item) => (item.id === response.capture.id ? response.capture : item)),
          );
          if (selectedCaptureId === response.capture.id) {
            setSelectedCaptureId(response.capture.id);
          }
        }
        setPlacementOpen(false);
        setPlacementTarget(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update placement.';
        setError(message);
      }
    },
    [placementTarget, selectedCaptureId, session?.token],
  );

  const isReadyToAnalyze = Boolean(asset && status === 'idle');

  const handleDeleteCapture = useCallback(
    (capture: WellnessCapture) => {
      if (!session?.token || deletingId) return;
      Alert.alert('Delete scan?', 'This removes the scan and its results.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(capture.id);
            setError(null);
            try {
              await apiRequest(`/api/mobile/customer/wellness-captures/${capture.id}`, {
                method: 'DELETE',
                token: session.token,
              });
              setCaptures((prev) => prev.filter((item) => item.id !== capture.id));
              if (selectedCaptureId === capture.id) {
                setSelectedCaptureId(null);
              }
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Unable to delete scan.';
              setError(message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [deletingId, selectedCaptureId, session?.token],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: palette.tint }]}>
          <View style={styles.heroIcon}>
            <FontAwesome name="camera" size={28} color="#fff" />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Stool Scanner</Text>
            <Text style={styles.heroSubtitle}>
              AI-powered analysis for hydration, firmness, and health indicators
            </Text>
          </View>
        </View>

        {/* Scan Progress */}
        {access ? (
          <ScanProgress
            used={access.usage.scansCount}
            limit={access.limits.scansPerMonth}
            isPremium={isPremium}
          />
        ) : null}

        {/* Dog Selector Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="paw" size={16} color={palette.tint} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Which dog?</Text>
          </View>

          <View style={styles.chipRow}>
            {dogs.map((dog) => (
              <ChoiceChip
                key={dog.id}
                label={dog.name}
                selected={!notSure && selectedDogId === dog.id}
                onPress={() => {
                  setNotSure(false);
                  setSelectedDogId(dog.id);
                }}
                disabled={multiDogLocked}
              />
            ))}
            <ChoiceChip
              label="Not sure"
              selected={notSure}
              onPress={() => {
                setNotSure(true);
                setSelectedDogId(null);
              }}
            />
          </View>

          {multiDogLocked && (
            <View style={[styles.infoBanner, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="star" size={12} color={Colors.brand.gold} />
              <Text style={[styles.infoBannerText, { color: Colors.brand.gold }]}>
                Premium unlocks per-dog tagging
              </Text>
            </View>
          )}

          {dogs.length === 0 && (
            <Pressable
              onPress={() => router.push('/(app)/(customer)/account')}
              style={[styles.addDogButton, { borderColor: palette.tint }]}
            >
              <FontAwesome name="plus" size={12} color={palette.tint} />
              <Text style={[styles.addDogText, { color: palette.tint }]}>
                Add a dog profile for personalized insights
              </Text>
            </Pressable>
          )}
        </View>

        {/* Capture Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="search" size={16} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Capture & Analyze</Text>
          </View>

          {asset ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: asset.uri }} style={styles.preview} />
              <View style={[styles.previewBadge, { backgroundColor: Colors.brand.mint }]}>
                <FontAwesome name="check" size={10} color="#FFFFFF" />
                <Text style={styles.previewBadgeText}>Ready to analyze</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.previewPlaceholder, { borderColor: palette.border }]}>
              <View style={[styles.previewIconWrap, { backgroundColor: `${palette.tint}10` }]}>
                <FontAwesome name="camera" size={32} color={palette.tint} />
              </View>
              <Text style={[styles.previewTitle, { color: palette.text }]}>Ready when you are</Text>
              <Text style={[styles.previewText, { color: palette.muted }]}>
                Tap Capture to photograph a stool sample
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <Pressable
              onPress={handleCapture}
              disabled={status === 'capturing' || status === 'uploading'}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: palette.tint, opacity: pressed ? 0.85 : 1 },
                (status === 'capturing' || status === 'uploading') && styles.actionButtonDisabled,
              ]}
            >
              <FontAwesome
                name={status === 'capturing' ? 'spinner' : 'camera'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.actionButtonTitle}>
                {status === 'capturing' ? 'Wait...' : 'Capture'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleAnalyze}
              disabled={!isReadyToAnalyze || status === 'uploading'}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: isReadyToAnalyze ? Colors.brand.mint : palette.background,
                  borderWidth: isReadyToAnalyze ? 0 : 1,
                  borderColor: palette.border,
                  opacity: pressed ? 0.85 : 1,
                },
                (!isReadyToAnalyze || status === 'uploading') && styles.actionButtonDisabled,
              ]}
            >
              <FontAwesome
                name={status === 'uploading' ? 'spinner' : 'search'}
                size={18}
                color={isReadyToAnalyze ? '#FFFFFF' : palette.muted}
              />
              <Text style={[styles.actionButtonTitle, { color: isReadyToAnalyze ? '#FFFFFF' : palette.muted }]}>
                {status === 'uploading' ? 'Scanning...' : 'Analyze'}
              </Text>
            </Pressable>
          </View>

          {status === 'uploading' && (
            <View style={[styles.statusCard, { backgroundColor: `${palette.tint}10`, borderColor: `${palette.tint}30` }]}>
              <ActivityIndicator size="small" color={palette.tint} />
              <View style={styles.statusText}>
                <Text style={[styles.statusTitle, { color: palette.text }]}>Analyzing sample</Text>
                <Text style={[styles.statusSubtitle, { color: palette.muted }]}>
                  Checking hydration, firmness, and health indicators...
                </Text>
              </View>
            </View>
          )}

          {error && (
            <View style={[styles.statusCard, { backgroundColor: `${palette.danger}10`, borderColor: `${palette.danger}30` }]}>
              <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
              <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
            </View>
          )}
        </View>

        {/* Results Card */}
        {selectedCapture && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconContainer, { backgroundColor: `${Colors.brand.coral}15` }]}>
                <FontAwesome name="heartbeat" size={16} color={Colors.brand.coral} />
              </View>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Analysis Results</Text>
            </View>
            <CaptureResultCard
              analysis={analysis}
              dogName={selectedCapture.dogId ? dogs.find(d => d.id === selectedCapture.dogId)?.name : null}
              capturedAt={selectedCapture.capturedAt}
              hasLocation={typeof selectedCapture.gpsLat === 'number' && typeof selectedCapture.gpsLng === 'number'}
              onAdjustLocation={() => openPlacement(selectedCapture)}
            />
          </View>
        )}

        {/* Recent Scans */}
        {captures.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Pressable onPress={() => setRecentOpen((prev) => !prev)} style={styles.cardHeader}>
              <View style={[styles.cardIconContainer, { backgroundColor: `${palette.muted}15` }]}>
                <FontAwesome name="history" size={16} color={palette.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Recent Scans</Text>
                <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                  {captures.length} scan{captures.length !== 1 ? 's' : ''} available
                </Text>
              </View>
              <FontAwesome
                name={recentOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={palette.muted}
              />
            </Pressable>

            {recentOpen && (
              <View style={styles.recentList}>
                {captures.slice(0, 5).map((capture) => (
                  <Pressable
                    key={capture.id}
                    onPress={() => setSelectedCaptureId(capture.id)}
                    style={[
                      styles.recentItem,
                      { borderColor: palette.border },
                      selectedCaptureId === capture.id && { borderColor: palette.tint, backgroundColor: `${palette.tint}08` },
                    ]}
                  >
                    <View style={styles.recentInfo}>
                      <Text style={[styles.recentDate, { color: palette.text }]}>
                        {new Date(capture.capturedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text style={[styles.recentScope, { color: palette.muted }]}>
                        {capture.dogId ? dogs.find(d => d.id === capture.dogId)?.name ?? 'Dog' : 'Household'}
                      </Text>
                    </View>
                    <View style={styles.recentActions}>
                      <IndicatorPill indicator={(capture.analysisResult as any)?.indicator} size="sm" />
                      <Pressable
                        onPress={() => handleDeleteCapture(capture)}
                        disabled={deletingId === capture.id}
                        hitSlop={8}
                      >
                        <FontAwesome
                          name="trash-o"
                          size={14}
                          color={deletingId === capture.id ? palette.muted : palette.danger}
                        />
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Safety Notice */}
        <View style={[styles.safetyCard, { backgroundColor: `${Colors.brand.coral}08`, borderColor: `${Colors.brand.coral}25` }]}>
          <View style={[styles.safetyIcon, { backgroundColor: `${Colors.brand.coral}15` }]}>
            <FontAwesome name="exclamation-triangle" size={14} color={Colors.brand.coral} />
          </View>
          <View style={styles.safetyContent}>
            <Text style={[styles.safetyTitle, { color: palette.text }]}>Safety Note</Text>
            <Text style={[styles.safetyText, { color: palette.muted }]}>
              This is not a diagnosis. Seek veterinary care if there is blood, black stool, repeated vomiting, severe diarrhea, or lethargy.
            </Text>
          </View>
        </View>
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
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  infoBannerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addDogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addDogText: {
    fontSize: 13,
    fontWeight: '500',
  },
  previewContainer: {
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 14,
  },
  previewBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  previewPlaceholder: {
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusSubtitle: {
    fontSize: 11,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  recentList: {
    gap: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  recentScope: {
    fontSize: 11,
  },
  recentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  safetyIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyContent: {
    flex: 1,
    gap: 4,
  },
  safetyTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  safetyText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
