import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraType } from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest, apiUpload } from '@/lib/api/client';
import { captureWithFallback } from '@/lib/media/imagePicker';
import type { ScooperDailyCheckRewards, ScooperDailyCheckStatus } from '@/lib/api/types';
import { getJson } from '@/lib/storage';

const DAILY_ROUTE_SNAPSHOT_KEY = 'insightscoop_scooper_daily_route';

type DailyRouteSnapshot = {
  dayKey: string;
  hasVisits: boolean;
  visitCount?: number;
  hasHaulAway?: boolean;
};

const localDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const BASE_CHECKLIST_ITEMS = [
  {
    key: 'uniform',
    label: 'Uniform or badge',
    description: 'Hat, hoodie/shirt, or branded badge visible in the selfie.',
    fallback: 'Grab your uniform and badge before leaving the hub. If you are missing any piece, restock now or contact Dispatch.',
  },
  {
    key: 'scooperKit',
    label: 'Scooper + bucket/bin',
    description: 'Standard scooper head with bucket or approved backup container.',
    fallback: 'Pick up an approved scooper kit before you start. If you need a backup bucket or liner, restock at the hub.',
  },
  {
    key: 'mount',
    label: 'Phone mount secured',
    description: 'Clamp tightened and aimed at the bucket.',
    fallback: 'Secure the mount or swap to a backup clamp. Do not start routes without a stable mount.',
  },
  {
    key: 'remote',
    label: 'Bluetooth remote paired',
    description: 'Remote paired or volume button ready for captures.',
    fallback: 'Pair the remote or confirm the phone volume button works before you leave.',
  },
  {
    key: 'glovesReady',
    label: 'Fresh gloves + PPE stocked',
    description: 'Disposable gloves ready for every yard.',
    fallback: 'Restock gloves and PPE before heading out. If supplies are low, restock now.',
  },
  {
    key: 'sanitizer',
    label: 'Kennel-grade sanitizer + sprayer',
    description: 'Approved disinfectant and sprayer ready for between-stop cleaning.',
    fallback: 'Refill sanitizer or grab a backup sprayer before you begin.',
  },
  {
    key: 'deodorizer',
    label: 'Pet-safe deodorizer',
    description: 'Enzyme deodorizer loaded per route notes.',
    fallback: "Refill deodorizer if required on today's route notes.",
  },
  {
    key: 'deodorizerSprayer',
    label: 'Dedicated deodorizer sprayer',
    description: 'Separate sprayer dedicated to deodorizer.',
    fallback: 'Use the dedicated deodorizer sprayer or swap to a clean backup.',
  },
  {
    key: 'bags',
    label: 'Liners & disposal bags',
    description: 'Fresh liners and spare bags staged with you.',
    fallback: 'Restock liners and disposal bags before you start your route.',
  },
] as const;

const HAUL_AWAY_ITEM = {
  key: 'haulAwayContainer',
  label: 'Haul-away container',
  description: 'Portable container lined and ready for haul-away stops.',
  fallback: 'Load or restock the haul-away container before you start your route.',
} as const;

type ChecklistKey = (typeof BASE_CHECKLIST_ITEMS)[number]['key'] | typeof HAUL_AWAY_ITEM.key;
type ChecklistItem = (typeof BASE_CHECKLIST_ITEMS)[number] | typeof HAUL_AWAY_ITEM;

const CHECKLIST_ICONS: Record<ChecklistKey, string> = {
  uniform: 'id-badge',
  scooperKit: 'trash',
  mount: 'mobile',
  remote: 'bluetooth',
  glovesReady: 'hand-paper-o',
  sanitizer: 'tint',
  deodorizer: 'leaf',
  deodorizerSprayer: 'shower',
  bags: 'shopping-bag',
  haulAwayContainer: 'cube',
};

const buildChecklistDefaults = (items: ChecklistItem[]) =>
  items.reduce(
    (acc, item) => {
      acc[item.key] = false;
      return acc;
    },
    {} as Record<ChecklistKey, boolean>,
  );

const mergeChecklistState = (
  prev: Record<string, boolean>,
  items: ChecklistItem[],
): Record<ChecklistKey, boolean> => {
  const next = buildChecklistDefaults(items);
  items.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(prev, item.key)) {
      next[item.key] = prev[item.key];
    }
  });
  return next;
};

type UploadAsset = {
  uri: string;
  name: string;
  type: string;
};

type ImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function resolveAsset(asset: ImageAsset): UploadAsset {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `daily-check-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  };
}

export default function DailyCheckScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [photoAsset, setPhotoAsset] = useState<UploadAsset | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasHaulAway, setHasHaulAway] = useState(false);
  const checklistItems = useMemo(() => {
    const items: ChecklistItem[] = [...BASE_CHECKLIST_ITEMS];
    if (hasHaulAway) {
      const bagsIndex = items.findIndex((item) => item.key === 'bags');
      const insertAt = bagsIndex >= 0 ? bagsIndex + 1 : items.length;
      items.splice(insertAt, 0, HAUL_AWAY_ITEM);
    }
    return items;
  }, [hasHaulAway]);
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>(
    buildChecklistDefaults(checklistItems),
  );
  const [missingFlags, setMissingFlags] = useState<Record<ChecklistKey, boolean>>(
    buildChecklistDefaults(checklistItems),
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardContext, setRewardContext] = useState<ScooperDailyCheckRewards | null>(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [hasTodayVisits, setHasTodayVisits] = useState<boolean | null>(null);
  const [prepCheckEnabled, setPrepCheckEnabled] = useState(false);

  useEffect(() => {
    setChecklist((prev) => mergeChecklistState(prev, checklistItems));
    setMissingFlags((prev) => mergeChecklistState(prev, checklistItems));
    setCurrentStep((prev) => Math.min(prev, Math.max(0, checklistItems.length - 1)));
  }, [checklistItems]);

  const checklistComplete = useMemo(
    () => Object.values(checklist).every(Boolean),
    [checklist],
  );
  const completedCount = useMemo(
    () => Object.values(checklist).filter(Boolean).length,
    [checklist],
  );
  const totalSteps = checklistItems.length;
  const currentItem = checklistItems[Math.min(currentStep, totalSteps - 1)];
  const currentMissing = currentItem ? missingFlags[currentItem.key] : false;
  const progressPercent = totalSteps
    ? Math.min(100, Math.round((completedCount / totalSteps) * 100))
    : 0;
  const isOffDay = hasTodayVisits === false;
  const showChecklist = !isOffDay || prepCheckEnabled;
  const requiresSelfie = hasTodayVisits !== false;

  useEffect(() => {
    if (!session?.token) return;
    let mounted = true;
    setRewardLoading(true);
    apiRequest<ScooperDailyCheckStatus>('/api/field-tech/gear-check', {
      token: session.token,
    })
      .then((data) => {
        if (!mounted) return;
        setRewardContext(data?.rewards ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setRewardContext(null);
      })
      .finally(() => {
        if (mounted) setRewardLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [session?.token]);

  useEffect(() => {
    let mounted = true;
    const loadSnapshot = async () => {
      const snapshot = await getJson<DailyRouteSnapshot>(DAILY_ROUTE_SNAPSHOT_KEY);
      if (!mounted) return;
      const todayKey = localDayKey();
      if (snapshot && snapshot.dayKey === todayKey) {
        setHasTodayVisits(snapshot.hasVisits);
        setHasHaulAway(Boolean(snapshot.hasHaulAway));
        if (!snapshot.hasVisits) {
          setPrepCheckEnabled(false);
        }
      } else {
        setHasTodayVisits(null);
        setHasHaulAway(false);
      }
    };
    loadSnapshot();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCapture = async () => {
    setError(null);
    const assetResult = await captureWithFallback({
      kind: 'photo',
      quality: 0.85,
      cameraType: CameraType.front,
    });
    if (!assetResult) return;
    const asset = resolveAsset(assetResult);
    setPhotoAsset(asset);
    setPhotoPreview(asset.uri);
  };

  const handleRetake = () => {
    setPhotoAsset(null);
    setPhotoPreview(null);
  };

  const handleConfirmReady = () => {
    if (!currentItem) return;
    setChecklist((prev) => ({ ...prev, [currentItem.key]: true }));
    setMissingFlags((prev) => ({ ...prev, [currentItem.key]: false }));
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleMissing = () => {
    if (!currentItem) return;
    setMissingFlags((prev) => ({ ...prev, [currentItem.key]: true }));
  };

  const handleRestocked = () => {
    handleConfirmReady();
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleEditChecklist = () => {
    setCurrentStep(0);
  };

  const handleSubmit = async () => {
    if (!session?.token) return;
    if (isOffDay && !prepCheckEnabled) {
      router.replace('/(app)/(scooper)');
      return;
    }
    if (requiresSelfie && !photoAsset) {
      setError('Capture your check-in selfie first.');
      return;
    }
    if (showChecklist && !checklistComplete) {
      setError('Confirm every checklist item before submitting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      if (requiresSelfie && photoAsset) {
        formData.append('file', {
          uri: photoAsset.uri,
          name: photoAsset.name,
          type: photoAsset.type,
        } as unknown as Blob);
      } else {
        formData.append('skipSelfie', 'true');
      }
      formData.append('checklist', JSON.stringify(checklist));
      const response = await apiUpload<ScooperDailyCheckStatus>('/api/field-tech/gear-check', {
        token: session.token,
        body: formData,
      });
      if (response?.rewards) {
        setRewardContext(response.rewards);
      }
      router.replace('/(app)/(scooper)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit check-in.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle = colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;

  return (
    <Screen padded={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={14} color={palette.tint} />
            <Text style={[styles.backText, { color: palette.tint }]}>Jobs</Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>Daily Check-in</Text>
        </View>

        {/* Progress Hero */}
        <View style={[styles.heroCard, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
          <View style={styles.heroContent}>
            <View style={styles.heroLeft}>
              <Text style={[styles.heroKicker, { color: palette.muted }]}>
                {isOffDay ? 'Optional today' : 'Required'}
              </Text>
              <Text style={[styles.heroTitle, { color: palette.text }]}>
                {checklistComplete ? 'Checklist complete' : `${completedCount} of ${totalSteps} ready`}
              </Text>
              {rewardContext && (!isOffDay || prepCheckEnabled) ? (
                <View style={[styles.pointsChip, { backgroundColor: `${Colors.brand.mint}15` }]}>
                  <FontAwesome name="star" size={12} color={Colors.brand.mint} />
                  <Text style={[styles.pointsChipText, { color: Colors.brand.mint }]}>
                    +{rewardContext.pointsPreview.totalPoints} pts
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.progressCircle, { borderColor: checklistComplete ? Colors.brand.mint : palette.border }]}>
              <Text style={[styles.progressCircleText, { color: checklistComplete ? Colors.brand.mint : palette.text }]}>
                {progressPercent}%
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        {rewardContext ? (
          <View style={styles.statsRow}>
            <Pressable
              onPress={() => router.push('/(app)/(scooper)/rewards')}
              style={({ pressed }) => [
                styles.statCard,
                { backgroundColor: palette.card, borderColor: cardBorder },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="star" size={14} color={Colors.brand.gold} />
              </View>
              <Text style={[styles.statValue, { color: palette.text }]}>
                {rewardContext.pointsBalance}
              </Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Points</Text>
            </Pressable>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <View style={[styles.statIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
                <FontAwesome name="fire" size={14} color={Colors.brand.mint} />
              </View>
              <Text style={[styles.statValue, { color: Colors.brand.mint }]}>
                {rewardContext.streakIfSubmit}
              </Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Streak</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <View style={[styles.statIcon, { backgroundColor: `${palette.tint}15` }]}>
                <FontAwesome name="plus" size={14} color={palette.tint} />
              </View>
              <Text style={[styles.statValue, { color: palette.tint }]}>
                +{rewardContext.pointsPreview.totalPoints}
              </Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Today</Text>
            </View>
          </View>
        ) : null}

        {isOffDay && !prepCheckEnabled ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>No routes today</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              You&apos;re off the checklist unless you want to run a prep check and lock in your streak.
            </Text>
            <View style={styles.rowWrap}>
              <Button
                title="Run prep check"
                onPress={() => setPrepCheckEnabled(true)}
              />
              <Button
                title="Back to dashboard"
                variant="secondary"
                onPress={() => router.replace('/(app)/(scooper)')}
              />
            </View>
          </View>
        ) : null}

        {showChecklist ? (
          <View style={[styles.card, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
            <View style={styles.checklistHeader}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Gear checklist</Text>
              <View style={[styles.checklistBadge, { backgroundColor: `${palette.tint}15` }]}>
                <Text style={[styles.checklistBadgeText, { color: palette.tint }]}>
                  {completedCount}/{totalSteps}
                </Text>
              </View>
            </View>

            {/* Mini progress dots */}
            <View style={styles.progressDots}>
              {checklistItems.map((item, idx) => (
                <View
                  key={item.key}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: checklist[item.key]
                        ? Colors.brand.mint
                        : idx === currentStep
                          ? palette.tint
                          : palette.border,
                    },
                  ]}
                />
              ))}
            </View>

            {currentStep >= totalSteps ? (
              <View style={[styles.stepCard, { backgroundColor: `${Colors.brand.mint}10`, borderColor: Colors.brand.mint }]}>
                <View style={styles.stepHeaderRow}>
                  <View style={[styles.stepIcon, { backgroundColor: `${Colors.brand.mint}20` }]}>
                    <FontAwesome name="check" size={18} color={Colors.brand.mint} />
                  </View>
                  <View style={styles.stepHeaderText}>
                    <Text style={[styles.stepTitle, { color: palette.text }]}>All set</Text>
                    <Text style={[styles.checkDescription, { color: palette.muted }]}>
                      You're ready for your routes
                    </Text>
                  </View>
                </View>
                <Pressable onPress={handleEditChecklist} style={styles.editLink}>
                  <FontAwesome name="pencil" size={12} color={palette.tint} />
                  <Text style={[styles.editLinkText, { color: palette.tint }]}>Review checklist</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.stepCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <View style={styles.stepHeaderRow}>
                  <View style={[styles.stepIcon, { backgroundColor: `${palette.tint}15` }]}>
                    <FontAwesome
                      name={CHECKLIST_ICONS[currentItem.key] as any}
                      size={18}
                      color={palette.tint}
                    />
                  </View>
                  <View style={styles.stepHeaderText}>
                    <Text style={[styles.stepLabel, { color: palette.muted }]}>
                      {currentStep + 1} of {totalSteps}
                    </Text>
                    <Text style={[styles.stepTitle, { color: palette.text }]}>{currentItem.label}</Text>
                  </View>
                </View>
                <Text style={[styles.checkDescription, { color: palette.muted }]}>
                  {currentItem.description}
                </Text>

                {currentMissing ? (
                  <View style={[styles.missingBox, { borderColor: palette.danger, backgroundColor: `${palette.danger}10` }]}>
                    <View style={styles.missingHeader}>
                      <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
                      <Text style={[styles.missingTitle, { color: palette.danger }]}>Restock needed</Text>
                    </View>
                    <Text style={[styles.missingText, { color: palette.text }]}>
                      {currentItem.fallback ?? 'Restock before continuing.'}
                    </Text>
                    <Button title="I've restocked" onPress={handleRestocked} />
                  </View>
                ) : (
                  <View style={styles.stepActions}>
                    <Button title="I have this" onPress={handleConfirmReady} />
                    <Button title="Missing" variant="secondary" onPress={handleMissing} />
                  </View>
                )}

                {currentStep > 0 ? (
                  <Pressable onPress={handleBack} style={styles.backLink}>
                    <FontAwesome name="chevron-left" size={10} color={palette.muted} />
                    <Text style={[styles.backLinkText, { color: palette.muted }]}>Previous item</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {showChecklist ? (
          requiresSelfie ? (
            <View style={[styles.card, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <View style={styles.selfieHeader}>
                <View style={[styles.selfieIcon, { backgroundColor: `${palette.tint}15` }]}>
                  <FontAwesome name="camera" size={16} color={palette.tint} />
                </View>
                <View style={styles.selfieHeaderText}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Selfie proof</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Show your uniform or badge
                  </Text>
                </View>
                {photoPreview ? (
                  <View style={[styles.selfieBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
                    <FontAwesome name="check" size={10} color={Colors.brand.mint} />
                  </View>
                ) : null}
              </View>
              {photoPreview ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: photoPreview }} style={styles.preview} />
                  <Pressable
                    onPress={handleRetake}
                    style={[styles.retakeButton, { backgroundColor: palette.card }]}
                  >
                    <FontAwesome name="refresh" size={12} color={palette.tint} />
                    <Text style={[styles.retakeText, { color: palette.tint }]}>Retake</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleCapture}
                  style={[styles.captureArea, { borderColor: palette.border, backgroundColor: palette.background }]}
                >
                  <View style={[styles.captureIconCircle, { backgroundColor: `${palette.tint}15` }]}>
                    <FontAwesome name="camera" size={24} color={palette.tint} />
                  </View>
                  <Text style={[styles.captureLabel, { color: palette.text }]}>Tap to capture</Text>
                  <Text style={[styles.captureHint, { color: palette.muted }]}>Front camera</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: `${palette.muted}10`, borderColor: palette.border }]}>
              <View style={styles.selfieHeader}>
                <View style={[styles.selfieIcon, { backgroundColor: `${palette.muted}20` }]}>
                  <FontAwesome name="camera" size={16} color={palette.muted} />
                </View>
                <View style={styles.selfieHeaderText}>
                  <Text style={[styles.cardTitle, { color: palette.muted }]}>Selfie not required</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    No stops scheduled today
                  </Text>
                </View>
              </View>
            </View>
          )
        ) : null}

        {showChecklist ? (
          <>
            <Text style={[styles.noticeText, { color: palette.muted }]}>
              Daily check-ins are reviewed for quality and compliance. Missing PPE, incomplete sanitation,
              or invalid proof can reduce payouts for the day and may result in removal from routes or the platform.
            </Text>

            {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

            <Button
              title={submitting ? 'Submitting...' : 'Submit check-in'}
              onPress={handleSubmit}
              disabled={submitting}
            />
            {!checklistComplete ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Check every item before submitting.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    paddingTop: 8,
    gap: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroLeft: {
    flex: 1,
    gap: 6,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 4,
  },
  pointsChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardShadowDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rewardBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rewardContent: {
    gap: 6,
  },
  rewardHeadline: {
    fontSize: 20,
    fontWeight: '700',
  },
  rewardMetrics: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  rewardMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rewardMetricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  selfieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selfieIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieHeaderText: {
    flex: 1,
    gap: 2,
  },
  selfieBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 14,
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retakeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  captureArea: {
    height: 160,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  captureHint: {
    fontSize: 12,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checklistBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  checklistBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeaderText: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  stepActions: {
    gap: 8,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  editLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingTop: 4,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
  missingBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  missingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  missingText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
});
