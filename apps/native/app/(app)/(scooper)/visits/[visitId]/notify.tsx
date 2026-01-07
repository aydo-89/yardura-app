import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function NotifyStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const {
    steps,
    visitId,
    visit,
    summaryDraft,
    notificationChannel,
    setNotificationChannel,
    completing,
    completeError,
    payoutCents,
    completeVisit,
    getPreviousStep,
  } = useVisitFlow();

  useStepGuard('notify');

  const [showCelebration, setShowCelebration] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale = useRef(new Animated.Value(0.95)).current;

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'notify'),
    0,
  );

  const hasPhone = Boolean(visit?.customer?.phone);
  const hasEmail = Boolean(visit?.customer?.email);

  const handleBack = () => {
    const prev = getPreviousStep('notify');
    if (!prev) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${prev}`);
  };

  const handleComplete = async () => {
    const success = await completeVisit();
    if (success) {
      setShowCelebration(true);
    }
  };

  useEffect(() => {
    if (!showCelebration) return;
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(overlayScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace('/(app)/(scooper)');
    }, 3200);

    return () => clearTimeout(timer);
  }, [showCelebration, overlayOpacity, overlayScale]);

  const payoutLabel = useMemo(() => {
    if (typeof payoutCents !== 'number') return null;
    return `$${(payoutCents / 100).toFixed(2)}`;
  }, [payoutCents]);

  return (
    <Screen padded={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Button title="Back" onPress={handleBack} variant="ghost" />
          <Text style={[styles.stepLabel, { color: palette.muted }]}>
            Step {stepIndex + 1} of {steps.length || 1}
          </Text>
        </View>
        <Text style={[styles.title, { color: palette.text }]}>Notify & complete</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Send the wrap-up and mark the visit complete to unlock payout.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Delivery channel</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            We&apos;ll send the visit summary to the customer with media links.
          </Text>
          <View style={styles.rowWrap}>
            <ChoiceChip
              label="Text message"
              selected={notificationChannel === 'SMS'}
              onPress={() => setNotificationChannel('SMS')}
              disabled={!hasPhone}
            />
            <ChoiceChip
              label="Email"
              selected={notificationChannel === 'EMAIL'}
              onPress={() => setNotificationChannel('EMAIL')}
              disabled={!hasEmail}
            />
          </View>
          {!hasPhone && !hasEmail ? (
            <Text style={[styles.helperText, { color: palette.danger }]}>
              Customer contact info missing. Update their profile before completing.
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Summary preview</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Color: {summaryDraft.color || '—'}
          </Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Consistency: {summaryDraft.consistency || '—'}
          </Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Content: {summaryDraft.content || '—'}
          </Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Notes: {summaryDraft.observations || '—'}
          </Text>
          {summaryDraft.wellnessFlag ? (
            <Text style={[styles.cardBody, { color: palette.danger }]}>
              Wellness flag: {summaryDraft.flagReason || 'Flagged'}
            </Text>
          ) : (
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Wellness flag: None
            </Text>
          )}
        </View>

        {completeError ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>{completeError}</Text>
        ) : null}

        <Button
          title={completing ? 'Completing...' : 'Send & complete visit'}
          onPress={handleComplete}
          disabled={completing}
        />
      </ScrollView>

      {showCelebration ? (
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: palette.background },
            { opacity: overlayOpacity },
          ]}
        >
          <Animated.View
            style={[
              styles.celebrationCard,
              { backgroundColor: palette.card, borderColor: palette.border, transform: [{ scale: overlayScale }] },
            ]}
          >
            <Text style={[styles.celebrationTitle, { color: palette.text }]}>Visit complete!</Text>
            {payoutLabel ? (
              <Text style={[styles.celebrationPayout, { color: palette.tint }]}>
                {payoutLabel} earned
              </Text>
            ) : (
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Payout is processing.
              </Text>
            )}
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Nice work — we&apos;ll take it from here.
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  celebrationCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 10,
  },
  celebrationTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  celebrationPayout: {
    fontSize: 28,
    fontWeight: '800',
  },
});
