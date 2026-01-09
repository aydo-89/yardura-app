import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { ScooperPayoutDetail } from '@/lib/api/types';
import { parseDateInput } from '@/lib/dates';

type BreakdownIcon = 'money' | 'star' | 'car' | 'shield' | 'heart' | 'exchange';

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
      { label: 'Base payout', value: detail.baseAmountCents, icon: 'money' as BreakdownIcon, color: palette.tint },
      { label: 'Bonus', value: detail.bonusAmountCents, icon: 'star' as BreakdownIcon, color: Colors.brand.gold },
      { label: 'Mileage', value: detail.mileageAmountCents, icon: 'car' as BreakdownIcon, color: palette.muted },
      { label: 'PPE', value: detail.ppeAmountCents, icon: 'shield' as BreakdownIcon, color: palette.muted },
      { label: 'Tips', value: detail.tipsAmountCents, icon: 'heart' as BreakdownIcon, color: Colors.brand.mint },
      { label: 'Adjustments', value: detail.adjustmentsCents, icon: 'exchange' as BreakdownIcon, color: palette.muted },
    ].filter((row) => row.value !== 0);
  }, [detail, palette.tint, palette.muted]);

  const statusLabel = detail
    ? STATUS_LABELS[detail.status] ?? detail.status
    : null;
  const visitDate = detail?.serviceVisit?.scheduledDate
    ? parseDateInput(detail.serviceVisit.scheduledDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const resolveStatusTone = (status: string) => {
    switch (status) {
      case 'READY':
        return { bg: Colors.brand.mint, text: '#FFFFFF' };
      case 'PENDING':
      case 'PENDING_REVIEW':
        return { bg: Colors.brand.gold, text: Colors.brand.graphite };
      case 'RELEASED':
      case 'CLEARED':
        return { bg: palette.tint, text: '#FFFFFF' };
      case 'CANCELLED':
        return { bg: palette.danger, text: '#FFFFFF' };
      default:
        return { bg: palette.tint, text: '#FFFFFF' };
    }
  };

  const statusTone = detail ? resolveStatusTone(detail.status) : null;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header with back button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={14} color={palette.tint} />
          <Text style={[styles.backText, { color: palette.tint }]}>Earnings</Text>
        </Pressable>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading payout...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: `${palette.danger}15`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={20} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : detail ? (
          <>
            {/* Hero Card with Total */}
            <View style={[styles.heroCard, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <View style={[styles.heroGlow, { backgroundColor: palette.tint }]} />
              <View style={styles.heroHeader}>
                <View style={styles.heroMeta}>
                  <Text style={[styles.heroCustomer, { color: palette.text }]}>
                    {detail.serviceVisit?.customer?.name ?? 'Customer'}
                  </Text>
                  {visitDate ? (
                    <Text style={[styles.heroDate, { color: palette.muted }]}>{visitDate}</Text>
                  ) : null}
                </View>
                {statusLabel && statusTone ? (
                  <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
                    <Text style={[styles.statusPillText, { color: statusTone.text }]}>{statusLabel}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.heroAmount, { color: palette.text }]}>
                {formatCents(detail.totalAmountCents)}
              </Text>
              <Text style={[styles.heroGenerated, { color: palette.muted }]}>
                Generated {new Date(detail.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>

            {/* Breakdown Card */}
            <View style={[styles.breakdownCard, cardShadowStyle, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Breakdown</Text>
              {breakdownRows.map((row) => (
                <View key={row.label} style={styles.breakdownRow}>
                  <View style={styles.breakdownLabel}>
                    <View style={[styles.breakdownIcon, { backgroundColor: `${row.color}15` }]}>
                      <FontAwesome name={row.icon} size={12} color={row.color} />
                    </View>
                    <Text style={[styles.breakdownText, { color: palette.text }]}>{row.label}</Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: row.value > 0 ? Colors.brand.mint : palette.text }]}>
                    {row.value > 0 ? '+' : ''}{formatCents(row.value)}
                  </Text>
                </View>
              ))}
              <View style={[styles.totalRow, { borderTopColor: palette.border }]}>
                <Text style={[styles.totalLabel, { color: palette.text }]}>Total earned</Text>
                <Text style={[styles.totalValue, { color: palette.text }]}>
                  {formatCents(detail.totalAmountCents)}
                </Text>
              </View>
            </View>

            {/* Metrics Card */}
            {(detail.milesDriven || detail.minutesOnSite) ? (
              <View style={[styles.metricsCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
                {detail.milesDriven ? (
                  <View style={styles.metricItem}>
                    <View style={[styles.metricIcon, { backgroundColor: `${palette.tint}15` }]}>
                      <FontAwesome name="road" size={14} color={palette.tint} />
                    </View>
                    <View>
                      <Text style={[styles.metricValue, { color: palette.text }]}>
                        {detail.milesDriven.toFixed(1)} mi
                      </Text>
                      <Text style={[styles.metricLabel, { color: palette.muted }]}>Driven</Text>
                    </View>
                  </View>
                ) : null}
                {detail.minutesOnSite ? (
                  <View style={styles.metricItem}>
                    <View style={[styles.metricIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
                      <FontAwesome name="clock-o" size={14} color={Colors.brand.mint} />
                    </View>
                    <View>
                      <Text style={[styles.metricValue, { color: palette.text }]}>
                        {detail.minutesOnSite} min
                      </Text>
                      <Text style={[styles.metricLabel, { color: palette.muted }]}>On site</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Visit Info Card */}
            {(detail.serviceVisit?.tile || detail.serviceVisit?.customer?.addressLine1) ? (
              <View style={[styles.infoCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
                <View style={[styles.infoIcon, { backgroundColor: `${palette.muted}20` }]}>
                  <FontAwesome name="map-marker" size={14} color={palette.muted} />
                </View>
                <View style={styles.infoCopy}>
                  {detail.serviceVisit?.tile?.name ? (
                    <Text style={[styles.infoTitle, { color: palette.text }]}>
                      {detail.serviceVisit.tile.name}
                    </Text>
                  ) : null}
                  {detail.serviceVisit?.customer?.addressLine1 ? (
                    <Text style={[styles.infoSubtitle, { color: palette.muted }]}>
                      {detail.serviceVisit.customer.addressLine1}
                      {detail.serviceVisit.customer.city ? `, ${detail.serviceVisit.customer.city}` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Notes Card */}
            {detail.notes ? (
              <View style={[styles.notesCard, { backgroundColor: `${palette.tint}08`, borderColor: palette.border }]}>
                <FontAwesome name="file-text-o" size={14} color={palette.muted} />
                <Text style={[styles.notesText, { color: palette.muted }]}>{detail.notes}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
    gap: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 150,
    opacity: 0.12,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroMeta: {
    flex: 1,
    gap: 4,
  },
  heroCustomer: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroDate: {
    fontSize: 13,
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '800',
    marginTop: 4,
  },
  heroGenerated: {
    fontSize: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  breakdownCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownText: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricsCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 24,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 11,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoSubtitle: {
    fontSize: 12,
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
});
