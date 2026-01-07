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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: palette.text }]}>Rewards</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Check in daily, keep your streak, and redeem points for Amazon gift cards.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Points balance</Text>
          {loading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Loading rewards...
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.balanceValue, { color: palette.text }]}>
                {balance} points
              </Text>
              {nextReward ? (
                <>
                  <Text style={[styles.cardBody, { color: palette.muted }]}>
                    Next reward: {nextReward.name} (needs {nextReward.remainingPoints} more)
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progressPercent}%`, backgroundColor: palette.tint },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  You have enough points to redeem any reward.
                </Text>
              )}
              {state?.dailyCheck?.nextMilestone ? (
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  Next streak bonus at {state.dailyCheck.nextMilestone.days} days (+
                  {state.dailyCheck.nextMilestone.bonusPoints} points).
                </Text>
              ) : null}
            </>
          )}
        </View>

        {state?.tier ? (
          <View
            style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>Scooper tier</Text>
            <Text style={[styles.balanceValue, { color: palette.text }]}>
              {state.tier.name}
            </Text>
            {state.tier.perks?.length ? (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                {state.tier.perks.join(' • ')}
              </Text>
            ) : null}
            {state.tierProgress && state.nextTier ? (
              <>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  {state.tierProgress.pointsToNext} points to reach {state.nextTier.name}.
                </Text>
                <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(state.tierProgress.progressPct * 100)}%`,
                        backgroundColor: palette.tint,
                      },
                    ]}
                  />
                </View>
              </>
            ) : (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                You’re at the top tier. Keep earning to stay there.
              </Text>
            )}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Earn more points</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Daily check-ins are the fastest way to grow your balance. Keep your streak alive
            for bonus boosts.
          </Text>
          <Button
            title="Go to daily check-in"
            onPress={() => router.push('/(app)/(scooper)/daily-check')}
            variant="secondary"
          />
        </View>

        {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Redeem gift cards</Text>
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
              No rewards yet. Check back soon.
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Recent redemptions</Text>
          {state?.redemptions?.length ? (
            state.redemptions.map((redemption) => (
              <View key={redemption.id} style={styles.redemptionRow}>
                <Text style={[styles.rewardName, { color: palette.text }]}>
                  {redemption.rewardItem.name}
                </Text>
                <Text style={[styles.cardBody, { color: palette.muted }]}>
                  {redemption.status} • {redemption.pointsCost} points
                </Text>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  rewardRow: {
    borderWidth: 1,
    borderRadius: 16,
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
    gap: 4,
    paddingVertical: 6,
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
