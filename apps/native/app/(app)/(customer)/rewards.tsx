import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type {
  CustomerRewardItem,
  CustomerRewardRedemption,
  CustomerRewardsPayload,
} from '@/lib/api/types';

const COPY_EARN = 'Weekly check-ins, vet notes, and visit feedback all add to your Care Credits.';

type RewardsState = {
  balance: number;
  earnedPoints: number;
  spentPoints: number;
  nextReward?: CustomerRewardsPayload['nextReward'];
  items: CustomerRewardItem[];
  redemptions: CustomerRewardRedemption[];
};

export default function CustomerRewardsScreen() {
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
      const data = await apiRequest<CustomerRewardsPayload>('/api/mobile/customer/rewards', {
        token: session.token,
      });
      setState({
        balance: data.balance,
        earnedPoints: data.earnedPoints,
        spentPoints: data.spentPoints,
        nextReward: data.nextReward ?? null,
        items: data.items ?? [],
        redemptions: data.redemptions ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load Care Credits.';
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

  const handleRedeem = async (item: CustomerRewardItem) => {
    if (!session?.token || redeemingId) return;
    setRedeemingId(item.id);
    setError(null);
    try {
      const response = await apiRequest<{ balance: number; redemption: CustomerRewardRedemption }>(
        '/api/mobile/customer/rewards/redeem',
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
      const message = err instanceof Error ? err.message : 'Unable to redeem reward.';
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>LOYALTY REWARDS</Text>
          <Text style={[styles.title, { color: palette.text }]}>Care Credits</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Redeem credits for digital gift cards from your favorite brands.
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
            <Text style={styles.balanceLabel}>Care Credits</Text>
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
                {nextReward.remainingPoints} more credits needed
              </Text>
            </View>
          ) : !loading ? (
            <View style={styles.readyBadge}>
              <FontAwesome name="check-circle" size={14} color="#FFFFFF" />
              <Text style={styles.readyText}>Ready to redeem any reward</Text>
            </View>
          ) : null}
        </View>

        {/* Earn More Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="plus-circle" size={18} color={Colors.brand.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Earn more credits</Text>
          </View>
          <View style={styles.earnWays}>
            <View style={styles.earnWay}>
              <FontAwesome name="check-square" size={14} color={palette.tint} />
              <Text style={[styles.earnWayText, { color: palette.muted }]}>Weekly check-ins</Text>
            </View>
            <View style={styles.earnWay}>
              <FontAwesome name="pencil" size={14} color={palette.tint} />
              <Text style={[styles.earnWayText, { color: palette.muted }]}>Vet notes</Text>
            </View>
            <View style={styles.earnWay}>
              <FontAwesome name="star" size={14} color={palette.tint} />
              <Text style={[styles.earnWayText, { color: palette.muted }]}>Visit feedback</Text>
            </View>
          </View>
        </View>

        {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Redeem gift cards</Text>
          {state?.items?.length ? (
            state.items.map((item) => {
              const canRedeem = balance >= item.pointsCost;
              return (
                <View key={item.id} style={[styles.rewardRow, { borderColor: palette.border }]}>
                  <View style={styles.rewardInfo}>
                    <Text style={[styles.rewardName, { color: palette.text }]}>{item.name}</Text>
                    {item.description ? (
                      <Text style={[styles.cardBody, { color: palette.muted }]}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.rewardCost, { color: palette.muted }]}>
                      {item.pointsCost} credits
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
            <Text style={[styles.cardBody, { color: palette.muted }]}>No rewards yet.</Text>
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
                  {redemption.status} • {redemption.pointsCost} credits
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
  scrollContent: {
    padding: 20,
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
    backgroundColor: 'rgba(0,0,0,0.04)',
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
