import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { CustomerSummary, DogSummary, WellnessReminder } from '@/lib/api/types';

const CATEGORY_OPTIONS = [
  { label: 'Meds', value: 'MEDS' },
  { label: 'Vaccine', value: 'VACCINE' },
  { label: 'Deworm', value: 'DEWORMING' },
  { label: 'Flea/Tick', value: 'FLEA_TICK' },
  { label: 'Food', value: 'FOOD_TRANSITION' },
  { label: 'Vet', value: 'VET_VISIT' },
  { label: 'Custom', value: 'CUSTOM' },
] as const;

const FREQUENCY_OPTIONS = [
  { label: 'Daily', value: 1 },
  { label: 'One-time', value: null },
  { label: 'Weekly', value: 7 },
  { label: 'Monthly', value: 30 },
  { label: 'Quarterly', value: 90 },
  { label: 'Yearly', value: 365 },
];

const QUICK_DUE_OPTIONS = [
  { label: 'Tomorrow', offset: 1 },
  { label: 'Next week', offset: 7 },
  { label: 'Next month', offset: 30 },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatDateDisplay = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${year}`;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export default function CustomerReminders() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const params = useLocalSearchParams<{
    prefillTitle?: string | string[];
    prefillCategory?: string | string[];
    prefillNotes?: string | string[];
    prefillFrequencyDays?: string | string[];
    prefillDueDate?: string | string[];
    prefillDogId?: string | string[];
  }>();
  const prefillHandled = useRef(false);
  const [reminders, setReminders] = useState<WellnessReminder[]>([]);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WellnessReminder['category']>('CUSTOM');
  const [dogId, setDogId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [frequencyDays, setFrequencyDays] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const todayKey = toDateKey(new Date());

  const readParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const validCategories = new Set(CATEGORY_OPTIONS.map((option) => option.value));

  useEffect(() => {
    if (prefillHandled.current) return;
    const prefillTitle = readParam(params.prefillTitle);
    const prefillCategory = readParam(params.prefillCategory);
    const prefillNotes = readParam(params.prefillNotes);
    const prefillFrequencyDays = readParam(params.prefillFrequencyDays);
    const prefillDueDate = readParam(params.prefillDueDate);
    const prefillDogId = readParam(params.prefillDogId);

    if (
      !prefillTitle &&
      !prefillCategory &&
      !prefillNotes &&
      !prefillFrequencyDays &&
      !prefillDueDate &&
      !prefillDogId
    ) {
      return;
    }

    prefillHandled.current = true;
    setTitle(prefillTitle ?? '');
    setCategory(
      prefillCategory && validCategories.has(prefillCategory as any)
        ? (prefillCategory as WellnessReminder['category'])
        : 'CUSTOM',
    );
    setNotes(prefillNotes ?? '');
    if (prefillDogId) {
      setDogId(prefillDogId);
    }
    if (prefillFrequencyDays) {
      const parsed = Number(prefillFrequencyDays);
      setFrequencyDays(Number.isFinite(parsed) ? parsed : null);
    } else {
      setFrequencyDays(null);
    }
    if (prefillDueDate) {
      const parsed = new Date(prefillDueDate);
      if (!Number.isNaN(parsed.getTime())) {
        setDueDate(parsed);
        setCalendarMonth(parsed);
      }
    } else {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 7);
      fallback.setHours(9, 0, 0, 0);
      setDueDate(fallback);
      setCalendarMonth(fallback);
    }
    setFormError(null);
    setModalOpen(true);
  }, [params]);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryPayload, reminderPayload, dogPayload] = await Promise.all([
        apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
          token: session.token,
        }),
        apiRequest<{ reminders: WellnessReminder[] }>(
          '/api/mobile/customer/reminders?includeInactive=true',
          { token: session.token },
        ),
        apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
          token: session.token,
        }),
      ]);
      setSummary(summaryPayload);
      setReminders(reminderPayload.reminders ?? []);
      setDogs(dogPayload.dogs ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load reminders.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setTitle('');
    setCategory('CUSTOM');
    setDogId(null);
    setNotes('');
    setFrequencyDays(null);
    const next = new Date();
    next.setDate(next.getDate() + 7);
    next.setHours(9, 0, 0, 0);
    setDueDate(next);
    setCalendarMonth(next);
    setFormError(null);
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleDueQuickSelect = (offset: number) => {
    const next = new Date();
    next.setDate(next.getDate() + offset);
    next.setHours(9, 0, 0, 0);
    setDueDate(next);
    setCalendarMonth(next);
  };

  const handleSave = async () => {
    if (!session?.token || saving) return;
    if (!title.trim()) {
      setFormError('Add a reminder title.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const data = await apiRequest<{ reminder: WellnessReminder }>(
        '/api/mobile/customer/reminders',
        {
          method: 'POST',
          token: session.token,
          body: {
            title: title.trim(),
            category,
            dogId,
            notes: notes.trim() ? notes.trim() : undefined,
            nextDueAt: dueDate.toISOString(),
            frequencyDays,
          },
        },
      );
      setReminders((prev) => [data.reminder, ...prev]);
      setModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save reminder.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (reminder: WellnessReminder) => {
    if (!session?.token) return;
    const nextActive = !reminder.active;
    setReminders((prev) =>
      prev.map((item) => (item.id === reminder.id ? { ...item, active: nextActive } : item)),
    );
    try {
      const data = await apiRequest<{ reminder: WellnessReminder }>(
        `/api/mobile/customer/reminders/${reminder.id}`,
        {
          method: 'PATCH',
          token: session.token,
          body: { active: nextActive },
        },
      );
      setReminders((prev) =>
        prev.map((item) => (item.id === reminder.id ? data.reminder : item)),
      );
    } catch (err) {
      await loadData();
    }
  };

  const handleMarkDone = async (reminder: WellnessReminder) => {
    if (!session?.token) return;
    try {
      const data = await apiRequest<{ reminder: WellnessReminder }>(
        `/api/mobile/customer/reminders/${reminder.id}`,
        {
          method: 'PATCH',
          token: session.token,
          body: { markComplete: true },
        },
      );
      setReminders((prev) =>
        prev.map((item) => (item.id === reminder.id ? data.reminder : item)),
      );
    } catch (err) {
      await loadData();
    }
  };

  const handleDelete = async (reminder: WellnessReminder) => {
    if (!session?.token) return;
    setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
    try {
      await apiRequest(`/api/mobile/customer/reminders/${reminder.id}`, {
        method: 'DELETE',
        token: session.token,
      });
    } catch (err) {
      await loadData();
    }
  };

  const upcoming = useMemo(() => {
    return reminders
      .filter((reminder) => reminder.active)
      .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
  }, [reminders]);
  const paused = useMemo(() => {
    return reminders
      .filter((reminder) => !reminder.active)
      .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
  }, [reminders]);

  const multiDogLocked = summary?.wellnessAccess?.maxDogs === 1 && dogs.length > 1;

  useEffect(() => {
    if (!multiDogLocked) return;
    setDogId(null);
  }, [multiDogLocked]);

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const selectedKey = toDateKey(dueDate);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Care reminders</Text>
          <Text style={[styles.title, { color: palette.text }]}>Stay on track</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Track meds, vaccines, and care milestones in one place.
          </Text>
          <Button title="Add reminder" onPress={openModal} />
        </View>
        {multiDogLocked ? (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Premium unlocks per-dog reminders for multi-dog households.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading reminders...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
        ) : upcoming.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>No reminders yet</Text>
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Add a reminder to keep meds, vaccines, and routines on schedule.
            </Text>
          </View>
        ) : (
          upcoming.map((reminder) => (
            <View
              key={reminder.id}
              style={[styles.reminderCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.reminderHeader}>
                <View>
                  <Text style={[styles.reminderTitle, { color: palette.text }]}>
                    {reminder.title}
                  </Text>
                  <Text style={[styles.helperText, { color: palette.muted }]}>
                    {reminder.category.replace('_', ' ').toLowerCase()} •{' '}
                    {reminder.dogName ?? 'Household'}
                  </Text>
                </View>
                <Text style={[styles.dueText, { color: palette.text }]}>
                  {new Date(reminder.nextDueAt).toLocaleDateString('en-US')}
                </Text>
              </View>
              {reminder.notes ? (
                <Text style={[styles.helperText, { color: palette.muted }]}>{reminder.notes}</Text>
              ) : null}
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionChip, { borderColor: palette.border }]}
                  onPress={() => handleMarkDone(reminder)}
                >
                  <Text style={[styles.actionText, { color: palette.text }]}>Mark done</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionChip, { borderColor: palette.border }]}
                  onPress={() => handleToggleActive(reminder)}
                >
                  <Text style={[styles.actionText, { color: palette.text }]}>
                    {reminder.active ? 'Pause' : 'Resume'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(reminder)}>
                  <Text style={[styles.deleteText, { color: palette.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {paused.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Paused reminders</Text>
            {paused.map((reminder) => (
              <View
                key={reminder.id}
                style={[styles.reminderCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View style={styles.reminderHeader}>
                  <View>
                    <Text style={[styles.reminderTitle, { color: palette.text }]}>
                      {reminder.title}
                    </Text>
                    <Text style={[styles.helperText, { color: palette.muted }]}>
                      {reminder.category.replace('_', ' ').toLowerCase()} •{' '}
                      {reminder.dogName ?? 'Household'}
                    </Text>
                  </View>
                  <Text style={[styles.dueText, { color: palette.muted }]}>Paused</Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionChip, { borderColor: palette.border }]}
                    onPress={() => handleToggleActive(reminder)}
                  >
                    <Text style={[styles.actionText, { color: palette.text }]}>Resume</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(reminder)}>
                    <Text style={[styles.deleteText, { color: palette.danger }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal transparent visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 32 : 0}
        >
          <View style={styles.modalContent}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>New reminder</Text>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder="Reminder title"
              placeholderTextColor={palette.muted}
              value={title}
              onChangeText={setTitle}
            />
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  label={option.label}
                  selected={category === option.value}
                  onPress={() => setCategory(option.value)}
                />
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Dog (optional)</Text>
            <View style={styles.chipRow}>
              <ChoiceChip
                label="Household"
                selected={!dogId}
                onPress={() => setDogId(null)}
                disabled={multiDogLocked}
              />
              {dogs.map((dog) => (
                <ChoiceChip
                  key={dog.id}
                  label={dog.name}
                  selected={dogId === dog.id}
                  onPress={() => setDogId(dog.id)}
                  disabled={multiDogLocked}
                />
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Next due</Text>
            <View style={styles.chipRow}>
              {QUICK_DUE_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.label}
                  label={option.label}
                  selected={toDateKey(dueDate) === toDateKey(new Date(Date.now() + option.offset * 86400000))}
                  onPress={() => handleDueQuickSelect(option.offset)}
                />
              ))}
            </View>
            <View style={styles.calendarHeaderRow}>
              <Pressable
                onPress={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
                  )
                }
              >
                <Text style={[styles.calendarNav, { color: palette.tint }]}>Prev</Text>
              </Pressable>
              <Text style={[styles.calendarTitle, { color: palette.text }]}>
                {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </Text>
              <Pressable
                onPress={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
                  )
                }
              >
                <Text style={[styles.calendarNav, { color: palette.tint }]}>Next</Text>
              </Pressable>
            </View>
            <View style={styles.calendarHeader}>
              {DAY_LABELS.map((label) => (
                <Text key={label} style={[styles.calendarLabel, { color: palette.muted }]}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((date) => {
                const key = toDateKey(date);
                const isSelected = selectedKey === key;
                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                const isToday = key === todayKey;
                const pickDate = new Date(date);
                pickDate.setHours(9, 0, 0, 0);
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setDueDate(pickDate);
                      if (date.getMonth() !== calendarMonth.getMonth()) {
                        setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                      }
                    }}
                    style={[
                      styles.calendarCell,
                      {
                        borderColor: isSelected
                          ? palette.tint
                          : isToday
                            ? palette.accent
                            : palette.border,
                        backgroundColor: isSelected ? palette.tint : palette.background,
                        opacity: isCurrentMonth ? 1 : 0.4,
                      },
                    ]}
                  >
                    <Text style={{ color: isSelected ? '#FFFFFF' : palette.text, fontWeight: '600' }}>
                      {date.getDate()}
                    </Text>
                    {isToday ? (
                      <View style={[styles.todayDot, { backgroundColor: palette.accent }]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.calendarSelected, { color: palette.muted }]}>
              Selected date: {formatDateDisplay(dueDate)}
            </Text>

            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Repeat</Text>
            <View style={styles.chipRow}>
              {FREQUENCY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.label}
                  label={option.label}
                  selected={frequencyDays === option.value}
                  onPress={() => setFrequencyDays(option.value)}
                />
              ))}
            </View>

            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder="Notes (optional)"
              placeholderTextColor={palette.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {formError ? (
              <Text style={[styles.helperText, { color: palette.danger }]}>{formError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setModalOpen(false)} variant="secondary" />
              <Button
                title={saving ? 'Saving...' : 'Save'}
                onPress={handleSave}
                disabled={saving}
              />
            </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    gap: 8,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  reminderCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  sectionBlock: {
    marginTop: 16,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  dueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 20,
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScroll: {
    paddingBottom: 24,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  calendarNav: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  calendarLabel: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  calendarSelected: {
    fontSize: 12,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 6,
    left: 6,
  },
});
