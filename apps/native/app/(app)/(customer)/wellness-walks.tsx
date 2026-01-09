import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import WalkMapView from '@/components/wellness/WalkMapView';
import WalkStatsCard from '@/components/wellness/WalkStatsCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import {
  clearPendingPassiveWalk,
  disablePassiveWalkDetection,
  enablePassiveWalkDetection,
  getPendingPassiveWalk,
  syncPassiveWalkDetection,
  type PassiveWalkPending,
} from '@/lib/wellness/passiveWalk';
import {
  useWalkTracking,
  toLatLng,
  formatDistance,
  formatDuration,
} from '@/lib/wellness/useWalkTracking';
import type { CustomerSummary, DogSummary, WellnessWalk } from '@/lib/api/types';

export default function WellnessWalksScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  // Use the extracted walk tracking hook
  const tracking = useWalkTracking();

  // API state
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [walks, setWalks] = useState<WellnessWalk[]>([]);
  const [selectedWalkId, setSelectedWalkId] = useState<string | null>(null);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Passive walk detection state
  const [passiveEnabled, setPassiveEnabled] = useState(false);
  const [pendingWalk, setPendingWalk] = useState<PassiveWalkPending | null>(null);
  const [pendingDogId, setPendingDogId] = useState<string | null>(null);
  const [passiveError, setPassiveError] = useState<string | null>(null);
  const [passiveLoading, setPassiveLoading] = useState(false);
  const [confirmingPending, setConfirmingPending] = useState(false);

  const access = summary?.wellnessAccess ?? null;
  const hasAccess = Boolean(access);
  const isPremium =
    access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO' || access?.hasActiveService;

  const selectedWalk = useMemo(
    () => walks.find((walk) => walk.id === selectedWalkId) ?? walks[0] ?? null,
    [walks, selectedWalkId],
  );

  // Convert tracking points or selected walk path to LatLng format
  const mapPoints = useMemo(() => {
    if (tracking.state !== 'idle' && tracking.points.length) {
      return tracking.points.map(toLatLng);
    }
    if (selectedWalk?.path?.length) {
      return selectedWalk.path.map((point) => ({
        latitude: point.lat,
        longitude: point.lng,
      }));
    }
    return [];
  }, [tracking.points, tracking.state, selectedWalk]);

  // Display values - show tracking values when active, otherwise selected walk
  const displayDistanceMeters =
    tracking.state === 'idle' ? selectedWalk?.distanceMeters ?? 0 : tracking.distanceMeters;
  const displayDurationSeconds =
    tracking.state === 'idle' ? selectedWalk?.durationSeconds ?? 0 : tracking.elapsedSeconds;

  const distanceLabel = formatDistance(displayDistanceMeters);
  const durationLabel = formatDuration(displayDurationSeconds);
  const paceLabel = useMemo(() => {
    if (!displayDistanceMeters || displayDistanceMeters <= 0) return '—';
    const miles = displayDistanceMeters / 1609.34;
    if (miles <= 0) return '—';
    const paceSeconds = Math.round(displayDurationSeconds / miles);
    return `${formatDuration(paceSeconds)} / mi`;
  }, [displayDistanceMeters, displayDurationSeconds]);

  const activeDogLabel = useMemo(() => {
    if (tracking.state !== 'idle') {
      return selectedDogId ? dogs.find((dog) => dog.id === selectedDogId)?.name ?? 'Dog' : 'Household';
    }
    return selectedWalk?.dogName ?? 'Household';
  }, [dogs, selectedDogId, selectedWalk, tracking.state]);

  const activeDateLabel = useMemo(() => {
    if (tracking.state !== 'idle') {
      return tracking.startedAt
        ? tracking.startedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : 'In progress';
    }
    if (!selectedWalk?.startedAt) return 'Route preview';
    return new Date(selectedWalk.startedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedWalk?.startedAt, tracking.startedAt, tracking.state]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekWalks = walks.filter((w) => new Date(w.startedAt) >= weekAgo);
    const totalDistance = thisWeekWalks.reduce((sum, w) => sum + (w.distanceMeters ?? 0), 0);
    const totalDuration = thisWeekWalks.reduce((sum, w) => sum + (w.durationSeconds ?? 0), 0);
    return {
      count: thisWeekWalks.length,
      distance: totalDistance,
      duration: totalDuration,
    };
  }, [walks]);

  // API calls
  const loadSummary = useCallback(async () => {
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

  const loadWalks = useCallback(async () => {
    if (!session?.token || !isPremium) return;
    setLoading(true);
    try {
      const data = await apiRequest<{ walks: WellnessWalk[] }>('/api/mobile/customer/walks?limit=20', {
        token: session.token,
      });
      setWalks(data.walks ?? []);
      setSelectedWalkId((prev) => prev ?? data.walks?.[0]?.id ?? null);
    } catch (err) {
      console.warn('load-walks.failed', err);
    } finally {
      setLoading(false);
    }
  }, [session?.token, isPremium]);

  const loadPassiveState = useCallback(async () => {
    const [state, pending] = await Promise.all([
      syncPassiveWalkDetection(),
      getPendingPassiveWalk(),
    ]);
    setPassiveEnabled(state?.enabled ?? false);
    setPendingWalk(pending);
    if (pending && !pendingDogId) {
      setPendingDogId(null);
    }
  }, [pendingDogId]);

  // Effects
  useEffect(() => {
    loadSummary();
    loadDogs();
  }, [loadSummary, loadDogs]);

  useFocusEffect(
    useCallback(() => {
      loadPassiveState();
    }, [loadPassiveState]),
  );

  useEffect(() => {
    if (isPremium) {
      loadWalks();
    }
  }, [isPremium, loadWalks]);

  useEffect(() => {
    if (!hasAccess) return;
    if (isPremium || !passiveEnabled) return;
    disablePassiveWalkDetection()
      .catch(() => null)
      .finally(() => setPassiveEnabled(false));
  }, [hasAccess, isPremium, passiveEnabled]);

  // Handlers
  const handleFinish = async () => {
    const result = await tracking.finish();
    if (!result || !session?.token || !tracking.startedAt) return;

    try {
      const endedAt = new Date();
      const payload = {
        dogId: selectedDogId ?? null,
        startedAt: tracking.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds: Math.max(1, tracking.elapsedSeconds),
        distanceMeters: Math.max(0, result.distance),
        path: result.points,
        metadata: {
          pointsCount: result.points.length,
          avgAccuracyMeters:
            result.points.length > 0
              ? Math.round(
                  result.points.reduce((sum, point) => sum + (point.accuracy ?? 0), 0) / result.points.length,
                )
              : null,
        },
      };
      const data = await apiRequest<{ walk: WellnessWalk }>('/api/mobile/customer/walks', {
        method: 'POST',
        token: session.token,
        body: payload,
      });
      if (data?.walk) {
        setWalks((prev) => [data.walk, ...prev]);
        setSelectedWalkId(data.walk.id);
      }
      tracking.reset();
    } catch (err) {
      // Error handled by tracking hook
    }
  };

  const handleDeleteWalk = (walk: WellnessWalk) => {
    if (!session?.token) return;
    Alert.alert('Delete walk?', 'This removes the walk from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/api/mobile/customer/walks/${walk.id}`, {
              method: 'DELETE',
              token: session.token,
            });
            setWalks((prev) => prev.filter((item) => item.id !== walk.id));
            if (selectedWalkId === walk.id) {
              setSelectedWalkId(null);
            }
          } catch (err) {
            Alert.alert('Unable to delete', err instanceof Error ? err.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const handlePassiveToggle = async (value: boolean) => {
    if (passiveLoading) return;
    setPassiveError(null);
    setPassiveLoading(true);
    try {
      if (value) {
        await enablePassiveWalkDetection();
      } else {
        await disablePassiveWalkDetection();
      }
      setPassiveEnabled(value);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to update passive walk tracking.';
      setPassiveError(message);
      setPassiveEnabled(false);
    } finally {
      setPassiveLoading(false);
    }
  };

  const handleDismissPending = async () => {
    await clearPendingPassiveWalk();
    setPendingWalk(null);
    setPendingDogId(null);
  };

  const handleConfirmPending = async () => {
    if (!session?.token || !pendingWalk) return;
    if (!pendingWalk.path || pendingWalk.path.length < 2) {
      setPassiveError('Walk route is too short to save. Please track manually.');
      return;
    }
    setConfirmingPending(true);
    setPassiveError(null);
    try {
      const payload = {
        dogId: pendingDogId ?? null,
        startedAt: pendingWalk.startedAt,
        endedAt: pendingWalk.endedAt,
        durationSeconds: pendingWalk.durationSeconds,
        distanceMeters: pendingWalk.distanceMeters,
        path: pendingWalk.path,
        metadata: {
          source: 'passive',
          averageSpeedMps: pendingWalk.averageSpeedMps,
          maxSpeedMps: pendingWalk.maxSpeedMps,
        },
      };
      const data = await apiRequest<{ walk: WellnessWalk }>('/api/mobile/customer/walks', {
        method: 'POST',
        token: session.token,
        body: payload,
      });
      if (data?.walk) {
        setWalks((prev) => [data.walk, ...prev]);
        setSelectedWalkId(data.walk.id);
      }
      await clearPendingPassiveWalk();
      setPendingWalk(null);
      setPendingDogId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to save the walk.';
      setPassiveError(message);
    } finally {
      setConfirmingPending(false);
    }
  };

  const pendingDistanceLabel = pendingWalk ? formatDistance(pendingWalk.distanceMeters) : null;
  const pendingDurationLabel = pendingWalk ? formatDuration(pendingWalk.durationSeconds) : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
            <FontAwesome name="road" size={24} color={Colors.brand.mint} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.text }]}>Walk Tracker</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              GPS distance, duration, and route history
            </Text>
          </View>
        </View>

        {!isPremium ? (
          // Premium gate
          <View style={[styles.premiumGate, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.premiumIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="star" size={28} color={Colors.brand.gold} />
            </View>
            <Text style={[styles.premiumTitle, { color: palette.text }]}>Premium Feature</Text>
            <Text style={[styles.premiumSubtitle, { color: palette.muted }]}>
              Upgrade to unlock GPS walk tracking, route history, and distance stats.
            </Text>
            <Button
              title="Upgrade to Premium"
              onPress={() => router.push('/(app)/(customer)/wellness-upgrade' as any)}
            />
          </View>
        ) : (
          <>
            {/* Weekly Summary */}
            <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.summaryHeader}>
                <FontAwesome name="calendar" size={14} color={palette.tint} />
                <Text style={[styles.summaryLabel, { color: palette.muted }]}>This week</Text>
              </View>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatValue, { color: palette.text }]}>
                    {weeklyStats.count}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: palette.muted }]}>walks</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: palette.border }]} />
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatValue, { color: palette.text }]}>
                    {formatDistance(weeklyStats.distance)}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: palette.muted }]}>distance</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: palette.border }]} />
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatValue, { color: palette.text }]}>
                    {formatDuration(weeklyStats.duration)}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: palette.muted }]}>time</Text>
                </View>
              </View>
            </View>

            {/* Pending passive walk detection */}
            {pendingWalk && (
              <View style={[styles.pendingCard, { backgroundColor: `${Colors.brand.gold}08`, borderColor: Colors.brand.gold }]}>
                <View style={styles.pendingHeader}>
                  <View style={[styles.pendingIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
                    <FontAwesome name="bell" size={18} color={Colors.brand.gold} />
                  </View>
                  <View style={styles.pendingHeaderText}>
                    <Text style={[styles.pendingTitle, { color: palette.text }]}>Walk detected</Text>
                    <Text style={[styles.pendingMeta, { color: palette.muted }]}>
                      {pendingDistanceLabel} · {pendingDurationLabel}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.pendingDescription, { color: palette.muted }]}>
                  Choose which dog went with you:
                </Text>
                <View style={styles.dogChipRow}>
                  <Pressable
                    onPress={() => setPendingDogId(null)}
                    style={[
                      styles.dogChip,
                      {
                        backgroundColor: !pendingDogId ? `${palette.tint}15` : palette.background,
                        borderColor: !pendingDogId ? palette.tint : palette.border,
                      },
                    ]}
                  >
                    <FontAwesome name="home" size={12} color={!pendingDogId ? palette.tint : palette.muted} />
                    <Text style={[styles.dogChipText, { color: !pendingDogId ? palette.tint : palette.text }]}>
                      Household
                    </Text>
                  </Pressable>
                  {dogs.map((dog) => (
                    <Pressable
                      key={dog.id}
                      onPress={() => setPendingDogId(dog.id)}
                      style={[
                        styles.dogChip,
                        {
                          backgroundColor: pendingDogId === dog.id ? `${palette.tint}15` : palette.background,
                          borderColor: pendingDogId === dog.id ? palette.tint : palette.border,
                        },
                      ]}
                    >
                      <FontAwesome name="paw" size={12} color={pendingDogId === dog.id ? palette.tint : palette.muted} />
                      <Text style={[styles.dogChipText, { color: pendingDogId === dog.id ? palette.tint : palette.text }]}>
                        {dog.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.pendingActions}>
                  <Pressable
                    onPress={handleConfirmPending}
                    disabled={confirmingPending}
                    style={[styles.confirmButton, { backgroundColor: Colors.brand.gold }]}
                  >
                    <FontAwesome name="check" size={14} color="#fff" />
                    <Text style={styles.confirmButtonText}>
                      {confirmingPending ? 'Saving...' : 'Confirm walk'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDismissPending}
                    disabled={confirmingPending}
                    style={[styles.dismissButton, { borderColor: palette.border }]}
                  >
                    <Text style={[styles.dismissButtonText, { color: palette.muted }]}>Not a walk</Text>
                  </Pressable>
                </View>
                {passiveError && (
                  <Text style={[styles.errorText, { color: palette.danger }]}>{passiveError}</Text>
                )}
              </View>
            )}

            {/* Passive walk detection toggle */}
            <Pressable
              onPress={() => handlePassiveToggle(!passiveEnabled)}
              style={[styles.passiveToggleCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={[styles.passiveIcon, { backgroundColor: passiveEnabled ? `${Colors.brand.mint}15` : `${palette.muted}15` }]}>
                <FontAwesome name="magic" size={16} color={passiveEnabled ? Colors.brand.mint : palette.muted} />
              </View>
              <View style={styles.passiveContent}>
                <Text style={[styles.passiveTitle, { color: palette.text }]}>Auto-detect walks</Text>
                <Text style={[styles.passiveDescription, { color: palette.muted }]}>
                  Detects walking pace and prompts to confirm
                </Text>
              </View>
              <View style={[styles.toggleIndicator, { backgroundColor: passiveEnabled ? Colors.brand.mint : palette.border }]}>
                <View style={[styles.toggleDot, { transform: [{ translateX: passiveEnabled ? 14 : 0 }] }]} />
              </View>
            </Pressable>
            {passiveError && !pendingWalk && (
              <Text style={[styles.errorText, { color: palette.danger }]}>{passiveError}</Text>
            )}

            {/* Walk stats and controls using extracted component */}
            <WalkStatsCard
              state={tracking.state}
              distanceLabel={distanceLabel}
              durationLabel={durationLabel}
              paceLabel={paceLabel}
              error={tracking.error}
              dogs={dogs}
              selectedDogId={selectedDogId}
              onSelectDog={setSelectedDogId}
              onStart={tracking.start}
              onPause={tracking.pause}
              onResume={tracking.resume}
              onFinish={handleFinish}
            />

            {/* Route map using extracted component */}
            <WalkMapView
              points={mapPoints}
              isTracking={tracking.state !== 'idle'}
              trackingState={tracking.state}
              distanceLabel={distanceLabel}
              durationLabel={durationLabel}
              paceLabel={paceLabel}
              dogLabel={activeDogLabel}
              dateLabel={activeDateLabel}
            />

            {/* Recent walks section */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <FontAwesome name="history" size={14} color={palette.muted} />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent walks</Text>
              </View>
              <Pressable onPress={loadWalks} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <FontAwesome name="refresh" size={14} color={palette.tint} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.loadingText, { color: palette.muted }]}>Loading walks...</Text>
              </View>
            ) : walks.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: `${palette.muted}15` }]}>
                  <FontAwesome name="road" size={24} color={palette.muted} />
                </View>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>No walks yet</Text>
                <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
                  Start tracking to build your walk history
                </Text>
              </View>
            ) : (
              <View style={styles.walksList}>
                {walks.map((walk) => {
                  const isSelected = walk.id === selectedWalk?.id;
                  const dogLabel = walk.dogName ?? 'Household';
                  const dateLabel = new Date(walk.startedAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeLabel = new Date(walk.startedAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  return (
                    <Pressable
                      key={walk.id}
                      onPress={() => setSelectedWalkId(walk.id)}
                      style={({ pressed }) => [
                        styles.walkCard,
                        {
                          backgroundColor: isSelected ? `${palette.tint}08` : palette.card,
                          borderColor: isSelected ? palette.tint : palette.border,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View style={[styles.walkIcon, { backgroundColor: isSelected ? `${palette.tint}15` : `${palette.muted}15` }]}>
                        <FontAwesome name="map-marker" size={16} color={isSelected ? palette.tint : palette.muted} />
                      </View>
                      <View style={styles.walkContent}>
                        <View style={styles.walkTopRow}>
                          <Text style={[styles.walkDate, { color: palette.text }]}>{dateLabel}</Text>
                          <Text style={[styles.walkTime, { color: palette.muted }]}>{timeLabel}</Text>
                        </View>
                        <View style={styles.walkBottomRow}>
                          <View style={styles.walkStatChip}>
                            <FontAwesome name="arrows-h" size={10} color={palette.muted} />
                            <Text style={[styles.walkStatText, { color: palette.muted }]}>
                              {formatDistance(walk.distanceMeters)}
                            </Text>
                          </View>
                          <View style={styles.walkStatChip}>
                            <FontAwesome name="clock-o" size={10} color={palette.muted} />
                            <Text style={[styles.walkStatText, { color: palette.muted }]}>
                              {formatDuration(walk.durationSeconds)}
                            </Text>
                          </View>
                          <View style={styles.walkStatChip}>
                            <FontAwesome name="paw" size={10} color={palette.muted} />
                            <Text style={[styles.walkStatText, { color: palette.muted }]}>{dogLabel}</Text>
                          </View>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteWalk(walk)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.5 }]}
                      >
                        <FontAwesome name="trash-o" size={14} color={palette.danger} />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  premiumGate: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  premiumIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  premiumSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryStatLabel: {
    fontSize: 11,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  pendingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingHeaderText: {
    flex: 1,
    gap: 2,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pendingMeta: {
    fontSize: 13,
  },
  pendingDescription: {
    fontSize: 13,
  },
  dogChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dogChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  dogChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flex: 1,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  passiveToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  passiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passiveContent: {
    flex: 1,
    gap: 2,
  },
  passiveTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  passiveDescription: {
    fontSize: 12,
  },
  toggleIndicator: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  walksList: {
    gap: 10,
  },
  walkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  walkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkContent: {
    flex: 1,
    gap: 6,
  },
  walkTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walkDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  walkTime: {
    fontSize: 12,
  },
  walkBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walkStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walkStatText: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  errorText: {
    fontSize: 12,
  },
});
