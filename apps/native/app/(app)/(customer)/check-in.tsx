import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { isCustomerSetupRequired } from '@/lib/customer/setup';
import { parseDateInput } from '@/lib/dates';
import type { WellnessCheckInContext } from '@/lib/api/types';
import { symptomOptions } from '@/lib/wellness/options';
import { assessSymptomRisk, guidanceForSymptomRisk, labelForSymptomRisk } from '@/lib/wellness/symptomRisk';

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

const PRIMARY_SYMPTOMS = new Set([
  'VOMITING',
  'LETHARGY',
  'APPETITE_LOSS',
  'THIRST_INCREASE',
  'THIRST_DECREASE',
  'ACCIDENTS',
]);

const primarySymptomOptions = symptomOptions.filter((option) => PRIMARY_SYMPTOMS.has(option.value));
const SYMPTOM_LABELS = symptomOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
const SYMPTOM_GROUPS = [
  { title: 'Digestive', values: ['VOMITING', 'ACCIDENTS'] },
  { title: 'Energy & appetite', values: ['LETHARGY', 'APPETITE_LOSS', 'APPETITE_INCREASE'] },
  { title: 'Hydration & weight', values: ['THIRST_INCREASE', 'THIRST_DECREASE', 'WEIGHT_LOSS', 'WEIGHT_GAIN'] },
  { title: 'Respiratory', values: ['COUGHING', 'SNEEZING'] },
  { title: 'Skin & behavior', values: ['ITCHING', 'SKIN_IRRITATION', 'BEHAVIOR_CHANGE'] },
  { title: 'Other', values: ['OTHER'] },
] as const;

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
  const [expandedSymptoms, setExpandedSymptoms] = useState<Record<string, boolean>>({});
  const [vetDetailsExpanded, setVetDetailsExpanded] = useState<Record<string, boolean>>({});
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
      setVetDetailsExpanded(
        nextStates.reduce<Record<string, boolean>>((acc, dog) => {
          acc[dog.dogId] = dog.vetConfirmed;
          return acc;
        }, {}),
      );
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
    setVetDetailsExpanded((prev) => ({ ...prev, [dogId]: false }));
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
  const activeRisk = useMemo(
    () => assessSymptomRisk(activeDog?.symptoms ?? []),
    [activeDog?.symptoms],
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
              <View
                key={activeDog.dogId}
                style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  How was {activeDog.name} this week?
                </Text>
                {activeDog.submitted && !activeDog.dirty ? (
                  <Text style={[styles.cardBody, { color: palette.tint }]}>
                    Submitted this week
                  </Text>
                ) : null}

                <View style={styles.rowWrap}>
                  <ChoiceChip
                    label="All good"
                    selected={activeDog.noIssues}
                    onPress={() => setNoIssuesForDog(activeDog.dogId, true)}
                  />
                  <ChoiceChip
                    label="I noticed something"
                    selected={!activeDog.noIssues}
                    onPress={() => setNoIssuesForDog(activeDog.dogId, false)}
                  />
                </View>

                {!activeDog.noIssues ? (
                  <View style={[styles.noticeCard, { borderColor: palette.border }]}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>
                      What did you notice?
                    </Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Start with a few quick picks, then add a note if needed.
                    </Text>

                    <Text style={[styles.sectionLabel, { color: palette.muted }]}>Common symptoms</Text>
                    <View style={styles.rowWrap}>
                      {primarySymptomOptions.map((option) => (
                        <ChoiceChip
                          key={option.value}
                          label={option.label}
                          selected={activeDog.symptoms.includes(option.value)}
                          onPress={() => {
                            const next = activeDog.symptoms.includes(option.value)
                              ? activeDog.symptoms.filter((item) => item !== option.value)
                              : [...activeDog.symptoms, option.value];
                            updateDogState(activeDog.dogId, { symptoms: next });
                          }}
                        />
                      ))}
                    </View>

                    <Pressable
                      onPress={() =>
                        setExpandedSymptoms((prev) => ({
                          ...prev,
                          [activeDog.dogId]: !prev[activeDog.dogId],
                        }))
                      }
                    >
                      <Text style={[styles.expandLink, { color: palette.tint }]}>
                        {expandedSymptoms[activeDog.dogId] ? 'Hide full list' : 'See more symptoms'}
                      </Text>
                    </Pressable>

                    {expandedSymptoms[activeDog.dogId] ? (
                      <View style={styles.symptomGroupStack}>
                        <Text style={[styles.sectionLabel, { color: palette.muted }]}>
                          More symptoms by category
                        </Text>
                        {SYMPTOM_GROUPS.filter((group) =>
                          group.values.some((value) => !PRIMARY_SYMPTOMS.has(value)),
                        ).map((group) => (
                          <View key={group.title} style={styles.symptomGroup}>
                            <Text style={[styles.symptomGroupTitle, { color: palette.muted }]}>
                              {group.title}
                            </Text>
                            <View style={styles.rowWrap}>
                              {group.values.map((value) => {
                                if (PRIMARY_SYMPTOMS.has(value)) return null;
                                const label = SYMPTOM_LABELS[value] ?? value;
                                const selected = activeDog.symptoms.includes(value);
                                return (
                                  <ChoiceChip
                                    key={value}
                                    label={label}
                                    selected={selected}
                                    onPress={() => {
                                      const next = selected
                                        ? activeDog.symptoms.filter((item) => item !== value)
                                        : [...activeDog.symptoms, value];
                                      updateDogState(activeDog.dogId, { symptoms: next });
                                    }}
                                  />
                                );
                              })}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {activeDog.symptoms.length > 0 ? (
                      <View
                        style={[
                          styles.riskCard,
                          {
                            borderColor:
                              activeRisk.level === 'vet_now'
                                ? palette.danger
                                : Colors.brand.gold,
                            backgroundColor:
                              activeRisk.level === 'vet_now'
                                ? 'rgba(225, 29, 72, 0.08)'
                                : 'rgba(255, 194, 77, 0.12)',
                          },
                        ]}
                      >
                        <Text style={[styles.riskTitle, { color: palette.text }]}>
                          {labelForSymptomRisk(activeRisk.level)}
                        </Text>
                        <Text style={[styles.helperText, { color: palette.muted }]}>
                          {guidanceForSymptomRisk(activeRisk.level)}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={[styles.inputLabel, { color: palette.text }]}>Notes (optional)</Text>
                    <TextInput
                      placeholder="Add details, diet changes, or behavior shifts"
                      placeholderTextColor={palette.muted}
                      value={activeDog.behaviorNotes}
                      onChangeText={(value) => updateDogState(activeDog.dogId, { behaviorNotes: value })}
                      style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                      multiline
                    />

                    <Pressable
                      onPress={() => {
                        const next = !vetDetailsExpanded[activeDog.dogId];
                        setVetDetailsExpanded((prev) => ({ ...prev, [activeDog.dogId]: next }));
                        updateDogState(activeDog.dogId, {
                          vetConfirmed: next,
                          ...(next
                            ? {}
                            : {
                                diagnosisLabel: '',
                                diagnosisNotes: '',
                              }),
                        });
                      }}
                    >
                      <Text style={[styles.expandLink, { color: palette.tint }]}>
                        {vetDetailsExpanded[activeDog.dogId]
                          ? 'Remove vet visit details'
                          : 'Add vet visit details'}
                      </Text>
                    </Pressable>
                    {vetDetailsExpanded[activeDog.dogId] ? (
                      <View style={styles.stack}>
                        <Text style={[styles.inputLabel, { color: palette.text }]}>
                          Diagnosis (optional)
                        </Text>
                        <TextInput
                          placeholder="Diagnosis or condition name"
                          placeholderTextColor={palette.muted}
                          value={activeDog.diagnosisLabel}
                          onChangeText={(value) => updateDogState(activeDog.dogId, { diagnosisLabel: value })}
                          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                        />
                        <Text style={[styles.inputLabel, { color: palette.text }]}>
                          Vet notes (optional)
                        </Text>
                        <TextInput
                          placeholder="Optional notes from the visit"
                          placeholderTextColor={palette.muted}
                          value={activeDog.diagnosisNotes}
                          onChangeText={(value) => updateDogState(activeDog.dogId, { diagnosisNotes: value })}
                          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
                          multiline
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}

              </View>
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
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
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
  helperText: {
    fontSize: 12,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  symptomGroupStack: {
    gap: 12,
  },
  symptomGroup: {
    gap: 8,
  },
  symptomGroupTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  expandLink: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 6,
  },
  stack: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  riskCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  riskTitle: {
    fontSize: 13,
    fontWeight: '700',
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
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
