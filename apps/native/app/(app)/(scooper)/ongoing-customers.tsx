import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { ScooperOngoingCustomer, ScooperOngoingCustomerSummary } from '@/lib/api/types';
import { parseDateInput } from '@/lib/dates';

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  TWICE_WEEKLY: 'Twice weekly',
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
  ONE_TIME: 'One-time',
};

const parseDateValue = (value: string) => {
  return parseDateInput(value);
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return 'Next visit not scheduled';
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return 'Next visit not scheduled';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatWindowLabel = (
  preferredTimeWindow?: string | null,
  preferredTimeWindowSlug?: string | null,
) => {
  if (preferredTimeWindow) return preferredTimeWindow;
  const slug = preferredTimeWindowSlug?.toLowerCase() ?? '';
  if (slug.includes('morning')) return 'Morning';
  if (slug.includes('afternoon')) return 'Afternoon';
  if (slug.includes('evening')) return 'Evening';
  if (slug.includes('flex')) return 'Flexible';
  return null;
};

export default function ScooperOngoingCustomers() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [customers, setCustomers] = useState<ScooperOngoingCustomer[]>([]);
  const [summary, setSummary] = useState<ScooperOngoingCustomerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ customers: ScooperOngoingCustomer[]; summary?: ScooperOngoingCustomerSummary }>(
        '/api/mobile/scooper/ongoing-customers',
        { token: session.token },
      );
      setCustomers(data.customers ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load ongoing customers.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const activeCustomers = useMemo(
    () => customers.filter((entry) => Boolean(entry.customer)),
    [customers],
  );
  const capacityPct = summary?.limit
    ? Math.min(100, Math.round((summary.currentCount / summary.limit) * 100))
    : 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Ongoing customers</Text>
          <Text style={[styles.title, { color: palette.text }]}>Your recurring routes</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Keep track of customers you&apos;ve accepted for ongoing service.
          </Text>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.helperText, { color: palette.muted }]}>Loading customers...</Text>
          </View>
        ) : null}
        {error ? (
          <Text style={[styles.helperText, { color: palette.danger }]}>{error}</Text>
        ) : null}

        {summary ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              Capacity {summary.currentCount} / {summary.limit}
            </Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              {summary.tier.name} tier capacity limit.
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${capacityPct}%`, backgroundColor: palette.tint },
                ]}
              />
            </View>
            {summary.nextTier ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Next tier: {summary.nextTier.name} raises your cap to {summary.nextTier.limit ?? summary.limit}{' '}
                ongoing customers • {summary.nextTier.pointsToNext ?? 0} points to go.
              </Text>
            ) : (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Need more capacity? Reach out to dispatch for a review.
              </Text>
            )}
          </View>
        ) : null}

        {!loading && !error && activeCustomers.length === 0 ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>No ongoing customers yet</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Accept an ongoing offer to build your recurring schedule.
            </Text>
          </View>
        ) : null}

        {activeCustomers.map((entry) => {
          if (!entry.customer) return null;
          const frequencyLabel = FREQUENCY_LABELS[entry.frequency] ?? entry.frequency;
          const nextVisitLabel = formatDateLabel(entry.nextVisitAt);
          const windowLabel = formatWindowLabel(
            entry.preferredTimeWindow,
            entry.preferredTimeWindowSlug,
          );
          const dogNames = entry.customer.dogs.map((dog) => dog.name).filter(Boolean);
          const addressLine = `${entry.customer.addressLine1}, ${entry.customer.city}`;

          return (
            <View
              key={entry.jobId}
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>{entry.customer.name}</Text>
                <View style={[styles.badge, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <Text style={[styles.badgeText, { color: palette.muted }]}>{frequencyLabel}</Text>
                </View>
              </View>
              <Text style={[styles.cardBody, { color: palette.muted }]}>{addressLine}</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                {nextVisitLabel}
                {windowLabel ? ` • ${windowLabel}` : ''}
              </Text>
              {dogNames.length ? (
                <View style={styles.tagRow}>
                  {dogNames.map((name) => (
                    <View
                      key={name}
                      style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}
                    >
                      <Text style={[styles.tagText, { color: palette.text }]}>{name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
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
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
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
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
