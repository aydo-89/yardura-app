import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function NotifyStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const successTone = Colors.brand.mint;
  const warningTone = Colors.brand.gold;

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
  const [showSummary, setShowSummary] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale = useRef(new Animated.Value(0.9)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  const stepIndex = useMemo(
    () => Math.max(steps.findIndex((step) => step.id === 'notify'), 0),
    [steps],
  );

  const hasPhone = Boolean(visit?.customer?.phone);
  const hasEmail = Boolean(visit?.customer?.email);
  const customerName = visit?.customer?.name?.split(' ')[0] || 'Customer';

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
    Animated.sequence([
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(overlayScale, {
          toValue: 1,
          damping: 12,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(checkScale, {
        toValue: 1,
        damping: 8,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace('/(app)/(scooper)');
    }, 3500);

    return () => clearTimeout(timer);
  }, [showCelebration, overlayOpacity, overlayScale, checkScale]);

  const payoutLabel = useMemo(() => {
    if (typeof payoutCents !== 'number') return null;
    return `$${(payoutCents / 100).toFixed(2)}`;
  }, [payoutCents]);

  return (
    <>
      <VisitStepShell
        title="Complete visit"
        subtitle={`Send summary to ${customerName}`}
        stepIndex={stepIndex}
        stepCount={steps.length || 1}
        onBack={handleBack}
      >
        {/* Delivery Channel */}
        <View style={[styles.channelCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
          <View style={styles.channelHeader}>
            <View style={[styles.channelIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="send" size={18} color={palette.tint} />
            </View>
            <View style={styles.channelContent}>
              <Text style={[styles.channelTitle, { color: palette.text }]}>Delivery method</Text>
              <Text style={[styles.channelSubtitle, { color: palette.muted }]}>
                How should we notify {customerName}?
              </Text>
            </View>
          </View>

          <View style={styles.channelOptions}>
            <Pressable
              onPress={() => setNotificationChannel('SMS')}
              disabled={!hasPhone}
              style={({ pressed }) => [
                styles.channelOption,
                {
                  backgroundColor: notificationChannel === 'SMS' ? `${palette.tint}15` : palette.background,
                  borderColor: notificationChannel === 'SMS' ? palette.tint : cardBorder,
                  opacity: !hasPhone ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <FontAwesome
                name="comment"
                size={18}
                color={notificationChannel === 'SMS' ? palette.tint : palette.muted}
              />
              <View style={styles.channelOptionContent}>
                <Text
                  style={[
                    styles.channelOptionLabel,
                    { color: notificationChannel === 'SMS' ? palette.tint : palette.text },
                  ]}
                >
                  Text message
                </Text>
                <Text style={[styles.channelOptionHint, { color: palette.muted }]}>
                  {hasPhone ? 'Recommended' : 'No phone on file'}
                </Text>
              </View>
              {notificationChannel === 'SMS' ? (
                <View style={[styles.channelCheck, { backgroundColor: palette.tint }]}>
                  <FontAwesome name="check" size={10} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => setNotificationChannel('EMAIL')}
              disabled={!hasEmail}
              style={({ pressed }) => [
                styles.channelOption,
                {
                  backgroundColor: notificationChannel === 'EMAIL' ? `${palette.tint}15` : palette.background,
                  borderColor: notificationChannel === 'EMAIL' ? palette.tint : cardBorder,
                  opacity: !hasEmail ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <FontAwesome
                name="envelope"
                size={16}
                color={notificationChannel === 'EMAIL' ? palette.tint : palette.muted}
              />
              <View style={styles.channelOptionContent}>
                <Text
                  style={[
                    styles.channelOptionLabel,
                    { color: notificationChannel === 'EMAIL' ? palette.tint : palette.text },
                  ]}
                >
                  Email
                </Text>
                <Text style={[styles.channelOptionHint, { color: palette.muted }]}>
                  {hasEmail ? 'With photos' : 'No email on file'}
                </Text>
              </View>
              {notificationChannel === 'EMAIL' ? (
                <View style={[styles.channelCheck, { backgroundColor: palette.tint }]}>
                  <FontAwesome name="check" size={10} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          </View>

          {!hasPhone && !hasEmail ? (
            <View style={[styles.warningBanner, { backgroundColor: `${palette.danger}10` }]}>
              <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
              <Text style={[styles.warningText, { color: palette.danger }]}>
                No contact info available for this customer
              </Text>
            </View>
          ) : null}
        </View>

        {/* Summary Preview (Collapsible) */}
        <View style={styles.summarySection}>
          <Pressable
            onPress={() => setShowSummary(!showSummary)}
            style={[styles.summaryHeader, { backgroundColor: palette.card, borderColor: cardBorder }]}
          >
            <View style={[styles.summaryIcon, { backgroundColor: `${successTone}15` }]}>
              <FontAwesome name="file-text-o" size={16} color={successTone} />
            </View>
            <View style={styles.summaryHeaderContent}>
              <Text style={[styles.summaryTitle, { color: palette.text }]}>Summary preview</Text>
              <Text style={[styles.summarySubtitle, { color: palette.muted }]}>
                Tap to {showSummary ? 'hide' : 'review'} details
              </Text>
            </View>
            <FontAwesome
              name={showSummary ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={palette.muted}
            />
          </Pressable>

          {showSummary ? (
            <View style={[styles.summaryContent, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.muted }]}>Color</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {summaryDraft.color || '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.muted }]}>Consistency</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {summaryDraft.consistency || '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.muted }]}>Content</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {summaryDraft.content || '—'}
                </Text>
              </View>
              {summaryDraft.observations ? (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: palette.muted }]}>Notes</Text>
                  <Text style={[styles.summaryValue, { color: palette.text }]}>
                    {summaryDraft.observations}
                  </Text>
                </View>
              ) : null}
              {summaryDraft.wellnessFlag ? (
                <View style={[styles.flagBanner, { backgroundColor: `${warningTone}10` }]}>
                  <FontAwesome name="flag" size={12} color={warningTone} />
                  <Text style={[styles.flagText, { color: warningTone }]}>
                    {summaryDraft.flagReason || 'Wellness issue flagged'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {completeError ? (
          <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{completeError}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title={completing ? 'Completing...' : 'Complete visit'}
            onPress={handleComplete}
            variant="cta"
            disabled={completing || (!hasPhone && !hasEmail)}
            style={styles.ctaButton}
          />
          <Text style={[styles.footerHint, { color: palette.muted }]}>
            Summary will be sent and visit marked complete
          </Text>
        </View>
      </VisitStepShell>

      {/* Celebration Overlay */}
      {showCelebration ? (
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: palette.background, opacity: overlayOpacity },
          ]}
        >
          <Animated.View
            style={[
              styles.celebrationCard,
              { backgroundColor: palette.card, borderColor: cardBorder },
              { transform: [{ scale: overlayScale }] },
            ]}
          >
            <Animated.View
              style={[
                styles.celebrationCheck,
                { backgroundColor: successTone },
                { transform: [{ scale: checkScale }] },
              ]}
            >
              <FontAwesome name="check" size={32} color="#FFFFFF" />
            </Animated.View>
            <Text style={[styles.celebrationTitle, { color: palette.text }]}>Visit complete!</Text>
            {payoutLabel ? (
              <View style={[styles.payoutBadge, { backgroundColor: `${successTone}15` }]}>
                <Text style={[styles.payoutAmount, { color: successTone }]}>{payoutLabel}</Text>
                <Text style={[styles.payoutLabel, { color: successTone }]}>earned</Text>
              </View>
            ) : (
              <Text style={[styles.celebrationSubtitle, { color: palette.muted }]}>
                Payout is processing
              </Text>
            )}
            <Text style={[styles.celebrationMessage, { color: palette.muted }]}>
              Great job! On to the next one.
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  channelCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelContent: {
    flex: 1,
    gap: 2,
  },
  channelTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  channelSubtitle: {
    fontSize: 12,
  },
  channelOptions: {
    gap: 10,
  },
  channelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  channelOptionContent: {
    flex: 1,
    gap: 2,
  },
  channelOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  channelOptionHint: {
    fontSize: 11,
  },
  channelCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  warningText: {
    fontSize: 12,
    flex: 1,
  },
  summarySection: {
    gap: 0,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderContent: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  summarySubtitle: {
    fontSize: 12,
  },
  summaryContent: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 14,
    marginTop: -16,
    paddingTop: 20,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  flagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  flagText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  footer: {
    marginTop: 'auto',
    gap: 8,
  },
  ctaButton: {
    width: '100%',
  },
  footerHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  celebrationCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 320,
  },
  celebrationCheck: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  celebrationSubtitle: {
    fontSize: 14,
  },
  payoutBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  payoutAmount: {
    fontSize: 32,
    fontWeight: '800',
  },
  payoutLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  celebrationMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});
