import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest, apiUpload } from '@/lib/api/client';
import type { CustomerSummary, CustomerServicePlan, DogSummary, DogWeightEntry } from '@/lib/api/types';
import { captureWithFallback } from '@/lib/media/imagePicker';

type DogDraft = {
  name: string;
  breed: string;
  age: string;
  weight: string;
  allergies: string;
  medications: string;
  dietNotes: string;
  vetName: string;
  vetPhone: string;
  vetClinic: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insurancePhone: string;
};

type WeightDraft = {
  weight: string;
  date: string;
  notes: string;
};

const toDrafts = (dogs: DogSummary[]): Record<string, DogDraft> =>
  dogs.reduce((acc, dog) => {
    acc[dog.id] = {
      name: dog.name ?? '',
      breed: dog.breed ?? '',
      age: typeof dog.age === 'number' ? String(dog.age) : '',
      weight: typeof dog.weight === 'number' ? String(dog.weight) : '',
      allergies: dog.allergies ?? '',
      medications: dog.medications ?? '',
      dietNotes: dog.dietNotes ?? '',
      vetName: dog.vetName ?? '',
      vetPhone: dog.vetPhone ?? '',
      vetClinic: dog.vetClinic ?? '',
      insuranceProvider: dog.insuranceProvider ?? '',
      insurancePolicyNumber: dog.insurancePolicyNumber ?? '',
      insurancePhone: dog.insurancePhone ?? '',
    };
    return acc;
  }, {} as Record<string, DogDraft>);

const toWeightDrafts = (dogs: DogSummary[]): Record<string, WeightDraft> =>
  dogs.reduce((acc, dog) => {
    acc[dog.id] = { weight: '', date: '', notes: '' };
    return acc;
  }, {} as Record<string, WeightDraft>);

const DATE_SLASH_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DATE_DASH_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateInput = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  const slash = DATE_SLASH_RE.exec(trimmed);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3]);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const dash = DATE_DASH_RE.exec(trimmed);
  if (dash) {
    const year = Number(dash[1]);
    const month = Number(dash[2]);
    const day = Number(dash[3]);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(trimmed);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0, 0);
};

const formatDateInput = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const toDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const getCalendarDays = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 12, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12, 0, 0, 0);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  const last = new Date(end);
  last.setDate(last.getDate() + (6 - last.getDay()));
  const days: Date[] = [];
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const weekLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const buildTrendBars = (entries: DogWeightEntry[]) => {
  const recent = [...entries]
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .slice(-6);
  if (recent.length === 0) return [];
  const weights = recent.map((entry) => entry.weightLbs);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  return recent.map((entry) => ({
    id: entry.id,
    height: 10 + ((entry.weightLbs - min) / range) * 28,
    label: entry.weightLbs.toFixed(1),
  }));
};

export default function WellnessDogsScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [servicePlan, setServicePlan] = useState<CustomerServicePlan | null>(null);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [entries, setEntries] = useState<DogWeightEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DogDraft>>({});
  const [weightDrafts, setWeightDrafts] = useState<Record<string, WeightDraft>>({});
  const [calendarDogId, setCalendarDogId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [expandedDogs, setExpandedDogs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDogId, setSavingDogId] = useState<string | null>(null);
  const [weightSavingDogId, setWeightSavingDogId] = useState<string | null>(null);
  const [uploadingDogId, setUploadingDogId] = useState<string | null>(null);
  const [addDogOpen, setAddDogOpen] = useState(false);
  const [addDogDraft, setAddDogDraft] = useState({ name: '', breed: '', age: '', weight: '' });
  const [addDogError, setAddDogError] = useState<string | null>(null);
  const [addDogSaving, setAddDogSaving] = useState(false);

  const access = summary?.wellnessAccess ?? null;
  const maxDogs = access?.maxDogs ?? null;
  const multiDogLocked = maxDogs === 1 && dogs.length > 1;
  const addDogLocked = maxDogs !== null && dogs.length >= maxDogs;
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const serviceDogLimit =
    servicePlan?.hasActiveService && typeof servicePlan.dogCount === 'number'
      ? servicePlan.dogCount
      : null;
  const overServiceDogLimit =
    serviceDogLimit !== null && dogs.length > serviceDogLimit;

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, dogPayload, weightPayload, servicePayload] = await Promise.all([
        apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
          token: session.token,
        }),
        apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
          token: session.token,
        }),
        apiRequest<{ entries: DogWeightEntry[] }>('/api/mobile/customer/dogs/weights?limit=200', {
          token: session.token,
        }),
        apiRequest<CustomerServicePlan>('/api/mobile/customer/service-plan', {
          token: session.token,
        }),
      ]);
      setSummary(summaryData);
      setDogs(dogPayload.dogs ?? []);
      setEntries(weightPayload.entries ?? []);
      setServicePlan(servicePayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load dog profiles.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setDrafts(toDrafts(dogs));
    setWeightDrafts(toWeightDrafts(dogs));
  }, [dogs]);

  const entriesByDog = useMemo(() => {
    return entries.reduce((acc, entry) => {
      acc[entry.dogId] = acc[entry.dogId] ?? [];
      acc[entry.dogId].push(entry);
      return acc;
    }, {} as Record<string, DogWeightEntry[]>);
  }, [entries]);

  const handleDraftChange = (dogId: string, field: keyof DogDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [dogId]: {
        ...prev[dogId],
        [field]: value,
      },
    }));
  };

  const handleWeightDraftChange = (dogId: string, field: keyof WeightDraft, value: string) => {
    setWeightDrafts((prev) => ({
      ...prev,
      [dogId]: {
        ...prev[dogId],
        [field]: value,
      },
    }));
  };

  const handleOpenCalendar = (dogId: string) => {
    setCalendarDogId((prev) => (prev === dogId ? null : dogId));
    const draftDate = parseDateInput(weightDrafts[dogId]?.date ?? '');
    const base = draftDate ?? new Date();
    setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0));
  };

  const handlePickDate = (dogId: string, date: Date) => {
    handleWeightDraftChange(dogId, 'date', formatDateInput(date));
    setCalendarDogId(null);
  };

  const toggleExpand = (dogId: string) => {
    setExpandedDogs((prev) => ({ ...prev, [dogId]: !prev[dogId] }));
  };

  const handlePhotoUpload = async (dogId: string) => {
    if (!session?.token) return;
    setUploadingDogId(dogId);
    setError(null);
    try {
      const asset = await captureWithFallback({ kind: 'photo', source: 'auto' });
      if (!asset?.uri) return;
      const name =
        asset.fileName || `dog-${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;
      const type = asset.mimeType || 'image/jpeg';
      const formData = new FormData();
      formData.append('dogId', dogId);
      formData.append('file', { uri: asset.uri, name, type } as any);
      await apiUpload('/api/mobile/customer/dogs/avatar', {
        method: 'POST',
        token: session.token,
        body: formData,
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload photo.';
      setError(message);
    } finally {
      setUploadingDogId(null);
    }
  };

  const handleSaveDog = async (dogId: string) => {
    if (!session?.token) return;
    const draft = drafts[dogId];
    if (!draft?.name.trim()) {
      setError('Please enter a dog name.');
      return;
    }
    setSavingDogId(dogId);
    setError(null);
    try {
      const payload = {
        id: dogId,
        name: draft.name.trim(),
        breed: draft.breed.trim() ? draft.breed.trim() : null,
        age: draft.age ? Number(draft.age) : null,
        weight: draft.weight ? Number(draft.weight) : null,
        allergies: draft.allergies.trim() ? draft.allergies.trim() : null,
        medications: draft.medications.trim() ? draft.medications.trim() : null,
        dietNotes: draft.dietNotes.trim() ? draft.dietNotes.trim() : null,
        vetName: draft.vetName.trim() ? draft.vetName.trim() : null,
        vetPhone: draft.vetPhone.trim() ? draft.vetPhone.trim() : null,
        vetClinic: draft.vetClinic.trim() ? draft.vetClinic.trim() : null,
        insuranceProvider: draft.insuranceProvider.trim() ? draft.insuranceProvider.trim() : null,
        insurancePolicyNumber: draft.insurancePolicyNumber.trim() ? draft.insurancePolicyNumber.trim() : null,
        insurancePhone: draft.insurancePhone.trim() ? draft.insurancePhone.trim() : null,
      };
      await apiRequest('/api/mobile/customer/dogs', {
        method: 'PATCH',
        token: session.token,
        body: payload,
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save dog profile.';
      setError(message);
    } finally {
      setSavingDogId(null);
    }
  };

  const handleAddWeight = async (dogId: string) => {
    if (!session?.token) return;
    const draft = weightDrafts[dogId];
    const weightValue = Number(draft?.weight ?? '');
    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      setError('Enter a valid weight in pounds.');
      return;
    }
    setWeightSavingDogId(dogId);
    setError(null);
    try {
      const recordedAt = draft?.date ? parseDateInput(draft.date) : null;
      const payload = {
        dogId,
        weightLbs: weightValue,
        recordedAt: recordedAt ? recordedAt.toISOString() : undefined,
        notes: draft?.notes?.trim() ? draft.notes.trim() : null,
        source: 'OWNER_LOG',
      };
      const data = await apiRequest<{ entry: DogWeightEntry }>(
        '/api/mobile/customer/dogs/weights',
        {
          method: 'POST',
          token: session.token,
          body: payload,
        },
      );
      if (data?.entry) {
        setEntries((prev) => [data.entry, ...prev]);
      }
      setWeightDrafts((prev) => ({
        ...prev,
        [dogId]: { weight: '', date: '', notes: '' },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save weight.';
      setError(message);
    } finally {
      setWeightSavingDogId(null);
    }
  };

  const handleAddDog = async () => {
    if (!session?.token) return;
    if (!addDogDraft.name.trim()) {
      setAddDogError('Dog name is required.');
      return;
    }
    setAddDogSaving(true);
    setAddDogError(null);
    try {
      const payload = {
        name: addDogDraft.name.trim(),
        breed: addDogDraft.breed.trim() ? addDogDraft.breed.trim() : null,
        age: addDogDraft.age ? Number(addDogDraft.age) : null,
        weight: addDogDraft.weight ? Number(addDogDraft.weight) : null,
      };
      await apiRequest('/api/mobile/customer/dogs', {
        method: 'POST',
        token: session.token,
        body: payload,
      });
      setAddDogDraft({ name: '', breed: '', age: '', weight: '' });
      setAddDogOpen(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to add dog.';
      setAddDogError(message);
    } finally {
      setAddDogSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Dog profile hub</Text>
          <Text style={[styles.title, { color: palette.text }]}>Profiles and weight trends</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Track weight changes, allergies, and vet notes in one place.
          </Text>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading profiles...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        {multiDogLocked ? (
          <View style={[styles.callout, { borderColor: Colors.brand.gold, backgroundColor: palette.card }]}>
            <Text style={[styles.calloutText, { color: palette.text }]}>
              Premium keeps multi-dog insights active and unlocks family sharing.
            </Text>
          </View>
        ) : null}

        {overServiceDogLimit ? (
          <View style={[styles.callout, { borderColor: palette.tint, backgroundColor: palette.card }]}>
            <Text style={[styles.calloutText, { color: palette.text }]}>
              Your scooping plan covers {serviceDogLimit} dog
              {serviceDogLimit === 1 ? '' : 's'}, but you have {dogs.length}. Update your plan to keep
              billing accurate.
            </Text>
            <Button title="Update service plan" onPress={() => router.push('/(app)/(customer)/service-plan' as any)} />
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Your dogs</Text>
          <Button
            title={addDogLocked ? 'Upgrade to add' : 'Add dog'}
            onPress={() => setAddDogOpen(true)}
            variant={addDogLocked ? 'secondary' : 'primary'}
            disabled={addDogLocked}
          />
        </View>

        {dogs.length === 0 && !loading ? (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>No profiles yet</Text>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Add your first dog to unlock weight tracking and care notes.
            </Text>
          </View>
        ) : null}

        {dogs.map((dog) => {
          const draft = drafts[dog.id];
          const dogEntries = (entriesByDog[dog.id] ?? []).sort(
            (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
          );
          const latestEntry = dogEntries[0];
          const earliestEntry = dogEntries[dogEntries.length - 1];
          const delta =
            latestEntry && earliestEntry
              ? latestEntry.weightLbs - earliestEntry.weightLbs
              : null;
          const deltaLabel =
            delta === null
              ? 'Log weights to see a trend.'
              : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} lbs since ${formatDate(
                  earliestEntry.recordedAt,
                )}`;
          const bars = buildTrendBars(dogEntries);

          return (
            <View
              key={dog.id}
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.dogHeader}>
                {dog.photoUrl ? (
                  <Image source={{ uri: dog.photoUrl }} style={styles.dogPhoto} />
                ) : (
                  <View style={[styles.dogPhotoFallback, { backgroundColor: palette.background }]}>
                    <Text style={[styles.dogInitial, { color: palette.text }]}>
                      {dog.name?.slice(0, 1)?.toUpperCase() ?? 'D'}
                    </Text>
                  </View>
                )}
                <View style={styles.dogHeaderCopy}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    {draft?.name ?? dog.name}
                  </Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    {[draft?.breed || dog.breed, draft?.age || dog.age ? `${draft?.age || dog.age} yrs` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Add breed and age'}
                  </Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    {draft?.weight || dog.weight ? `${draft?.weight || dog.weight} lbs` : 'Weight pending'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.photoButton, { borderColor: palette.border }]}
                  onPress={() => handlePhotoUpload(dog.id)}
                >
                  <FontAwesome name="camera" size={14} color={palette.text} />
                  <Text style={[styles.photoButtonText, { color: palette.text }]}>
                    {uploadingDogId === dog.id ? 'Uploading' : 'Photo'}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.metricCard, { borderColor: palette.border }]}>
                <View style={styles.metricRow}>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>Weight trend</Text>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>
                    {latestEntry ? `${latestEntry.weightLbs.toFixed(1)} lbs latest` : 'No logs'}
                  </Text>
                </View>
                <View style={styles.barRow}>
                  {bars.length === 0 ? (
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      Add 2+ weigh-ins to see trend bars.
                    </Text>
                  ) : (
                    bars.map((bar) => (
                      <View
                        key={bar.id}
                        style={[
                          styles.bar,
                          { height: bar.height, backgroundColor: palette.tint },
                        ]}
                      />
                    ))
                  )}
                </View>
                <Text style={[styles.helperText, { color: palette.muted }]}>{deltaLabel}</Text>
              </View>

              <View style={[styles.subCard, { borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Log a weigh-in</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Weight (lbs)"
                    placeholderTextColor={palette.muted}
                    keyboardType="decimal-pad"
                    value={weightDrafts[dog.id]?.weight ?? ''}
                    onChangeText={(value) => handleWeightDraftChange(dog.id, 'weight', value)}
                  />
                  <Pressable
                    onPress={() => handleOpenCalendar(dog.id)}
                    style={[
                      styles.dateInput,
                      { borderColor: palette.border, backgroundColor: palette.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateInputText,
                        {
                          color: weightDrafts[dog.id]?.date
                            ? palette.text
                            : palette.muted,
                        },
                      ]}
                    >
                      {weightDrafts[dog.id]?.date || 'MM/DD/YYYY'}
                    </Text>
                    <FontAwesome name="calendar" size={14} color={palette.muted} />
                  </Pressable>
                </View>
                {calendarDogId === dog.id ? (
                  <View
                    style={[
                      styles.calendarCard,
                      { borderColor: palette.border, backgroundColor: palette.card },
                    ]}
                  >
                    <View style={styles.calendarHeaderRow}>
                      <Pressable
                        onPress={() =>
                          setCalendarMonth(
                            new Date(
                              calendarMonth.getFullYear(),
                              calendarMonth.getMonth() - 1,
                              1,
                              12,
                              0,
                              0,
                              0,
                            ),
                          )
                        }
                        style={styles.calendarNav}
                      >
                        <FontAwesome name="chevron-left" size={12} color={palette.text} />
                      </Pressable>
                      <Text style={[styles.calendarTitle, { color: palette.text }]}>
                        {calendarMonth.toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setCalendarMonth(
                            new Date(
                              calendarMonth.getFullYear(),
                              calendarMonth.getMonth() + 1,
                              1,
                              12,
                              0,
                              0,
                              0,
                            ),
                          )
                        }
                        style={styles.calendarNav}
                      >
                        <FontAwesome name="chevron-right" size={12} color={palette.text} />
                      </Pressable>
                    </View>
                    <View style={styles.calendarWeekRow}>
                      {weekLabels.map((label) => (
                        <Text key={label} style={[styles.calendarWeekday, { color: palette.muted }]}>
                          {label}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.calendarGrid}>
                      {calendarDays.map((date) => {
                        const key = toDateKey(date);
                        const selectedDate = parseDateInput(weightDrafts[dog.id]?.date ?? '');
                        const selectedKey = selectedDate ? toDateKey(selectedDate) : null;
                        const isSelected = selectedKey === key;
                        const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                        return (
                          <Pressable
                            key={`${dog.id}-${key}`}
                            onPress={() => handlePickDate(dog.id, date)}
                            style={[
                              styles.calendarDay,
                              isSelected && { backgroundColor: palette.tint },
                            ]}
                          >
                            <Text
                              style={[
                                styles.calendarDayText,
                                {
                                  color: isSelected
                                    ? '#FFFFFF'
                                    : isCurrentMonth
                                      ? palette.text
                                      : palette.muted,
                                },
                              ]}
                            >
                              {date.getDate()}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                <TextInput
                  style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                  placeholder="Notes (optional)"
                  placeholderTextColor={palette.muted}
                  value={weightDrafts[dog.id]?.notes ?? ''}
                  onChangeText={(value) => handleWeightDraftChange(dog.id, 'notes', value)}
                />
                <Button
                  title={weightSavingDogId === dog.id ? 'Saving...' : 'Save weight'}
                  onPress={() => handleAddWeight(dog.id)}
                  disabled={weightSavingDogId === dog.id}
                />
                {dogEntries.length > 0 ? (
                  <View style={styles.entryList}>
                    {dogEntries.slice(0, 3).map((entry) => (
                      <Text key={entry.id} style={[styles.helperText, { color: palette.muted }]}>
                        {formatDate(entry.recordedAt)} · {entry.weightLbs.toFixed(1)} lbs
                        {entry.notes ? ' · Notes' : ''}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>

              <Pressable onPress={() => toggleExpand(dog.id)} style={styles.expandToggle}>
                <Text style={[styles.helperText, { color: palette.tint }]}>
                  {expandedDogs[dog.id] ? 'Hide care details' : 'Show care details'}
                </Text>
              </Pressable>

              {expandedDogs[dog.id] ? (
                <View style={styles.expandSection}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>Care notes</Text>
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Allergies"
                    placeholderTextColor={palette.muted}
                    value={draft?.allergies ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'allergies', value)}
                  />
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Medications"
                    placeholderTextColor={palette.muted}
                    value={draft?.medications ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'medications', value)}
                  />
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Diet notes"
                    placeholderTextColor={palette.muted}
                    value={draft?.dietNotes ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'dietNotes', value)}
                  />

                  <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 12 }]}>Vet info</Text>
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Vet name"
                    placeholderTextColor={palette.muted}
                    value={draft?.vetName ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'vetName', value)}
                  />
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Vet phone"
                    placeholderTextColor={palette.muted}
                    keyboardType="phone-pad"
                    value={draft?.vetPhone ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'vetPhone', value)}
                  />
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Vet clinic"
                    placeholderTextColor={palette.muted}
                    value={draft?.vetClinic ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'vetClinic', value)}
                  />

                  <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 12 }]}>Pet insurance</Text>
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Insurance provider (e.g., Trupanion, Healthy Paws)"
                    placeholderTextColor={palette.muted}
                    value={draft?.insuranceProvider ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'insuranceProvider', value)}
                  />
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Policy number"
                    placeholderTextColor={palette.muted}
                    value={draft?.insurancePolicyNumber ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'insurancePolicyNumber', value)}
                  />
                  <TextInput
                    style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                    placeholder="Insurance phone"
                    placeholderTextColor={palette.muted}
                    keyboardType="phone-pad"
                    value={draft?.insurancePhone ?? ''}
                    onChangeText={(value) => handleDraftChange(dog.id, 'insurancePhone', value)}
                  />
                </View>
              ) : null}

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                  placeholder="Breed"
                  placeholderTextColor={palette.muted}
                  value={draft?.breed ?? ''}
                  onChangeText={(value) => handleDraftChange(dog.id, 'breed', value)}
                />
                <TextInput
                  style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                  placeholder="Age"
                  placeholderTextColor={palette.muted}
                  keyboardType="number-pad"
                  value={draft?.age ?? ''}
                  onChangeText={(value) => handleDraftChange(dog.id, 'age', value)}
                />
              </View>
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                placeholder="Weight (lbs)"
                placeholderTextColor={palette.muted}
                keyboardType="decimal-pad"
                value={draft?.weight ?? ''}
                onChangeText={(value) => handleDraftChange(dog.id, 'weight', value)}
              />
              <Button
                title={savingDogId === dog.id ? 'Saving...' : 'Save profile updates'}
                onPress={() => handleSaveDog(dog.id)}
                disabled={savingDogId === dog.id}
              />
            </View>
          );
        })}
      </ScrollView>

      <Modal transparent visible={addDogOpen} animationType="slide" onRequestClose={() => setAddDogOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Add a dog</Text>
              <Pressable onPress={() => setAddDogOpen(false)}>
                <Text style={[styles.modalClose, { color: palette.muted }]}>Close</Text>
              </Pressable>
            </View>

            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder="Name"
              placeholderTextColor={palette.muted}
              value={addDogDraft.name}
              onChangeText={(value) => setAddDogDraft((prev) => ({ ...prev, name: value }))}
            />
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder="Breed"
              placeholderTextColor={palette.muted}
              value={addDogDraft.breed}
              onChangeText={(value) => setAddDogDraft((prev) => ({ ...prev, breed: value }))}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                placeholder="Age"
                placeholderTextColor={palette.muted}
                keyboardType="number-pad"
                value={addDogDraft.age}
                onChangeText={(value) => setAddDogDraft((prev) => ({ ...prev, age: value }))}
              />
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                placeholder="Weight (lbs)"
                placeholderTextColor={palette.muted}
                keyboardType="decimal-pad"
                value={addDogDraft.weight}
                onChangeText={(value) => setAddDogDraft((prev) => ({ ...prev, weight: value }))}
              />
            </View>

            {addDogError ? (
              <Text style={[styles.helperText, { color: palette.danger }]}>{addDogError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setAddDogOpen(false)} variant="secondary" />
              <Button
                title={addDogSaving ? 'Saving...' : 'Save dog'}
                onPress={handleAddDog}
                disabled={addDogSaving}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  callout: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  calloutText: {
    fontSize: 12,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  dogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dogPhoto: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  dogPhotoFallback: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogInitial: {
    fontSize: 22,
    fontWeight: '700',
  },
  dogHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  photoButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  barRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
    minHeight: 32,
  },
  bar: {
    width: 10,
    borderRadius: 6,
  },
  subCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    flex: 1,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    fontSize: 14,
    fontWeight: '600',
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNav: {
    padding: 6,
  },
  calendarTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarWeekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  entryList: {
    marginTop: 6,
    gap: 2,
  },
  expandToggle: {
    alignSelf: 'flex-start',
  },
  expandSection: {
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 20,
    justifyContent: 'center',
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
