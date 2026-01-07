import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import type {
  ScooperEarningsSummary,
  ScooperPayout,
  ScooperPayoutAccountStatus,
  ScooperSummary,
  ScooperWithdrawalRequest,
} from '@/lib/api/types';
import { parseDateInput } from '@/lib/dates';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PENDING_REVIEW: 'Pending review',
  READY: 'Earned',
  RELEASED: 'Paid',
  CLEARED: 'Paid',
  CANCELLED: 'Cancelled',
};

export default function ScooperEarnings() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle =
    colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const summaryBg = colorScheme === 'light' ? '#FFF3ED' : '#0B1220';
  const summaryStatBg = colorScheme === 'light' ? '#FFFFFF' : '#121A2D';
  const summaryStatBorder = colorScheme === 'light' ? '#F1E2D9' : '#1E293B';
  const [summary, setSummary] = useState<ScooperEarningsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [payoutAccount, setPayoutAccount] = useState<ScooperPayoutAccountStatus | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutLinkLoading, setPayoutLinkLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<ScooperWithdrawalRequest[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalsError, setWithdrawalsError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(true);
  const autoPayoutTrackOff = colorScheme === 'dark' ? '#334155' : '#CBD5E1';

  const loadEarnings = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ScooperEarningsSummary>(
        '/api/mobile/scooper/earnings?limit=10',
        { token: session.token },
      );
      setSummary(data);
      setAutoPayoutEnabled(data.summary.autoPayoutEnabled);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load earnings.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  const loadPayoutAccount = useCallback(async () => {
    if (!session?.token) return;
    setPayoutLoading(true);
    setPayoutError(null);
    try {
      const data = await apiRequest<ScooperPayoutAccountStatus>(
        '/api/mobile/scooper/payouts/account',
        { token: session.token },
      );
      setPayoutAccount(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load payout status.';
      setPayoutError(message);
    } finally {
      setPayoutLoading(false);
    }
  }, [session?.token]);

  const loadWithdrawals = useCallback(async () => {
    if (!session?.token) return;
    setWithdrawalsLoading(true);
    setWithdrawalsError(null);
    try {
      const data = await apiRequest<ScooperWithdrawalRequest[]>(
        '/api/mobile/scooper/payouts/requests?limit=5',
        { token: session.token },
      );
      setWithdrawals(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load withdrawals.';
      setWithdrawalsError(message);
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [session?.token]);

  const loadProfileStatus = useCallback(async () => {
    if (!session?.token) return;
    setStatusLoading(true);
    try {
      const data = await apiRequest<ScooperSummary>(
        '/api/mobile/scooper/summary',
        { token: session.token },
      );
      setProfileStatus(data.profileStatus ?? null);
      setBackgroundStatus(data.backgroundCheckStatus ?? null);
    } catch {
      setProfileStatus(null);
      setBackgroundStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadEarnings();
      loadPayoutAccount();
      loadWithdrawals();
      loadProfileStatus();
    }, [loadEarnings, loadPayoutAccount, loadWithdrawals, loadProfileStatus]),
  );

  const payoutLabel = useMemo(() => {
    if (!summary) return null;
    return {
      pending: (summary.summary.pendingReviewAmountCents / 100).toFixed(2),
      earned: (summary.summary.earnedAmountCents / 100).toFixed(2),
      paid: (summary.summary.monthPaidCents / 100).toFixed(2),
      lifetime: (summary.summary.lifetimeEarnedCents / 100).toFixed(2),
      tipsMonth: ((summary.summary.tipsMonthCents ?? 0) / 100).toFixed(2),
      tipsLifetime: ((summary.summary.tipsLifetimeCents ?? 0) / 100).toFixed(2),
    };
  }, [summary]);

  const pendingProfile =
    typeof profileStatus === 'string' && profileStatus !== 'CERTIFIED';
  const profileStatusLabel = profileStatus
    ? profileStatus.toLowerCase().replace(/_/g, ' ')
    : null;
  const backgroundStatusLabel = backgroundStatus
    ? backgroundStatus.toLowerCase().replace(/_/g, ' ')
    : null;

  const resolveStatusTone = (status: ScooperPayout['status']) => {
    switch (status) {
      case 'READY':
        return { background: Colors.brand.mint, text: '#FFFFFF' };
      case 'PENDING':
      case 'PENDING_REVIEW':
        return { background: Colors.brand.gold, text: Colors.brand.graphite };
      case 'RELEASED':
      case 'CLEARED':
        return { background: palette.tint, text: '#FFFFFF' };
      case 'CANCELLED':
        return { background: palette.danger, text: '#FFFFFF' };
      default:
        return { background: palette.tint, text: '#FFFFFF' };
    }
  };

  const resolveRequestTone = (status: ScooperWithdrawalRequest['status']) => {
    const normalized = status.toUpperCase();
    switch (normalized) {
      case 'REQUESTED':
        return { background: Colors.brand.evergreen, text: '#FFFFFF' };
      case 'PENDING':
      case 'IN_REVIEW':
        return { background: Colors.brand.gold, text: Colors.brand.graphite };
      case 'APPROVED':
      case 'READY':
        return { background: Colors.brand.mint, text: '#FFFFFF' };
      case 'PAID':
      case 'RELEASED':
      case 'CLEARED':
        return { background: palette.tint, text: '#FFFFFF' };
      case 'REJECTED':
      case 'CANCELLED':
        return { background: palette.danger, text: '#FFFFFF' };
      default:
        return { background: palette.tint, text: '#FFFFFF' };
    }
  };

  const payoutBadge = useMemo(() => {
    if (!payoutAccount?.accountId) {
      return { label: 'Setup needed', tone: Colors.brand.gold };
    }
    if (payoutAccount.payoutsEnabled) {
      return { label: 'Ready', tone: Colors.brand.mint };
    }
    if (payoutAccount.detailsSubmitted) {
      return { label: 'Verifying', tone: Colors.brand.gold };
    }
    return { label: 'Action needed', tone: Colors.brand.gold };
  }, [payoutAccount]);

  const earnedAmountCents = summary?.summary.earnedAmountCents ?? 0;
  const pendingAmountCents = summary?.summary.pendingReviewAmountCents ?? 0;
  const payoutReady = Boolean(payoutAccount?.payoutsEnabled);
  const autoPayoutLocked = !payoutAccount?.accountId || !payoutAccount.payoutsEnabled;
  const autoPayoutValue = autoPayoutLocked ? false : autoPayoutEnabled;
  const canRequestWithdrawal = payoutReady && earnedAmountCents > 0;

  const payoutMessage = useMemo(() => {
    if (!payoutAccount?.accountId) {
      return 'Add a bank account or debit card to receive weekly payouts.';
    }
    if (payoutAccount.payoutsEnabled) {
      return 'Weekly payouts release every Friday once visits are approved.';
    }
    if (payoutAccount.detailsSubmitted) {
      return 'Stripe is verifying your details. We will release payouts once enabled.';
    }
    return 'Finish Stripe onboarding to enable payouts.';
  }, [payoutAccount]);

  const payoutActionLabel = useMemo(() => {
    if (payoutLinkLoading) return 'Opening Stripe...';
    if (!payoutAccount?.accountId) return 'Set up payouts';
    if (payoutAccount.payoutsEnabled) return 'Update payout method';
    if (payoutAccount.detailsSubmitted) return 'Check verification';
    return 'Finish setup';
  }, [payoutAccount, payoutLinkLoading]);

  const resolvePayoutSetupError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        return 'Payout setup unlocks after your scooper profile is approved.';
      }
      const code = (err.details as { code?: string } | undefined)?.code;
      if (code === 'stripe_connect_unavailable') {
        return 'Stripe Connect is not enabled yet. Contact support to finish payout setup.';
      }
      if (code === 'stripe_unconfigured' || code === 'stripe_invalid_key') {
        return 'Payouts are not configured yet. Contact support to finish setup.';
      }
      const detailsError =
        typeof (err.details as { error?: string } | undefined)?.error === 'string'
          ? String((err.details as { error?: string }).error)
          : null;
      if (detailsError) {
        return detailsError;
      }
    }
    return err instanceof Error ? err.message : 'Unable to open payout setup.';
  };

  const handlePayoutSetup = useCallback(async () => {
    if (!session?.token || payoutLinkLoading) return;
    setPayoutLinkLoading(true);
    setPayoutError(null);
    try {
      const intent =
        payoutAccount?.accountId && payoutAccount.detailsSubmitted ? 'update' : 'onboarding';
      const response = await apiRequest<{ url: string }>(
        '/api/mobile/scooper/payouts/account',
        {
          token: session.token,
          method: 'POST',
          body: { intent },
        },
      );
      if (!response?.url) {
        throw new Error('Unable to start payout setup.');
      }
      try {
        await WebBrowser.openBrowserAsync(response.url);
      } catch {
        await Linking.openURL(response.url);
      }
    } catch (err) {
      setPayoutError(resolvePayoutSetupError(err));
    } finally {
      setPayoutLinkLoading(false);
    }
  }, [payoutAccount, payoutLinkLoading, session?.token]);

  const handleToggleAutoPayout = useCallback(
    async (nextValue: boolean) => {
      if (!session?.token || autoPayoutLocked) return;
      const previous = autoPayoutEnabled;
      setAutoPayoutEnabled(nextValue);
      try {
        await apiRequest<{ autoPayoutEnabled: boolean }>(
          '/api/mobile/scooper/payouts/settings',
          {
            token: session.token,
            method: 'PATCH',
            body: { autoPayoutEnabled: nextValue },
          },
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to update payout settings.';
        setPayoutError(message);
        setAutoPayoutEnabled(previous);
      }
    },
    [autoPayoutEnabled, autoPayoutLocked, session?.token],
  );

  const handleRequestWithdrawal = useCallback(async () => {
    if (!session?.token || requestLoading) return;
    setRequestLoading(true);
    setWithdrawalsError(null);
    try {
      await apiRequest<ScooperWithdrawalRequest>(
        '/api/mobile/scooper/payouts/requests',
        {
          token: session.token,
          method: 'POST',
        },
      );
      await Promise.all([loadWithdrawals(), loadEarnings()]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to request withdrawal.';
      setWithdrawalsError(message);
    } finally {
      setRequestLoading(false);
    }
  }, [loadEarnings, loadWithdrawals, requestLoading, session?.token]);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Earnings</Text>
          <Text style={[styles.title, { color: palette.text }]}>Payouts</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}
          >Track pending payouts and recent earnings.</Text>
        </View>

        {pendingProfile ? (
          <View
            style={[
              styles.card,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Profile under review</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Your application is {profileStatusLabel}. Payout tools unlock once you are certified.
            </Text>
            {backgroundStatusLabel ? (
              <Text style={[styles.cardMeta, { color: palette.muted }]}>
                Background check: {backgroundStatusLabel}
              </Text>
            ) : null}
            {statusLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Checking status...
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            cardShadowStyle,
            styles.payoutCard,
            { backgroundColor: palette.card, borderColor: cardBorder },
          ]}
        >
          <View style={styles.payoutRow}>
            <View style={styles.payoutTitleRow}>
              <View style={[styles.payoutIcon, { backgroundColor: palette.border }]}>
                <FontAwesome name="bank" size={16} color={palette.text} />
              </View>
              <View style={styles.payoutCopy}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Payout method</Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  {payoutLoading ? 'Loading payout status...' : payoutMessage}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.payoutBadge,
                { borderColor: payoutBadge.tone, backgroundColor: `${payoutBadge.tone}22` },
              ]}
            >
              <Text style={[styles.payoutBadgeText, { color: payoutBadge.tone }]}>
                {payoutBadge.label}
              </Text>
            </View>
          </View>
          <View style={styles.payoutActionRow}>
            <Text style={[styles.payoutMeta, { color: palette.muted }]}>
              Weekly releases • Friday
            </Text>
            <Button
              title={payoutActionLabel}
              onPress={handlePayoutSetup}
              disabled={payoutLoading || payoutLinkLoading}
              variant={payoutAccount?.payoutsEnabled ? 'secondary' : 'cta'}
              style={styles.payoutActionButton}
              labelStyle={styles.payoutActionLabel}
            />
          </View>
          {payoutError ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>{payoutError}</Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading earnings...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
        ) : summary ? (
          <>
            <View
              style={[
                styles.card,
                cardShadowStyle,
                styles.summaryCard,
                { backgroundColor: summaryBg },
              ]}
            >
              <View
                style={[styles.summaryAccent, { backgroundColor: palette.tint }]}
              />
              <View style={styles.summaryHeader}>
                <View style={[styles.summaryIconWrap, { backgroundColor: `${palette.tint}22` }]}>
                  <FontAwesome name="line-chart" size={16} color={palette.tint} />
                </View>
                <View style={styles.summaryHeaderCopy}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Earnings snapshot</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>
                    Updated {new Date(summary.generatedAt).toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryStats}>
                <View
                  style={[
                    styles.summaryStatCard,
                    { backgroundColor: summaryStatBg, borderColor: summaryStatBorder },
                  ]}
                >
                  <Text style={[styles.summaryStatLabel, { color: palette.muted }]}>
                    Pending review
                  </Text>
                  <Text style={[styles.summaryStatValue, { color: palette.text }]}>
                    ${payoutLabel?.pending ?? '—'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.summaryStatCard,
                    { backgroundColor: summaryStatBg, borderColor: summaryStatBorder },
                  ]}
                >
                  <Text style={[styles.summaryStatLabel, { color: palette.muted }]}>Earned</Text>
                  <Text style={[styles.summaryStatValue, { color: palette.text }]}>
                    ${payoutLabel?.earned ?? '—'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.summaryStatCard,
                    { backgroundColor: summaryStatBg, borderColor: summaryStatBorder },
                  ]}
                >
                  <Text style={[styles.summaryStatLabel, { color: palette.muted }]}>Paid this month</Text>
                  <Text style={[styles.summaryStatValue, { color: palette.text }]}>
                    ${payoutLabel?.paid ?? '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryFooter}>
                <Text style={[styles.summaryMeta, { color: palette.muted }]}>
                  Lifetime earned ${payoutLabel?.lifetime ?? '—'} • Tips ${payoutLabel?.tipsLifetime ?? '—'}
                </Text>
                <Text style={[styles.summaryMeta, { color: palette.muted }]}>
                  Tips this month ${payoutLabel?.tipsMonth ?? '—'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.card,
                cardShadowStyle,
                { backgroundColor: palette.card, borderColor: cardBorder },
              ]}
            >
              <View style={styles.rowBetween}>
                <View>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Earned balance</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Ready to withdraw after QA approval.
                  </Text>
                </View>
                <Text style={[styles.amountText, { color: palette.text }]}>
                  ${(earnedAmountCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.autoRow}>
                <View style={styles.autoCopy}>
                  <Text style={[styles.cardBody, { color: palette.text }]}>Auto cashout</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>
                    Release earned payouts every Friday.
                  </Text>
                </View>
                <Switch
                  value={autoPayoutValue}
                  onValueChange={handleToggleAutoPayout}
                  trackColor={{ false: autoPayoutTrackOff, true: Colors.brand.mint }}
                  ios_backgroundColor={autoPayoutTrackOff}
                  thumbColor={autoPayoutLocked ? palette.muted : '#FFFFFF'}
                  disabled={autoPayoutLocked}
                />
              </View>
              {autoPayoutLocked ? (
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Set up payouts to enable auto cashout.
                </Text>
              ) : null}
              <View style={styles.autoFooter}>
                <Text style={[styles.cardMeta, { color: palette.muted }]}>
                  Available: ${(earnedAmountCents / 100).toFixed(2)} • Pending review: ${(pendingAmountCents / 100).toFixed(2)}
                </Text>
                <Button
                  title={requestLoading ? 'Requesting...' : 'Request withdrawal'}
                  onPress={handleRequestWithdrawal}
                  disabled={!canRequestWithdrawal || requestLoading}
                  variant="secondary"
                  style={styles.requestButton}
                  labelStyle={styles.requestLabel}
                />
              </View>
              {!payoutReady ? (
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Add a payout method before requesting a withdrawal.
                </Text>
              ) : null}
              {withdrawalsError ? (
                <Text style={[styles.cardBody, { color: palette.danger }]}>{withdrawalsError}</Text>
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Withdrawal requests
              </Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
                Track requests submitted for approval.
              </Text>
            </View>
            {withdrawalsLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.cardBody, { color: palette.muted }]}>Loading requests...</Text>
              </View>
            ) : withdrawals.length === 0 ? (
              <View
                style={[
                  styles.card,
                  cardShadowStyle,
                  { backgroundColor: palette.card, borderColor: cardBorder },
                ]}
              >
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  No withdrawal requests yet.
                </Text>
              </View>
            ) : (
              withdrawals.map((request) => {
                const requestTone = resolveRequestTone(request.status);
                return (
                  <View
                    key={request.id}
                    style={[
                      styles.card,
                      cardShadowStyle,
                      { backgroundColor: palette.card, borderColor: cardBorder },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={[styles.cardTitle, { color: palette.text }]}>
                          ${(request.amountCents / 100).toFixed(2)}
                        </Text>
                        <Text style={[styles.cardBody, { color: palette.muted }]}>
                          {request.payoutCount} payout{request.payoutCount === 1 ? '' : 's'} • Requested {new Date(request.requestedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: requestTone.background }]}>
                        <Text style={[styles.statusPillText, { color: requestTone.text }]}>
                          {request.status
                            .split('_')
                            .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
                            .join(' ')}
                        </Text>
                      </View>
                    </View>
                    {request.paidAt ? (
                      <Text style={[styles.cardMeta, { color: palette.muted }]}>
                        Paid {new Date(request.paidAt).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}

            {summary.payouts.length === 0 ? (
              <View
                style={[
                  styles.card,
                  cardShadowStyle,
                  { backgroundColor: palette.card, borderColor: cardBorder },
                ]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>No payouts yet</Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}
                >Complete visits to start earning payouts.</Text>
              </View>
            ) : (
              summary.payouts.map((payout) => {
                const visitDate = payout.serviceVisit?.scheduledDate
                  ? parseDateInput(payout.serviceVisit.scheduledDate).toLocaleDateString()
                  : 'Visit';
                const customer = payout.serviceVisit?.customer?.name ?? 'Customer';
                const statusLabel = STATUS_LABELS[payout.status] ?? payout.status;
                const statusTone = resolveStatusTone(payout.status);
                return (
                  <Pressable
                    key={payout.id}
                    onPress={() =>
                      router.push(`/(app)/(scooper)/earnings/${payout.id}`)
                    }
                    style={({ pressed }) => [
                      styles.card,
                      cardShadowStyle,
                      { backgroundColor: palette.card, borderColor: cardBorder },
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={[styles.cardTitle, { color: palette.text }]}>
                          {customer}
                        </Text>
                        <Text style={[styles.cardBody, { color: palette.muted }]}
                        >{visitDate}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: statusTone.background }]}>
                        <Text style={[styles.statusPillText, { color: statusTone.text }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.amountText, { color: palette.text }]}>
                      ${(payout.totalAmountCents / 100).toFixed(2)}
                    </Text>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.cardMeta, { color: palette.muted }]}>
                        Includes base + bonuses + mileage
                        {payout.tipsAmountCents > 0
                          ? ` • Tip +$${(payout.tipsAmountCents / 100).toFixed(2)}`
                          : ''}
                        .
                      </Text>
                      <Text style={[styles.detailCta, { color: palette.tint }]}>Details</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
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
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 26,
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
  summaryCard: {
    borderWidth: 0,
    paddingTop: 20,
    overflow: 'hidden',
  },
  summaryAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
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
  detailCta: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderCopy: {
    flex: 1,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryStatCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  summaryStatLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryStatValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
  },
  summaryMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryFooter: {
    paddingTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  autoCopy: {
    flex: 1,
    gap: 4,
  },
  autoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  requestButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  requestLabel: {
    fontSize: 13,
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
    fontSize: 20,
    fontWeight: '700',
  },
  payoutCard: {
    gap: 12,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  payoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  payoutCopy: {
    flex: 1,
    gap: 4,
  },
  payoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  payoutBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  payoutActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  payoutMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  payoutActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  payoutActionLabel: {
    fontSize: 13,
  },
});
