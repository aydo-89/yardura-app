import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { CustomerSummary } from '@/lib/api/types';
import { REVENUECAT_API_KEYS } from '@/lib/config';

export default function WellnessUpgradeScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [summary, setSummary] = useState<CustomerSummary | null>(null);

  const loadAccess = useCallback(async () => {
    if (!session?.token) return;
    const data = await apiRequest<CustomerSummary>('/api/mobile/customer/summary', {
      token: session.token,
    });
    setSummary(data);
  }, [session?.token]);

  useEffect(() => {
    loadAccess().catch(() => null);
  }, [loadAccess]);

  const access = summary?.wellnessAccess;
  const isScooping = access?.hasActiveService ?? false;
  const isPremium =
    access?.tier === 'PREMIUM' || access?.source === 'SERVICE_PROMO';
  const isIos = Platform.OS === 'ios';
  const activePlan = isScooping ? 'SCOOPING' : isPremium ? 'PREMIUM' : 'FREE';
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [availablePackage, setAvailablePackage] = useState<PurchasesPackage | null>(null);
  const revenueCatKey = isIos ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
  const revenueCatReady =
    Boolean(revenueCatKey) && (__DEV__ || !revenueCatKey?.startsWith('test_'));

  const openBilling = async () => {
    if (!session?.token) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const data = await apiRequest<{ checkoutUrl?: string; portalUrl?: string }>(
        '/api/mobile/customer/wellness-subscription',
        { method: 'POST', token: session.token },
      );
      const target = data.portalUrl || data.checkoutUrl;
      if (target) {
        await WebBrowser.openBrowserAsync(target);
      } else {
        setCheckoutError('Unable to start checkout.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start checkout.';
      setCheckoutError(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openSubscriptionSettings = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => null);
  };

  const handleRestorePurchases = async () => {
    if (!revenueCatReady) {
      setCheckoutError('In-app purchases are not configured yet.');
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      await Purchases.restorePurchases();
      await loadAccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to restore purchases.';
      setCheckoutError(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const loadOfferings = useCallback(async () => {
    if (!isIos || !revenueCatReady) return;
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      const packageOption = current?.monthly ?? current?.availablePackages?.[0] ?? null;
      setAvailablePackage(packageOption);
    } catch (err) {
      setCheckoutError('Unable to load subscription options.');
      setAvailablePackage(null);
    }
  }, [isIos, revenueCatReady]);

  useEffect(() => {
    loadOfferings().catch(() => null);
  }, [loadOfferings]);

  const handlePurchase = async () => {
    if (!availablePackage) {
      setCheckoutError('No premium plan is available right now.');
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      await Purchases.purchasePackage(availablePackage);
      await loadAccess();
    } catch (err) {
      const cancelled =
        typeof err === 'object' &&
        err !== null &&
        'userCancelled' in err &&
        Boolean((err as { userCancelled?: boolean }).userCancelled);
      if (!cancelled) {
        const message = err instanceof Error ? err.message : 'Unable to complete purchase.';
        setCheckoutError(message);
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePremiumPress = async () => {
    if (isIos) {
      if (activePlan === 'PREMIUM') {
        openSubscriptionSettings();
        return;
      }
      if (!revenueCatReady) {
        setCheckoutError('In-app purchases are not configured yet.');
        return;
      }
      await handlePurchase();
      return;
    }
    await openBilling();
  };

  const openScooping = () => {
    Linking.openURL('https://www.getinsightscoop.com/quote?businessId=yardura').catch(() => null);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Wellness plans</Text>
          <Text style={[styles.title, { color: palette.text }]}>Choose your wellness path</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Compare free, premium, and pro-assisted options.
          </Text>
        </View>

        <View style={styles.cardStack}>
          <View
            style={[
              styles.planCard,
              {
                borderColor: activePlan === 'FREE' ? Colors.brand.mint : palette.border,
                backgroundColor: palette.card,
              },
            ]}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planTitle, { color: palette.text }]}>Start Free</Text>
                <Text style={[styles.planMeta, { color: palette.muted }]}>Included for every owner</Text>
              </View>
              {activePlan === 'FREE' ? (
                <Text style={[styles.planBadge, { color: palette.muted }]}>Current</Text>
              ) : null}
            </View>
            <Text style={[styles.planBody, { color: palette.muted }]}>
              5 stool scans + hydration/firmness scores monthly, 12 chats, reminders, food log, and stool library.
            </Text>
            <Button
              title={activePlan === 'FREE' ? 'Current plan' : 'Start Free'}
              onPress={() => router.push('/(app)/(customer)/capture' as any)}
              variant="secondary"
              disabled={activePlan === 'FREE'}
            />
          </View>

          <View
            style={[
              styles.planCard,
              {
                borderColor: activePlan === 'PREMIUM' ? Colors.brand.mint : palette.border,
                backgroundColor: palette.card,
              },
            ]}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planTitle, { color: palette.text }]}>Premium Wellness</Text>
                <Text style={[styles.planMeta, { color: palette.muted }]}>$19.99 / month</Text>
              </View>
              <View style={styles.planBadgeRow}>
                <FontAwesome name="star" size={18} color={Colors.brand.mint} />
                {activePlan === 'PREMIUM' ? (
                  <Text style={[styles.planBadge, { color: palette.muted }]}>Current</Text>
                ) : activePlan === 'SCOOPING' ? (
                  <Text style={[styles.planBadge, { color: palette.muted }]}>Included</Text>
                ) : null}
              </View>
            </View>
            <Text style={[styles.planBody, { color: palette.muted }]}>
              Unlimited scans + chat, long-term trends, early warnings, multi-dog households, family sharing, and GPS
              walk tracking.
            </Text>
            <Button
              title={
                activePlan === 'PREMIUM'
                  ? checkoutLoading
                    ? 'Opening subscription...'
                    : isIos
                      ? 'Manage subscription'
                      : 'Manage subscription'
                  : activePlan === 'SCOOPING'
                    ? 'Included with scooping'
                    : checkoutLoading
                      ? 'Starting upgrade...'
                      : 'Upgrade to Premium'
              }
              onPress={handlePremiumPress}
              disabled={activePlan === 'SCOOPING' || checkoutLoading}
            />
            {isIos && activePlan !== 'SCOOPING' ? (
              <Button
                title={checkoutLoading ? 'Restoring...' : 'Restore purchases'}
                onPress={handleRestorePurchases}
                variant="ghost"
                disabled={checkoutLoading || !revenueCatReady}
              />
            ) : null}
            {checkoutError ? (
              <Text style={[styles.helperText, { color: palette.danger }]}>{checkoutError}</Text>
            ) : null}
            {isIos ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Subscriptions are billed through the App Store and can be managed anytime.
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.planCard,
              {
                borderColor: activePlan === 'SCOOPING' ? Colors.brand.mint : palette.border,
                backgroundColor: palette.card,
              },
            ]}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planTitle, { color: palette.text }]}>Scooping + Pro Wellness</Text>
                <Text style={[styles.planMeta, { color: palette.muted }]}>Clean yard + pro insights</Text>
              </View>
              <View style={styles.planBadgeRow}>
                <FontAwesome name="shield" size={18} color={Colors.brand.mint} />
                {activePlan === 'SCOOPING' ? (
                  <Text style={[styles.planBadge, { color: palette.muted }]}>Current</Text>
                ) : null}
              </View>
            </View>
            <Text style={[styles.planBody, { color: palette.muted }]}>
              Reliable weekly pickup keeps the yard clean, with auto-captured scans, consistent angles,
              and a pro-verified timeline for your vet.
            </Text>
            <Button
              title={activePlan === 'SCOOPING' ? 'Current plan' : 'See Scooping Plans'}
              onPress={openScooping}
              disabled={activePlan === 'SCOOPING'}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>DIY vs Pro-assisted wellness</Text>
          <View style={styles.compareGrid}>
            <View style={[styles.compareCard, { borderColor: palette.border }]}>
              <Text style={[styles.compareTitle, { color: palette.muted }]}>DIY wellness</Text>
              <Text style={[styles.compareBody, { color: palette.text }]}>Owner captures when you remember</Text>
              <Text style={[styles.compareBody, { color: palette.text }]}>Yard cleanup is on you</Text>
            </View>
            <View style={[styles.compareCard, { borderColor: palette.border }]}>
              <Text style={[styles.compareTitle, { color: palette.muted }]}>Pro-assisted</Text>
              <Text style={[styles.compareBody, { color: palette.text }]}>Scheduled pickups keep the yard clean</Text>
              <Text style={[styles.compareBody, { color: palette.text }]}>Auto-captures every visit</Text>
            </View>
          </View>
          {access?.planEndsAt ? (
            <Text style={[styles.helperText, { color: palette.muted }]}>
              Access through{' '}
              {new Date(access.planEndsAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          ) : null}
        </View>
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
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  cardStack: {
    gap: 12,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planMeta: {
    fontSize: 12,
  },
  planBody: {
    fontSize: 13,
  },
  planBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  compareGrid: {
    gap: 10,
  },
  compareCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  compareTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  compareBody: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 12,
  },
});
