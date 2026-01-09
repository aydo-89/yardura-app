import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import CheckInCard from '@/components/wellness/CheckInCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { isCustomerSetupRequired } from '@/lib/customer/setup';
import { parseDateInput } from '@/lib/dates';
import type { WellnessCheckInContext } from '@/lib/api/types';

type DogCheckInState = {
  dogId: string;
  name: string;
  noIssues: boolean;
  symptoms: string[];
  behaviorNotes: string;
  vetConfirmed: boolean;
  diagnosisLabel: string;
  diagnosisNotes: string;
  submitted: boolean;
  dirty: boolean;
  streakCount: number;
  streakIfSubmit: number;
};

const areArraysEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
};

const hasSubmissionChanges = (prev: DogCheckInState, next: DogCheckInState) => {
  return (
    prev.noIssues !== next.noIssues ||
    !areArraysEqual(prev.symptoms, next.symptoms) ||
    prev.behaviorNotes !== next.behaviorNotes ||
    prev.vetConfirmed !== next.vetConfirmed ||
    prev.diagnosisLabel !== next.diagnosisLabel ||
    prev.diagnosisNotes !== next.diagnosisNotes
  );
};

const formatWeekRange = (startIso: string, endIso: string) => {
  const start = parseDateInput(startIso);
  const end = parseDateInput(endIso);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
};

export default function CustomerCheckIn() {
  const { session } = useAuth();
  const { weekStart: weekStartParam } = useLocalSearchParams<{ weekStart?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [context, setContext] = useState<WellnessCheckInContext | null>(null);
  const [dogStates, setDogStates] = useState<DogCheckInState[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeDogId, setActiveDogId] = useState<string | null>(null);

  const flaggedSummary = context?.aiFlags ?? null;
  const flaggedDatesLabel = useMemo(() => {
    if (!flaggedSummary || flaggedSummary.flaggedDates.length === 0) return null;
    const formatted = flaggedSummary.flaggedDates
      .map((date) =>
        parseDateInput(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      )
      .filter((value) => value);
    return formatted.join(', ');
  }, [flaggedSummary]);

  const loadContext = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const query = weekStartParam
        ? `?weekStart=${encodeURIComponent(String(weekStartParam))}`
        : '';
      const data = await apiRequest<WellnessCheckInContext>(
        `/api/mobile/customer/wellness-check-in${query}`,
        { token: session.token },
      );
      setContext(data);
      const nextStates = data.dogs.map((dog) => ({
        dogId: dog.id,
        name: dog.name,
        noIssues: dog.currentWeekReport?.noIssues ?? true,
        symptoms: dog.currentWeekReport?.symptomTags ?? [],
        behaviorNotes: dog.currentWeekReport?.behaviorNotes ?? '',
        vetConfirmed: Boolean(
          !dog.currentWeekReport?.noIssues &&
            (dog.currentWeekReport?.diagnosisLabel ||
              dog.currentWeekReport?.diagnosisNotes ||
              dog.currentWeekReport?.vetProofSubmitted),
        ),
        diagnosisLabel: dog.currentWeekReport?.diagnosisLabel ?? '',
        diagnosisNotes: dog.currentWeekReport?.diagnosisNotes ?? '',
        submitted: Boolean(dog.currentWeekReport),
        dirty: false,
        streakCount: dog.streakCount,
        streakIfSubmit: dog.streakIfSubmit,
      }));
      setDogStates(nextStates);
      setActiveDogId((prev) => {
        if (prev && nextStates.some((dog) => dog.dogId === prev)) return prev;
        const firstPending = nextStates.find((dog) => !dog.submitted || dog.dirty);
        return firstPending?.dogId ?? nextStates[0]?.dogId ?? null;
      });
    } catch (err) {
      if (isCustomerSetupRequired(err)) {
        router.replace('/(app)/(customer)/setup');
        return;
      }
      const message = err instanceof Error ? err.message : 'Unable to load check-in.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token, weekStartParam]);

  useFocusEffect(
    useCallback(() => {
      loadContext();
    }, [loadContext]),
  );

  useEffect(() => {
    if (!success) return;
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    redirectTimeoutRef.current = setTimeout(() => {
      router.replace('/(app)/(customer)/wellness');
    }, 900);

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [success]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const updateDogState = (dogId: string, updates: Partial<DogCheckInState>) => {
    setSuccess(false);
    setDogStates((prev) =>
      prev.map((dog) =>
        dog.dogId === dogId
          ? (() => {
              const next = { ...dog, ...updates };
              const changed = hasSubmissionChanges(dog, next);
              return changed ? { ...next, dirty: true } : { ...next, dirty: dog.dirty };
            })()
          : dog,
      ),
    );
  };

  const setNoIssuesForDog = (dogId: string, value: boolean) => {
    if (!value) {
      updateDogState(dogId, { noIssues: false });
      return;
    }
    updateDogState(dogId, {
      noIssues: true,
      symptoms: [],
      behaviorNotes: '',
      vetConfirmed: false,
      diagnosisLabel: '',
      diagnosisNotes: '',
    });
  };

  const pendingDogs = useMemo(
    () => dogStates.filter((dog) => !dog.submitted || dog.dirty),
    [dogStates],
  );
  const completedCount = Math.max(0, dogStates.length - pendingDogs.length);
  const activeDog = useMemo(
    () => dogStates.find((dog) => dog.dogId === activeDogId) ?? dogStates[0] ?? null,
    [activeDogId, dogStates],
  );
  const activeIndex = useMemo(
    () => dogStates.findIndex((dog) => dog.dogId === activeDog?.dogId),
    [activeDog?.dogId, dogStates],
  );

  const selectDog = (dogId: string) => {
    setActiveDogId(dogId);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const submitDogs = async (dogsToSubmit: DogCheckInState[]) => {
    if (!session?.token || !context) return;
    if (dogsToSubmit.length === 0) {
      setError('No new check-ins to submit.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const sharePreference = context.shareWellnessNotes ?? true;

    try {
      for (const dog of dogsToSubmit) {
        const diagnosisLabel = dog.diagnosisLabel.trim();
        const diagnosisNotes = dog.diagnosisNotes.trim();
        const payload: Record<string, unknown> = {
          weekStart: context.weekStart,
          scope: 'DOG',
          dogId: dog.dogId,
          noIssues: dog.noIssues,
          symptomTags: dog.noIssues ? [] : dog.symptoms,
          behaviorNotes: dog.noIssues ? undefined : dog.behaviorNotes.trim() || undefined,
          consentToShare: sharePreference,
        };

        if (dog.vetConfirmed && !dog.noIssues) {
          if (diagnosisLabel) {
            payload.diagnosisLabel = diagnosisLabel;
          }
          if (diagnosisNotes) {
            payload.diagnosisNotes = diagnosisNotes;
          }
          if (diagnosisLabel || diagnosisNotes) {
            payload.diagnosisSource = 'OWNER_REPORTED';
          }
        }

        const response = await apiRequest<{ reward?: { points?: number; streakDays?: number } }>(
          '/api/mobile/customer/wellness-reports',
          {
            method: 'POST',
            body: payload,
            token: session.token,
          },
        );

      }

      setSuccess(true);
      await loadContext();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit check-ins.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => submitDogs(pendingDogs);

  return (
    <Screen>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: palette.text }]}>Weekly check-in</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          {context ? `Week of ${formatWeekRange(context.weekStart, context.weekEnd)}` : 'Loading week range...'}
        </Text>
        {weekStartParam ? (
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Editing a previous week. Updates will replace the existing check-in.
          </Text>
        ) : null}

        {success ? (
          <View
            style={[
              styles.successCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              Check-ins submitted
            </Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Your notes are now linked to this week's samples.
            </Text>
            <Button
              title="Back to Wellness"
              onPress={() => router.replace('/(app)/(customer)/wellness')}
              variant="ghost"
            />
          </View>
        ) : null}

        {flaggedSummary && flaggedSummary.flaggedVisitCount > 0 ? (
          <View
            style={[
              styles.alertCard,
              { backgroundColor: palette.card, borderColor: palette.danger },
            ]}
          >
            <Text style={[styles.alertTitle, { color: palette.text }]}>
              We noticed something unusual this week
            </Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              {flaggedSummary.flaggedVisitCount} visit
              {flaggedSummary.flaggedVisitCount === 1 ? '' : 's'} flagged by the stool scan.
            </Text>
            {flaggedDatesLabel ? (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Flagged on {flaggedDatesLabel}.
              </Text>
            ) : null}
            {flaggedSummary.flagReasons.length > 0 ? (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Reasons: {flaggedSummary.flagReasons.join(', ')}.
              </Text>
            ) : null}
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Even a quick note helps our team understand what we saw.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading check-in...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : dogStates.length === 0 ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>No pets found</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Add your dogs to unlock weekly check-ins.
            </Text>
          </View>
        ) : (
          <>
            {dogStates.length > 1 ? (
              <View style={[styles.card, styles.progressCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Weekly progress</Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  {completedCount} of {dogStates.length} dogs checked in.
                </Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Select a dog to update their check-in for this week.
                </Text>
              </View>
            ) : null}

            {dogStates.length > 1 ? (
              <View style={styles.dogSelectorSection}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>Select dog</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dogSelectorRow}
                >
                  {dogStates.map((dog) => {
                    const isActive = dog.dogId === activeDog?.dogId;
                    const isDone = dog.submitted && !dog.dirty;
                    return (
                      <Pressable
                        key={dog.dogId}
                        onPress={() => selectDog(dog.dogId)}
                        style={[
                          styles.dogTab,
                          {
                            backgroundColor: isActive ? palette.tint : palette.card,
                            borderColor: isActive ? palette.tint : palette.border,
                          },
                        ]}
                      >
                        <Text style={[styles.dogTabName, { color: isActive ? '#FFFFFF' : palette.text }]}>
                          {dog.name}
                        </Text>
                        <Text
                          style={[
                            styles.dogTabStatus,
                            { color: isActive ? 'rgba(255,255,255,0.8)' : palette.muted },
                          ]}
                        >
                          {isDone ? 'Done' : 'Needs check-in'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {activeDog ? (
              <CheckInCard
                key={activeDog.dogId}
                dogName={activeDog.name}
                noIssues={activeDog.noIssues}
                symptoms={activeDog.symptoms}
                behaviorNotes={activeDog.behaviorNotes}
                diagnosisLabel={activeDog.diagnosisLabel}
                diagnosisNotes={activeDog.diagnosisNotes}
                isSubmitted={activeDog.submitted}
                isDirty={activeDog.dirty}
                streakCount={activeDog.streakCount}
                onNoIssuesChange={(value) => setNoIssuesForDog(activeDog.dogId, value)}
                onSymptomsChange={(symptoms) => updateDogState(activeDog.dogId, { symptoms })}
                onBehaviorNotesChange={(notes) => updateDogState(activeDog.dogId, { behaviorNotes: notes })}
                onDiagnosisLabelChange={(label) => updateDogState(activeDog.dogId, { diagnosisLabel: label })}
                onDiagnosisNotesChange={(notes) => updateDogState(activeDog.dogId, { diagnosisNotes: notes })}
              />
            ) : null}
          </>
        )}

        <View style={styles.actions}>
          {dogStates.length > 1 ? (
            <View style={styles.navRow}>
              <Button
                title="Previous"
                variant="secondary"
                onPress={() => {
                  if (activeIndex <= 0) return;
                  selectDog(dogStates[activeIndex - 1].dogId);
                }}
                disabled={activeIndex <= 0}
              />
              <Button
                title={activeIndex >= dogStates.length - 1 ? 'Next' : 'Next dog'}
                variant="secondary"
                onPress={() => {
                  if (activeIndex < 0 || activeIndex >= dogStates.length - 1) return;
                  selectDog(dogStates[activeIndex + 1].dogId);
                }}
                disabled={activeIndex < 0 || activeIndex >= dogStates.length - 1}
              />
            </View>
          ) : null}
          <Button
            title={
              submitting
                ? 'Submitting...'
                : pendingDogs.length === 0
                  ? 'All check-ins submitted'
                  : `Submit ${pendingDogs.length} check-in${pendingDogs.length === 1 ? '' : 's'}`
            }
            onPress={handleSubmit}
            disabled={submitting || pendingDogs.length === 0}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  progressCard: {
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  dogSelectorSection: {
    marginBottom: 16,
    gap: 8,
  },
  dogSelectorRow: {
    gap: 10,
    paddingRight: 8,
  },
  dogTab: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    minWidth: 120,
  },
  dogTabName: {
    fontSize: 14,
    fontWeight: '700',
  },
  dogTabStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  error: {
    fontSize: 13,
    marginBottom: 12,
  },
  errorBlock: {
    marginBottom: 16,
    gap: 8,
  },
  actions: {
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  successCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  alertCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 6,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
});
