import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';

type EarningsHeroProps = {
  earnedAmountCents: number;
  pendingAmountCents: number;
  lifetimeEarnedCents?: number;
  tipsMonthCents?: number;
  payoutsEnabled: boolean;
  autoPayoutEnabled: boolean;
  palette: typeof Colors.light;
  colorScheme: 'light' | 'dark';
  onWithdraw: () => void;
  onSetupPayouts?: () => void;
  withdrawLoading?: boolean;
  withdrawDisabled?: boolean;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function EarningsHero({
  earnedAmountCents,
  pendingAmountCents,
  lifetimeEarnedCents = 0,
  tipsMonthCents = 0,
  payoutsEnabled,
  autoPayoutEnabled,
  palette,
  colorScheme,
  onWithdraw,
  onSetupPayouts,
  withdrawLoading = false,
  withdrawDisabled = false,
}: EarningsHeroProps) {
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle = colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;
  const heroBg = colorScheme === 'light' ? '#FFF8F5' : '#0F1729';
  const statBg = colorScheme === 'light' ? '#FFFFFF' : '#1A2438';

  const totalAvailable = earnedAmountCents;
  const canWithdraw = payoutsEnabled && earnedAmountCents > 0 && !withdrawDisabled;

  return (
    <View
      style={[
        styles.hero,
        cardShadowStyle,
        { backgroundColor: heroBg, borderColor: cardBorder },
      ]}
    >
      {/* Accent Bar */}
      <View style={[styles.accentBar, { backgroundColor: Colors.brand.mint }]} />

      {/* Main Balance */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceHeader}>
          <View style={[styles.iconCircle, { backgroundColor: `${Colors.brand.mint}22` }]}>
            <FontAwesome name="dollar" size={18} color={Colors.brand.mint} />
          </View>
          <View style={styles.balanceLabel}>
            <Text style={[styles.balanceLabelText, { color: palette.muted }]}>
              Available to withdraw
            </Text>
            {autoPayoutEnabled ? (
              <View style={[styles.autoBadge, { borderColor: Colors.brand.mint }]}>
                <FontAwesome name="refresh" size={8} color={Colors.brand.mint} />
                <Text style={[styles.autoBadgeText, { color: Colors.brand.mint }]}>
                  Auto
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text style={[styles.balanceValue, { color: palette.text }]}>
          {formatCents(totalAvailable)}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: statBg, borderColor: cardBorder }]}>
          <Text style={[styles.statLabel, { color: palette.muted }]}>Pending</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>
            {formatCents(pendingAmountCents)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: statBg, borderColor: cardBorder }]}>
          <Text style={[styles.statLabel, { color: palette.muted }]}>Lifetime</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>
            {formatCents(lifetimeEarnedCents)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: statBg, borderColor: cardBorder }]}>
          <Text style={[styles.statLabel, { color: palette.muted }]}>Tips (mo)</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>
            {formatCents(tipsMonthCents)}
          </Text>
        </View>
      </View>

      {/* Action Row */}
      <View style={styles.actionRow}>
        {payoutsEnabled ? (
          <Button
            title={withdrawLoading ? 'Requesting...' : 'Withdraw'}
            onPress={onWithdraw}
            disabled={!canWithdraw || withdrawLoading}
            variant="cta"
            style={styles.withdrawButton}
          />
        ) : onSetupPayouts ? (
          <Pressable
            onPress={onSetupPayouts}
            style={[styles.setupCard, { borderColor: Colors.brand.gold }]}
          >
            <View style={[styles.setupIcon, { backgroundColor: `${Colors.brand.gold}22` }]}>
              <FontAwesome name="bank" size={14} color={Colors.brand.evergreen} />
            </View>
            <View style={styles.setupText}>
              <Text style={[styles.setupTitle, { color: Colors.brand.evergreen }]}>
                Setup payouts
              </Text>
              <Text style={[styles.setupBody, { color: palette.muted }]}>
                Add bank account to withdraw
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color={palette.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: palette.muted }]}>
          Releases every Friday after QA approval
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardShadowDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  accentBar: {
    height: 4,
  },
  balanceSection: {
    padding: 20,
    paddingBottom: 16,
    gap: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  balanceLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  autoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    padding: 16,
    paddingTop: 16,
  },
  withdrawButton: {
    width: '100%',
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
    padding: 14,
    backgroundColor: 'rgba(255, 194, 77, 0.08)',
  },
  setupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupText: {
    flex: 1,
    gap: 2,
  },
  setupTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  setupBody: {
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 11,
  },
});
