import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { ScooperPayoutDetail } from '@/lib/api/types';
import { parseDateInput } from '@/lib/dates';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PENDING_REVIEW: 'Pending',
  READY: 'Earned',
  RELEASED: 'Paid',
  CLEARED: 'Paid',
  CANCELLED: 'Cancelled',
};

export default function ScooperPayoutDetailScreen() {
  const { payoutId } = useLocalSearchParams<{ payoutId: string }>();
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const [detail, setDetail] = useState<ScooperPayoutDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token || !payoutId) return;
    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<ScooperPayoutDetail>(
          `/api/mobile/scooper/earnings/${payoutId}`,
          { token: session.token },
        );
        setDetail(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load payout details.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [session?.token, payoutId]);

  const formatCents = (value: number) => {
    const abs = Math.abs(value);
    const dollars = (abs / 100).toFixed(2);
    return value < 0 ? `-$${dollars}` : `$${dollars}`;
  };

  const breakdownRows = useMemo(() => {
    if (!detail) return [];
    return [
      { label: 'Base payout', value: detail.baseAmountCents },
      { label: 'Bonus', value: detail.bonusAmountCents },
      { label: 'Mileage', value: detail.mileageAmountCents },
      { label: 'PPE', value: detail.ppeAmountCents },
      { label: 'Tips', value: detail.tipsAmountCents },
      { label: 'Adjustments', value: detail.adjustmentsCents },
    ];
  }, [detail]);

  const statusLabel = detail
    ? STATUS_LABELS[detail.status] ?? detail.status
    : null;
  const visitDate = detail?.serviceVisit?.scheduledDate
    ? parseDateInput(detail.serviceVisit.scheduledDate).toLocaleDateString()
    : null;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Button title="Back to earnings" onPress={() => router.back()} variant="ghost" />
          <Text style={[styles.kicker, { color: palette.muted }]}>Payout details</Text>
          <Text style={[styles.title, { color: palette.text }]}>Payment breakdown</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Review the exact payout components for this visit.
          </Text>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading payout...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
        ) : detail ? (
          <>
            <View
              style={[
                styles.card,
                cardShadowStyle,
                { backgroundColor: palette.card, borderColor: cardBorder },
              ]}
            >
              <View style={styles.rowBetween}>
                <View>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    {detail.serviceVisit?.customer?.name ?? 'Customer'}
                  </Text>
                  {visitDate ? (
                    <Text style={[styles.cardBody, { color: palette.muted }]}>{visitDate}</Text>
                  ) : null}
                </View>
                {statusLabel ? (
                  <View style={[styles.statusPill, { backgroundColor: palette.tint }]}>
                    <Text style={styles.statusPillText}>{statusLabel}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.amountText, { color: palette.text }]}>
                {formatCents(detail.totalAmountCents)}
              </Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>
                Generated {new Date(detail.generatedAt).toLocaleString()}
              </Text>
            </View>

            <View
              style={[
                styles.card,
                cardShadowStyle,
                { backgroundColor: palette.card, borderColor: cardBorder },
              ]}
            >
              <Text style={[styles.cardTitle, { color: palette.text }]}>Breakdown</Text>
              {breakdownRows.map((row) => (
                <View key={row.label} style={styles.rowBetween}>
                  <Text style={[styles.cardBody, { color: palette.text }]}>{row.label}</Text>
                  <Text style={[styles.cardBody, { color: palette.text }]}>
                    {formatCents(row.value)}
                  </Text>
                </View>
              ))}
              <View style={[styles.totalRow, { borderTopColor: palette.border }]}>
                <Text style={[styles.totalLabel, { color: palette.text }]}>Total</Text>
                <Text style={[styles.totalValue, { color: palette.text }]}>
                  {formatCents(detail.totalAmountCents)}
                </Text>
              </View>
            </View>

            {(detail.milesDriven || detail.minutesOnSite) ? (
              <View
                style={[
                  styles.card,
                  cardShadowStyle,
                  { backgroundColor: palette.card, borderColor: cardBorder },
                ]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>Visit metrics</Text>
                {detail.milesDriven ? (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardBody, { color: palette.text }]}>Miles driven</Text>
                    <Text style={[styles.cardBody, { color: palette.text }]}>
                      {detail.milesDriven.toFixed(1)} mi
                    </Text>
                  </View>
                ) : null}
                {detail.minutesOnSite ? (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardBody, { color: palette.text }]}>Minutes on site</Text>
                    <Text style={[styles.cardBody, { color: palette.text }]}>
                      {detail.minutesOnSite} min
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {detail.serviceVisit?.tile || detail.serviceVisit?.customer ? (
              <View
                style={[
                  styles.card,
                  cardShadowStyle,
                  { backgroundColor: palette.card, borderColor: cardBorder },
                ]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>Visit info</Text>
                {detail.serviceVisit?.tile?.name ? (
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Tile: {detail.serviceVisit.tile.name}
                  </Text>
                ) : null}
                {detail.serviceVisit?.customer?.addressLine1 ? (
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    {detail.serviceVisit.customer.addressLine1}
                    {detail.serviceVisit.customer.city
                      ? `, ${detail.serviceVisit.customer.city}`
                      : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {detail.notes ? (
              <View
                style={[
                  styles.card,
                  cardShadowStyle,
                  { backgroundColor: palette.card, borderColor: cardBorder },
                ]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>Notes</Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  {detail.notes}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: 18,
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 10,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 12,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '700',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});
