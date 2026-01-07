import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraType } from 'expo-image-picker';

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

  return (
    <Screen padded={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: palette.text }]}>Daily check-in</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          {isOffDay
            ? 'No stops today. Check-ins are optional unless you want to run a prep check.'
            : 'Confirm your gear and take a quick selfie before starting routes.'}
        </Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.rewardHeader}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Check-in rewards</Text>
            <View style={[styles.rewardBadge, { backgroundColor: Colors.brand.mint }]}>
              <Text style={styles.rewardBadgeLabel}>Daily</Text>
            </View>
          </View>
          {rewardLoading ? (
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading rewards...</Text>
          ) : rewardContext ? (
            <View style={styles.rewardContent}>
              <Text style={[styles.rewardHeadline, { color: Colors.brand.mint }]}>
                Earn {rewardContext.pointsPreview.totalPoints} points today
              </Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                {isOffDay && !prepCheckEnabled
                  ? 'Run a prep check today to keep your streak and earn points.'
                  : `Base ${rewardContext.pointsPreview.basePoints} + streak bonus ${
                      rewardContext.pointsPreview.streakBonus
                    }${
                      rewardContext.pointsPreview.milestoneBonus > 0
                        ? ` + milestone ${rewardContext.pointsPreview.milestoneBonus}`
                        : ''
                    }`}
              </Text>
              {!isOffDay || prepCheckEnabled ? (
                <>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Redeem points for Amazon gift cards.
                  </Text>
                  <View style={styles.rewardMetrics}>
                    <View style={[styles.rewardMetricCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                      <Text style={[styles.rewardMetricLabel, { color: palette.muted }]}>Streak</Text>
                      <Text style={[styles.rewardMetricValue, { color: palette.text }]}>
                        {rewardContext.streakIfSubmit} days
                      </Text>
                    </View>
                    <View style={[styles.rewardMetricCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                      <Text style={[styles.rewardMetricLabel, { color: palette.muted }]}>Total points</Text>
                      <Text style={[styles.rewardMetricValue, { color: palette.text }]}>
                        {rewardContext.pointsBalance}
                      </Text>
                    </View>
                  </View>
                  {rewardContext.nextMilestone ? (
                    <Text style={[styles.cardBody, { color: palette.muted }]}>
                      Next bonus at {rewardContext.nextMilestone.days}-day streak (
                      +{rewardContext.nextMilestone.bonusPoints}).
                    </Text>
                  ) : null}
                  {rewardContext.lastPointsAwarded !== null ? (
                    <Text style={[styles.cardBody, { color: palette.muted }]}>
                      Last check-in earned {rewardContext.lastPointsAwarded} points.
                    </Text>
                  ) : null}
                  <Button
                    title="View rewards"
                    variant="secondary"
                    onPress={() => router.push('/(app)/(scooper)/rewards')}
                  />
                </>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Rewards appear after your first check-in.
            </Text>
          )}
        </View>

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
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.checklistHeader}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Gear checklist</Text>
            <Text style={[styles.checklistCount, { color: palette.muted }]}>
              {completedCount}/{totalSteps} ready
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: palette.tint }]} />
          </View>

          {currentStep >= totalSteps ? (
            <View style={[styles.stepCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.stepTitle, { color: palette.text }]}>
                Checklist complete
              </Text>
              <Text style={[styles.checkDescription, { color: palette.muted }]}>
                Nice work. You're ready for your routes.
              </Text>
              <Button title="Edit checklist" variant="ghost" onPress={handleEditChecklist} />
            </View>
          ) : (
            <View style={[styles.stepCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.stepLabel, { color: palette.muted }]}>
                Step {currentStep + 1} of {totalSteps}
              </Text>
              <Text style={[styles.stepTitle, { color: palette.text }]}>{currentItem.label}</Text>
              <Text style={[styles.checkDescription, { color: palette.muted }]}>
                {currentItem.description}
              </Text>

              {currentMissing ? (
                <View style={[styles.missingBox, { borderColor: palette.border, backgroundColor: palette.card }]}>
                  <Text style={[styles.missingTitle, { color: palette.text }]}>Restock needed</Text>
                  <Text style={[styles.missingText, { color: palette.text }]}>
                    {currentItem.fallback ?? 'Restock before continuing.'}
                  </Text>
                  <Button title="I've restocked" onPress={handleRestocked} />
                </View>
              ) : (
                <View style={styles.stepActions}>
                  <Button title="I have this" onPress={handleConfirmReady} />
                  <Button title="I don't have this" variant="secondary" onPress={handleMissing} />
                </View>
              )}

              {currentStep > 0 ? (
                <View style={styles.stepFooter}>
                  <Button title="Back" variant="ghost" onPress={handleBack} />
                </View>
              ) : null}
            </View>
          )}
        </View>
        ) : null}

        {showChecklist ? (
          requiresSelfie ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Selfie proof</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Show your InsightScoop hat/hoodie/shirt or branded badge in the selfie so customers can identify you.
            </Text>
            {photoPreview ? (
              <Image source={{ uri: photoPreview }} style={styles.preview} />
            ) : (
              <View style={[styles.previewPlaceholder, { borderColor: palette.border }]}>
                <Text style={[styles.previewLabel, { color: palette.muted }]}>No selfie yet</Text>
              </View>
            )}
            <View style={styles.rowWrap}>
              <Button
                title={photoPreview ? 'Retake selfie' : 'Capture selfie'}
                onPress={photoPreview ? handleRetake : handleCapture}
                variant="primary"
                style={styles.captureButton}
              />
            </View>
          </View>
          ) : (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Selfie not required</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              There are no stops today, so a selfie isn&apos;t required. If new visits are added later,
              you&apos;ll need to check in again with a selfie.
            </Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
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
    marginBottom: 16,
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
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  previewPlaceholder: {
    height: 220,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 12,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  captureButton: {
    flex: 1,
  },
  checkDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  checklistCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  stepCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  stepLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepActions: {
    gap: 8,
  },
  stepFooter: {
    alignItems: 'flex-start',
  },
  missingBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  missingTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  missingText: {
    fontSize: 12,
    lineHeight: 16,
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
