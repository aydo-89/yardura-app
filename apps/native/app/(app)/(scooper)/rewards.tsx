import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type {
  ScooperRewardItem,
  ScooperRewardRedemption,
  ScooperRewardsPayload,
  ScooperRewardTier,
  ScooperTierProgress,
} from '@/lib/api/types';

type RewardsState = {
  balance: number;
  earnedPoints: number;
  spentPoints: number;
  nextReward?: ScooperRewardsPayload['nextReward'];
  dailyCheck: ScooperRewardsPayload['dailyCheck'];
  items: ScooperRewardItem[];
  redemptions: ScooperRewardRedemption[];
  tier?: ScooperRewardTier;
  nextTier?: ScooperRewardTier | null;
  tierProgress?: ScooperTierProgress;
};

export default function ScooperRewardsScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [state, setState] = useState<RewardsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRewards = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ScooperRewardsPayload>('/api/field-tech/rewards', {
        token: session.token,
      });
      setState({
        balance: data.balance,
        earnedPoints: data.earnedPoints,
        spentPoints: data.spentPoints,
        nextReward: data.nextReward ?? null,
        dailyCheck: data.dailyCheck,
        items: data.items ?? [],
        redemptions: data.redemptions ?? [],
        tier: data.tier,
        nextTier: data.nextTier ?? null,
        tierProgress: data.tierProgress ?? undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load rewards.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadRewards();
    }, [loadRewards]),
  );

  const handleRedeem = async (item: ScooperRewardItem) => {
    if (!session?.token || redeemingId) return;
    setRedeemingId(item.id);
    setError(null);
    try {
      const response = await apiRequest<{ balance: number; redemption: ScooperRewardRedemption }>(
        '/api/field-tech/rewards/redeem',
        {
          method: 'POST',
          token: session.token,
          body: { rewardItemId: item.id },
        },
      );
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: response.balance,
          spentPoints: prev.spentPoints + item.pointsCost,
          redemptions: [response.redemption, ...prev.redemptions],
        };
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to redeem reward.';
      setError(message);
    } finally {
      setRedeemingId(null);
    }
  };

  const balance = state?.balance ?? 0;
  const nextReward = state?.nextReward ?? null;
  const progressPercent =
    nextReward && nextReward.pointsCost > 0
      ? Math.min(100, Math.round((balance / nextReward.pointsCost) * 100))
      : 100;

  const tierProgressPct = state?.tierProgress
    ? Math.round(state.tierProgress.progressPct * 100)
    : 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>SCOOPER REWARDS</Text>
          <Text style={[styles.title, { color: palette.text }]}>Points</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Check in daily, keep your streak, and redeem points for Amazon gift cards.
          </Text>
        </View>

        {/* Balance Hero Card */}
        <View style={[styles.balanceCard, { backgroundColor: palette.tint }]}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceIconWrap}>
              <FontAwesome name="star" size={24} color="#FFFFFF" />
            </View>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.balanceValue}>{balance}</Text>
            )}
            <Text style={styles.balanceLabel}>Points</Text>
          </View>

          {!loading && nextReward ? (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Next reward: {nextReward.name}</Text>
                <Text style={styles.progressValue}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                {nextReward.remainingPoints} more points needed
              </Text>
            </View>
          ) : !loading ? (
            <View style={styles.readyBadge}>
              <FontAwesome name="check-circle" size={14} color="#FFFFFF" />
              <Text style={styles.readyText}>Ready to redeem any reward</Text>
            </View>
          ) : null}

          {!loading && state?.dailyCheck?.nextMilestone ? (
            <View style={styles.streakBadge}>
              <FontAwesome name="fire" size={12} color="#FFFFFF" />
              <Text style={styles.streakText}>
                Next bonus at {state.dailyCheck.nextMilestone.days} days (+{state.dailyCheck.nextMilestone.bonusPoints} pts)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tier Card */}
        {state?.tier ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="trophy" size={18} color={Colors.brand.gold} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Scooper Tier</Text>
                <Text style={[styles.tierName, { color: palette.tint }]}>{state.tier.name}</Text>
              </View>
            </View>
            {state.tier.perks?.length ? (
              <View style={styles.perksList}>
                {state.tier.perks.map((perk, index) => (
                  <View key={index} style={styles.perkItem}>
                    <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                    <Text style={[styles.perkText, { color: palette.muted }]}>{perk}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {state.tierProgress && state.nextTier ? (
              <View style={styles.tierProgress}>
                <View style={styles.tierProgressHeader}>
                  <Text style={[styles.tierProgressLabel, { color: palette.muted }]}>
                    Progress to {state.nextTier.name}
                  </Text>
                  <Text style={[styles.tierProgressValue, { color: palette.text }]}>
                    {tierProgressPct}%
                  </Text>
                </View>
                <View style={[styles.tierProgressTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.tierProgressFill,
                      { width: `${tierProgressPct}%`, backgroundColor: palette.tint },
                    ]}
                  />
                </View>
                <Text style={[styles.tierProgressHint, { color: palette.muted }]}>
                  {state.tierProgress.pointsToNext} points to go
                </Text>
              </View>
            ) : (
              <View style={[styles.topTierBadge, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="star" size={12} color={Colors.brand.gold} />
                <Text style={[styles.topTierText, { color: Colors.brand.gold }]}>
                  Top tier reached
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Earn More Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="plus-circle" size={18} color={palette.tint} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Earn more points</Text>
          </View>
          <View style={styles.earnWays}>
            <View style={[styles.earnWay, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
              <FontAwesome name="calendar-check-o" size={14} color={palette.tint} />
              <Text style={[styles.earnWayText, { color: palette.muted }]}>Daily check-ins</Text>
            </View>
            <View style={[styles.earnWay, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
              <FontAwesome name="fire" size={14} color={Colors.brand.gold} />
              <Text style={[styles.earnWayText, { color: palette.muted }]}>Streak bonuses</Text>
            </View>
            <View style={[styles.earnWay, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
              <FontAwesome name="paw" size={14} color={palette.tint} />
              <Text style={[styles.earnWayText, { color: palette.muted }]}>Completed visits</Text>
            </View>
          </View>
          <Button
            title="Go to daily check-in"
            onPress={() => router.push('/(app)/(scooper)/daily-check')}
            variant="secondary"
          />
        </View>

        {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

        {/* Redeem Gift Cards */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="gift" size={18} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Redeem gift cards</Text>
          </View>
          {state?.items?.length ? (
            state.items.map((item) => {
              const canRedeem = balance >= item.pointsCost;
              return (
                <View
                  key={item.id}
                  style={[styles.rewardRow, { borderColor: palette.border }]}
                >
                  <View style={styles.rewardInfo}>
                    <Text style={[styles.rewardName, { color: palette.text }]}>{item.name}</Text>
                    {item.description ? (
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.rewardCost, { color: palette.muted }]}>
                      {item.pointsCost} points
                    </Text>
                  </View>
                  <Button
                    title={canRedeem ? 'Redeem' : `Need ${item.pointsCost - balance}`}
                    onPress={() => handleRedeem(item)}
                    disabled={!canRedeem || redeemingId === item.id}
                    variant={canRedeem ? 'primary' : 'secondary'}
                  />
                </View>
              );
            })
          ) : (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              No rewards available yet. Check back soon.
            </Text>
          )}
        </View>

        {/* Recent Redemptions */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: `${palette.muted}15` }]}>
              <FontAwesome name="history" size={18} color={palette.muted} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Recent redemptions</Text>
          </View>
          {state?.redemptions?.length ? (
            state.redemptions.map((redemption) => (
              <View key={redemption.id} style={styles.redemptionRow}>
                <View style={styles.redemptionInfo}>
                  <Text style={[styles.rewardName, { color: palette.text }]}>
                    {redemption.rewardItem.name}
                  </Text>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    {redemption.pointsCost} points
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        redemption.status === 'FULFILLED'
                          ? `${Colors.brand.mint}15`
                          : redemption.status === 'PENDING'
                            ? `${Colors.brand.gold}15`
                            : `${palette.muted}15`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          redemption.status === 'FULFILLED'
                            ? Colors.brand.mint
                            : redemption.status === 'PENDING'
                              ? Colors.brand.gold
                              : palette.muted,
                      },
                    ]}
                  >
                    {redemption.status.toLowerCase()}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Redemptions appear here after you request a reward.
            </Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    gap: 6,
    marginBottom: 20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  balanceHeader: {
    alignItems: 'center',
    gap: 8,
  },
  balanceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  progressSection: {
    marginTop: 20,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  progressHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  readyBadge: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: 'center',
  },
  readyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  streakBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: 'center',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '800',
  },
  perksList: {
    gap: 8,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  perkText: {
    fontSize: 13,
  },
  tierProgress: {
    gap: 6,
    marginTop: 4,
  },
  tierProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierProgressLabel: {
    fontSize: 12,
  },
  tierProgressValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  tierProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  tierProgressFill: {
    height: 6,
    borderRadius: 3,
  },
  tierProgressHint: {
    fontSize: 11,
  },
  topTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  topTierText: {
    fontSize: 12,
    fontWeight: '600',
  },
  earnWays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  earnWay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  earnWayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rewardRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rewardInfo: {
    flex: 1,
    gap: 4,
  },
  rewardName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rewardCost: {
    fontSize: 12,
  },
  redemptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  redemptionInfo: {
    flex: 1,
    gap: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 12,
  },
});
