import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Switch from '@/components/ui/ThemedSwitch';
import EarningsHero from '@/components/scooper/EarningsHero';
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
  const [activeTab, setActiveTab] = useState<'history' | 'withdrawals'>('history');
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

  // Muted, subtle status tones instead of bright colors
  const resolveStatusTone = (status: ScooperPayout['status']) => {
    switch (status) {
      case 'READY':
        return { background: `${Colors.brand.mint}20`, text: Colors.brand.mint };
      case 'PENDING':
      case 'PENDING_REVIEW':
        return { background: `${Colors.brand.gold}20`, text: Colors.brand.gold };
      case 'RELEASED':
      case 'CLEARED':
        return { background: `${palette.tint}20`, text: palette.tint };
      case 'CANCELLED':
        return { background: `${palette.danger}20`, text: palette.danger };
      default:
        return { background: `${palette.muted}20`, text: palette.muted };
    }
  };

  const resolveRequestTone = (status: ScooperWithdrawalRequest['status']) => {
    const normalized = status.toUpperCase();
    switch (normalized) {
      case 'REQUESTED':
        return { background: `${Colors.brand.evergreen}20`, text: Colors.brand.evergreen };
      case 'PENDING':
      case 'IN_REVIEW':
        return { background: `${Colors.brand.gold}20`, text: Colors.brand.gold };
      case 'APPROVED':
      case 'READY':
        return { background: `${Colors.brand.mint}20`, text: Colors.brand.mint };
      case 'PAID':
      case 'RELEASED':
      case 'CLEARED':
        return { background: `${palette.tint}20`, text: palette.tint };
      case 'REJECTED':
      case 'CANCELLED':
        return { background: `${palette.danger}20`, text: palette.danger };
      default:
        return { background: `${palette.muted}20`, text: palette.muted };
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
      return 'Add a bank account or debit card via Stripe Express to receive payouts.';
    }
    if (payoutAccount.payoutsEnabled) {
      return 'Weekly payouts release every Friday once visits are approved.';
    }
    if (payoutAccount.detailsSubmitted) {
      return 'Stripe is verifying your details. We will release payouts once enabled.';
    }
    return 'Finish Stripe Express onboarding to enable payouts.';
  }, [payoutAccount]);

  const payoutHelper = useMemo(() => {
    if (payoutAccount?.payoutsEnabled) {
      return 'Manage your payout method in Stripe Express.';
    }
    return 'You will be taken to Stripe Express. If asked to sign in, use the email on your scooper profile.';
  }, [payoutAccount]);

  const payoutActionLabel = useMemo(() => {
    if (payoutLinkLoading) return 'Opening Stripe...';
    if (!payoutAccount?.accountId) return 'Set up in Stripe Express';
    if (payoutAccount.payoutsEnabled) return 'Update in Stripe Express';
    if (payoutAccount.detailsSubmitted) return 'Check Stripe status';
    return 'Finish in Stripe Express';
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

        {/* Payout Method Card - Compact when enabled, expanded when setup needed */}
        {payoutReady ? (
          <View
            style={[
              styles.payoutCompactCard,
              cardShadowStyle,
              { backgroundColor: palette.card, borderColor: cardBorder },
            ]}
          >
            <View style={[styles.payoutCompactIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="check-circle" size={16} color={Colors.brand.mint} />
            </View>
            <View style={styles.payoutCompactMeta}>
              <Text style={[styles.payoutCompactTitle, { color: palette.text }]}>Payouts enabled</Text>
              <Text style={[styles.payoutCompactSubtitle, { color: palette.muted }]}>
                Weekly releases • Fridays
              </Text>
            </View>
            <Pressable
              onPress={handlePayoutSetup}
              disabled={payoutLinkLoading}
              style={({ pressed }) => [
                styles.payoutCompactAction,
                { backgroundColor: pressed ? `${palette.tint}15` : 'transparent' },
              ]}
            >
              <Text style={[styles.payoutCompactActionText, { color: palette.tint }]}>
                {payoutLinkLoading ? 'Opening...' : 'Manage'}
              </Text>
            </Pressable>
          </View>
        ) : (
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
                <View style={[styles.payoutIcon, { backgroundColor: `${Colors.brand.gold}20` }]}>
                  <FontAwesome name="bank" size={16} color={Colors.brand.gold} />
                </View>
                <View style={styles.payoutCopy}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>Set up payouts</Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    {payoutLoading ? 'Loading...' : payoutMessage}
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
            <Button
              title={payoutActionLabel}
              onPress={handlePayoutSetup}
              disabled={payoutLoading || payoutLinkLoading}
              variant="cta"
            />
            {payoutError ? (
              <Text style={[styles.cardBody, { color: palette.danger }]}>{payoutError}</Text>
            ) : null}
          </View>
        )}

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.cardBody, { color: palette.muted }]}>Loading earnings...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.cardBody, { color: palette.danger }]}>{error}</Text>
        ) : summary ? (
          <>
            {/* Earnings Hero */}
            <EarningsHero
              earnedAmountCents={earnedAmountCents}
              pendingAmountCents={pendingAmountCents}
              lifetimeEarnedCents={summary.summary.lifetimeEarnedCents}
              tipsMonthCents={summary.summary.tipsMonthCents ?? 0}
              payoutsEnabled={payoutReady}
              autoPayoutEnabled={autoPayoutValue}
              palette={palette}
              colorScheme={colorScheme}
              onWithdraw={handleRequestWithdrawal}
              onSetupPayouts={!payoutReady ? handlePayoutSetup : undefined}
              withdrawLoading={requestLoading}
              withdrawDisabled={!canRequestWithdrawal}
            />

            {/* Auto Payout Toggle */}
            <View
              style={[
                styles.card,
                cardShadowStyle,
                { backgroundColor: palette.card, borderColor: cardBorder },
              ]}
            >
              <View style={styles.autoRow}>
                <View style={styles.autoCopy}>
                  <Text style={[styles.cardBody, { color: palette.text }]}>Auto cashout</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>
                    Release earned payouts every Friday
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
            </View>

            {/* Tab Bar */}
            <View style={styles.tabRow}>
              <ChoiceChip
                label={`History (${summary.payouts.length})`}
                selected={activeTab === 'history'}
                onPress={() => setActiveTab('history')}
              />
              <ChoiceChip
                label={`Withdrawals (${withdrawals.length})`}
                selected={activeTab === 'withdrawals'}
                onPress={() => setActiveTab('withdrawals')}
              />
            </View>

            {/* Withdrawals Tab */}
            {activeTab === 'withdrawals' ? (
              <>
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
                    <View style={styles.emptyState}>
                      <FontAwesome name="inbox" size={24} color={palette.muted} />
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        No withdrawal requests yet
                      </Text>
                    </View>
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
                              {request.payoutCount} payout{request.payoutCount === 1 ? '' : 's'} • {new Date(request.requestedAt).toLocaleDateString()}
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
                {withdrawalsError ? (
                  <Text style={[styles.cardBody, { color: palette.danger }]}>{withdrawalsError}</Text>
                ) : null}
              </>
            ) : null}

            {/* History Tab */}
            {activeTab === 'history' ? (
              summary.payouts.length === 0 ? (
                <View
                  style={[
                    styles.card,
                    cardShadowStyle,
                    { backgroundColor: palette.card, borderColor: cardBorder },
                  ]}
                >
                  <View style={styles.emptyState}>
                    <FontAwesome name="history" size={24} color={palette.muted} />
                    <Text style={[styles.cardBody, { color: palette.muted }]}>
                      Complete visits to start earning
                    </Text>
                  </View>
                </View>
              ) : (
                summary.payouts.map((payout) => {
                  const visitDate = payout.serviceVisit?.scheduledDate
                    ? parseDateInput(payout.serviceVisit.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Visit';
                  const customer = payout.serviceVisit?.customer?.name ?? 'Customer';
                  const statusLabel = STATUS_LABELS[payout.status] ?? payout.status;
                  const statusTone = resolveStatusTone(payout.status);
                  const hasTip = payout.tipsAmountCents > 0;
                  return (
                    <Pressable
                      key={payout.id}
                      onPress={() => router.push(`/(app)/(scooper)/earnings/${payout.id}`)}
                      style={({ pressed }) => [
                        styles.payoutItemCard,
                        cardShadowStyle,
                        { backgroundColor: palette.card, borderColor: cardBorder },
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <View style={styles.payoutItemHeader}>
                        <View style={[styles.payoutItemIcon, { backgroundColor: `${palette.tint}15` }]}>
                          <FontAwesome name="calendar-check-o" size={16} color={palette.tint} />
                        </View>
                        <View style={styles.payoutItemMeta}>
                          <Text style={[styles.payoutItemCustomer, { color: palette.text }]}>
                            {customer}
                          </Text>
                          <Text style={[styles.payoutItemDate, { color: palette.muted }]}>
                            {visitDate}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: statusTone.background }]}>
                          <Text style={[styles.statusPillText, { color: statusTone.text }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.payoutItemDivider, { backgroundColor: palette.border }]} />
                      <View style={styles.payoutItemFooter}>
                        <View style={styles.payoutItemAmounts}>
                          <Text style={[styles.payoutItemTotal, { color: palette.text }]}>
                            ${(payout.totalAmountCents / 100).toFixed(2)}
                          </Text>
                          {hasTip ? (
                            <View style={[styles.tipBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
                              <FontAwesome name="heart" size={10} color={Colors.brand.mint} />
                              <Text style={[styles.tipBadgeText, { color: Colors.brand.mint }]}>
                                +${(payout.tipsAmountCents / 100).toFixed(2)} tip
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.payoutItemCta}>
                          <Text style={[styles.detailCta, { color: palette.tint }]}>Details</Text>
                          <FontAwesome name="chevron-right" size={10} color={palette.tint} />
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )
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
  pageHeader: {
    gap: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
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
  payoutHelper: {
    fontSize: 11,
    lineHeight: 16,
  },
  payoutItemCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  payoutItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payoutItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutItemMeta: {
    flex: 1,
    gap: 2,
  },
  payoutItemCustomer: {
    fontSize: 15,
    fontWeight: '600',
  },
  payoutItemDate: {
    fontSize: 12,
  },
  payoutItemDivider: {
    height: 1,
    marginHorizontal: -14,
    marginVertical: 0,
  },
  payoutItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payoutItemAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payoutItemTotal: {
    fontSize: 20,
    fontWeight: '700',
  },
  tipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tipBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  payoutItemCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  payoutCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  payoutCompactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutCompactMeta: {
    flex: 1,
    gap: 2,
  },
  payoutCompactTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  payoutCompactSubtitle: {
    fontSize: 12,
  },
  payoutCompactAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payoutCompactActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
