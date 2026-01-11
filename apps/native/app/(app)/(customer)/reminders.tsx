import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ReminderCard from '@/components/wellness/ReminderCard';
import ReminderSheet from '@/components/wellness/ReminderSheet';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { CustomerSummary, DogSummary, WellnessReminder } from '@/lib/api/types';

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
    prefillTimestamp?: string | string[];
  }>();
  const lastPrefillTimestamp = useRef<string | null>(null);

  const [reminders, setReminders] = useState<WellnessReminder[]>([]);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [prefillData, setPrefillData] = useState<{
    title?: string;
    category?: WellnessReminder['category'];
    dogId?: string;
    notes?: string;
    dueDate?: Date;
    frequencyDays?: number;
  } | undefined>(undefined);

  const validCategories = new Set([
    'MEDS', 'VACCINE', 'DEWORMING', 'FLEA_TICK', 'FOOD_TRANSITION', 'VET_VISIT', 'CUSTOM',
  ]);

  const readParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  // Handle prefill params
  useEffect(() => {
    const prefillTitle = readParam(params.prefillTitle);
    const prefillCategory = readParam(params.prefillCategory);
    const prefillNotes = readParam(params.prefillNotes);
    const prefillFrequencyDays = readParam(params.prefillFrequencyDays);
    const prefillDueDate = readParam(params.prefillDueDate);
    const prefillDogId = readParam(params.prefillDogId);
    const prefillTimestamp = readParam(params.prefillTimestamp);

    // Skip if no prefill data
    if (!prefillTitle && !prefillCategory && !prefillNotes && !prefillFrequencyDays && !prefillDueDate && !prefillDogId) {
      return;
    }

    // Skip if we already processed this exact prefill (same timestamp)
    if (prefillTimestamp && lastPrefillTimestamp.current === prefillTimestamp) {
      return;
    }

    // Track this prefill to avoid re-processing
    if (prefillTimestamp) {
      lastPrefillTimestamp.current = prefillTimestamp;
    }

    let dueDate: Date | undefined;
    if (prefillDueDate) {
      const parsed = new Date(prefillDueDate);
      if (!Number.isNaN(parsed.getTime())) {
        dueDate = parsed;
      }
    }

    let frequencyDays: number | undefined;
    if (prefillFrequencyDays) {
      const parsed = Number(prefillFrequencyDays);
      if (Number.isFinite(parsed)) {
        frequencyDays = parsed;
      }
    }

    setPrefillData({
      title: prefillTitle,
      category: prefillCategory && validCategories.has(prefillCategory)
        ? (prefillCategory as WellnessReminder['category'])
        : undefined,
      notes: prefillNotes,
      dogId: prefillDogId,
      dueDate,
      frequencyDays,
    });
    setSheetOpen(true);
  }, [params]);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryPayload, reminderPayload, dogPayload] = await Promise.all([
        apiRequest<CustomerSummary>('/api/mobile/customer/summary', { token: session.token }),
        apiRequest<{ reminders: WellnessReminder[] }>(
          '/api/mobile/customer/reminders?includeInactive=true',
          { token: session.token },
        ),
        apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', { token: session.token }),
      ]);
      setSummary(summaryPayload);
      setReminders(reminderPayload.reminders ?? []);
      setDogs(dogPayload.dogs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reminders.');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (data: {
    title: string;
    category: WellnessReminder['category'];
    dogId: string | null;
    notes: string;
    nextDueAt: Date;
    frequencyDays: number | null;
  }) => {
    if (!session?.token || saving) return;
    setSaving(true);
    try {
      const result = await apiRequest<{ reminder: WellnessReminder }>(
        '/api/mobile/customer/reminders',
        {
          method: 'POST',
          token: session.token,
          body: {
            title: data.title,
            category: data.category,
            dogId: data.dogId,
            notes: data.notes || undefined,
            nextDueAt: data.nextDueAt.toISOString(),
            frequencyDays: data.frequencyDays,
          },
        },
      );
      setReminders((prev) => [result.reminder, ...prev]);
      setSheetOpen(false);
      setPrefillData(undefined);
    } catch (err) {
      // Keep sheet open on error
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
    if (!session?.token || markingId) return;
    const now = new Date();
    const nextDueAt = reminder.frequencyDays
      ? new Date(now.getTime() + reminder.frequencyDays * 86400000)
      : null;

    setMarkingId(reminder.id);
    setReminders((prev) =>
      prev.map((item) =>
        item.id === reminder.id
          ? {
              ...item,
              lastCompletedAt: now.toISOString(),
              nextDueAt: nextDueAt ? nextDueAt.toISOString() : item.nextDueAt,
              active: Boolean(nextDueAt),
            }
          : item,
      ),
    );
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
    } finally {
      setMarkingId(null);
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

  const { upcoming, overdue, paused } = useMemo(() => {
    const now = new Date();
    const active = reminders.filter((r) => r.active);
    const inactive = reminders.filter((r) => !r.active);

    const overdueList: WellnessReminder[] = [];
    const upcomingList: WellnessReminder[] = [];

    for (const reminder of active) {
      const dueDate = new Date(reminder.nextDueAt);
      if (dueDate < now) {
        overdueList.push(reminder);
      } else {
        upcomingList.push(reminder);
      }
    }

    overdueList.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
    upcomingList.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
    inactive.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

    return { upcoming: upcomingList, overdue: overdueList, paused: inactive };
  }, [reminders]);

  const multiDogLocked = summary?.wellnessAccess?.maxDogs === 1 && dogs.length > 1;

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : '#1E293B';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>
            Wellness
          </Text>
          <Text style={styles.heroTitle}>Reminders</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            Track meds, vaccines, and care milestones.
          </Text>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.statValue, { color: overdue.length > 0 ? palette.danger : palette.text }]}>
              {overdue.length}
            </Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Overdue</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.statValue, { color: palette.text }]}>{upcoming.length}</Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Upcoming</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.statValue, { color: palette.muted }]}>{paused.length}</Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Paused</Text>
          </View>
        </View>

        {/* Add button */}
        <Button
          title="Add reminder"
          onPress={() => {
            setPrefillData(undefined);
            setSheetOpen(true);
          }}
        />

        {/* Premium notice */}
        {multiDogLocked && (
          <View style={[styles.noticeCard, { backgroundColor: `${palette.tint}10`, borderColor: palette.tint }]}>
            <FontAwesome name="lock" size={14} color={palette.tint} />
            <Text style={[styles.noticeText, { color: palette.tint }]}>
              Premium unlocks per-dog reminders for multi-dog households.
            </Text>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10` }]}>
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        )}

        {/* Overdue section */}
        {overdue.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.overdueHeader, { backgroundColor: `${palette.danger}10` }]}>
              <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
              <Text style={[styles.overdueHeaderText, { color: palette.danger }]}>
                {overdue.length} overdue
              </Text>
            </View>
            {overdue.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                marking={markingId === reminder.id}
                onMarkDone={() => handleMarkDone(reminder)}
                onToggleActive={() => handleToggleActive(reminder)}
                onDelete={() => handleDelete(reminder)}
              />
            ))}
          </View>
        )}

        {/* Upcoming section */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Upcoming</Text>
            {upcoming.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                marking={markingId === reminder.id}
                onMarkDone={() => handleMarkDone(reminder)}
                onToggleActive={() => handleToggleActive(reminder)}
                onDelete={() => handleDelete(reminder)}
              />
            ))}
          </View>
        )}

        {/* Empty state */}
        {!loading && upcoming.length === 0 && overdue.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="bell" size={24} color={palette.tint} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No active reminders</Text>
            <Text style={[styles.emptyDesc, { color: palette.muted }]}>
              Add a reminder to keep meds, vaccines, and routines on schedule.
            </Text>
          </View>
        )}

        {/* Paused section */}
        {paused.length > 0 && (
          <View style={styles.section}>
            <Pressable
              style={styles.pausedHeader}
              onPress={() => setShowPaused(!showPaused)}
            >
              <Text style={[styles.sectionTitle, { color: palette.muted }]}>
                Paused ({paused.length})
              </Text>
              <FontAwesome
                name={showPaused ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={palette.muted}
              />
            </Pressable>
            {showPaused &&
              paused.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  marking={markingId === reminder.id}
                  onMarkDone={() => handleMarkDone(reminder)}
                  onToggleActive={() => handleToggleActive(reminder)}
                  onDelete={() => handleDelete(reminder)}
                />
              ))}
          </View>
        )}
      </ScrollView>

      {/* Sheet */}
      <ReminderSheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setPrefillData(undefined);
        }}
        dogs={dogs}
        multiDogLocked={multiDogLocked}
        saving={saving}
        onSave={handleSave}
        prefill={prefillData}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    gap: 16,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    paddingTop: 32,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
  },
  errorCard: {
    padding: 14,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  section: {
    gap: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  overdueHeaderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pausedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
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
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
