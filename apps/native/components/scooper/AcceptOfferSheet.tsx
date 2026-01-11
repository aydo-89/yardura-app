import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type AcceptScope = 'visit' | 'ongoing';

type AcceptStep = 'scope' | 'confirm';

type AcceptOfferSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAccept: (scope: AcceptScope) => Promise<void>;
  customerName?: string;
  frequency?: string | null;
  payoutLabel?: string;
  recurringEstimate?: string | null;
  dateLabel?: string;
  canAcceptOngoing: boolean;
};

function formatFrequencyLabel(frequency?: string | null): string {
  if (!frequency) return 'recurring';
  switch (frequency) {
    case 'TWICE_WEEKLY':
      return 'twice weekly';
    case 'DAILY':
      return 'daily';
    case 'WEEKLY':
      return 'weekly';
    case 'BI_WEEKLY':
      return 'bi-weekly';
    case 'MONTHLY':
      return 'monthly';
    case 'ONE_TIME':
      return 'one-time';
    default:
      return frequency.toLowerCase().replace(/_/g, ' ');
  }
}

export default function AcceptOfferSheet({
  visible,
  onClose,
  onAccept,
  customerName,
  frequency,
  payoutLabel,
  recurringEstimate,
  dateLabel,
  canAcceptOngoing,
}: AcceptOfferSheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [step, setStep] = useState<AcceptStep>('scope');
  const [scope, setScope] = useState<AcceptScope>('visit');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frequencyLabel = formatFrequencyLabel(frequency);
  const isOneTime = frequency === 'ONE_TIME';

  const resetState = useCallback(() => {
    setStep('scope');
    setScope('visit');
    setConfirmed(false);
    setError(null);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleScopeSelect = (selected: AcceptScope) => {
    if (selected === 'ongoing' && !canAcceptOngoing) return;
    setScope(selected);
    setStep('confirm');
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setConfirmed(false);
      setStep('scope');
    }
  };

  const handleSubmit = async () => {
    if (!confirmed) {
      setError('Please confirm to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onAccept(scope);
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to accept. Try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const scopeLabel = scope === 'ongoing' ? 'ongoing job' : 'visit';

  // Step indicators
  const steps: { key: AcceptStep; label: string }[] = [
    { key: 'scope', label: 'Scope' },
    { key: 'confirm', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: palette.card }]}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: palette.border }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>
              Accept {customerName ? `${customerName}'s` : ''} offer
            </Text>

            {/* Progress indicators */}
            <View style={styles.progressRow}>
              {steps.map((s, index) => (
                <View key={s.key} style={styles.progressItem}>
                  <View
                    style={[
                      styles.progressDot,
                      {
                        backgroundColor:
                          index < currentStepIndex
                            ? Colors.brand.mint
                            : index === currentStepIndex
                              ? palette.tint
                              : palette.border,
                      },
                    ]}
                  >
                    {index < currentStepIndex ? (
                      <FontAwesome name="check" size={10} color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.progressNumber,
                          {
                            color:
                              index === currentStepIndex ? '#FFFFFF' : palette.muted,
                          },
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      {
                        color: index <= currentStepIndex ? palette.text : palette.muted,
                      },
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* STEP 1: Scope Selection */}
            {step === 'scope' ? (
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, { color: palette.text }]}>
                  What do you want to accept?
                </Text>
                <Text style={[styles.stepHint, { color: palette.muted }]}>
                  Tap an option to continue
                </Text>

                <Pressable
                  onPress={() => handleScopeSelect('visit')}
                  style={({ pressed }) => [
                    styles.scopeCard,
                    { borderColor: palette.tint, backgroundColor: palette.background },
                    pressed && { opacity: 0.8, backgroundColor: `${palette.tint}10` },
                  ]}
                >
                  <View style={[styles.scopeIcon, { backgroundColor: `${palette.tint}15` }]}>
                    <FontAwesome name="calendar-o" size={20} color={palette.tint} />
                  </View>
                  <View style={styles.scopeText}>
                    <Text style={[styles.scopeTitle, { color: palette.text }]}>
                      This visit only
                    </Text>
                    <Text style={[styles.scopeDescription, { color: palette.muted }]}>
                      Accept just {dateLabel || 'this scheduled stop'}
                    </Text>
                    {payoutLabel ? (
                      <Text style={[styles.scopePayout, { color: Colors.brand.mint }]}>
                        {payoutLabel} this visit
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.scopeArrow, { backgroundColor: `${palette.tint}15` }]}>
                    <FontAwesome name="chevron-right" size={12} color={palette.tint} />
                  </View>
                </Pressable>

                {canAcceptOngoing ? (
                  <Pressable
                    onPress={() => handleScopeSelect('ongoing')}
                    style={({ pressed }) => [
                      styles.scopeCard,
                      { borderColor: Colors.brand.mint, backgroundColor: palette.background },
                      pressed && { opacity: 0.8, backgroundColor: `${Colors.brand.mint}10` },
                    ]}
                  >
                    <View style={[styles.scopeIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
                      <FontAwesome name="repeat" size={18} color={Colors.brand.mint} />
                    </View>
                    <View style={styles.scopeText}>
                      <Text style={[styles.scopeTitle, { color: palette.text }]}>
                        Accept ongoing ({frequencyLabel})
                      </Text>
                      <Text style={[styles.scopeDescription, { color: palette.muted }]}>
                        Add this {frequencyLabel} job to your regular route
                      </Text>
                      {recurringEstimate ? (
                        <Text style={[styles.scopePayout, { color: Colors.brand.mint }]}>
                          Est. {recurringEstimate}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.scopeArrow, { backgroundColor: `${Colors.brand.mint}15` }]}>
                      <FontAwesome name="chevron-right" size={12} color={Colors.brand.mint} />
                    </View>
                  </Pressable>
                ) : (
                  <View style={[styles.infoBox, { backgroundColor: palette.background }]}>
                    <FontAwesome name="info-circle" size={14} color={palette.muted} />
                    <Text style={[styles.infoText, { color: palette.muted }]}>
                      {isOneTime
                        ? 'This is a one-time visit'
                        : 'Ongoing acceptance not available for this offer'}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* STEP 2: Confirmation */}
            {step === 'confirm' ? (
              <View style={styles.stepContent}>
                {/* Summary */}
                <View style={[styles.summaryCard, { backgroundColor: palette.background }]}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                      Accepting
                    </Text>
                    <Text style={[styles.summaryValue, { color: palette.text }]}>
                      {scope === 'ongoing' ? `${frequencyLabel} job` : 'This visit only'}
                    </Text>
                  </View>
                  {customerName ? (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                        Customer
                      </Text>
                      <Text style={[styles.summaryValue, { color: palette.text }]}>
                        {customerName}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                      Est. earnings
                    </Text>
                    <Text style={[styles.summaryValue, { color: Colors.brand.mint }]}>
                      {scope === 'ongoing' && recurringEstimate
                        ? recurringEstimate
                        : payoutLabel || '—'}
                    </Text>
                  </View>
                </View>

                {/* Expectations */}
                <View style={[styles.expectationsCard, { backgroundColor: `${palette.tint}08`, borderColor: palette.border }]}>
                  <Text style={[styles.expectationsTitle, { color: palette.text }]}>
                    {scope === 'ongoing' ? 'By accepting ongoing:' : 'By accepting this visit:'}
                  </Text>
                  {scope === 'ongoing' ? (
                    <View style={styles.expectationsList}>
                      <View style={styles.expectationItem}>
                        <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                        <Text style={[styles.expectationText, { color: palette.muted }]}>
                          This job will be added to your regular route
                        </Text>
                      </View>
                      <View style={styles.expectationItem}>
                        <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                        <Text style={[styles.expectationText, { color: palette.muted }]}>
                          Future visits will auto-schedule to your calendar
                        </Text>
                      </View>
                      <View style={styles.expectationItem}>
                        <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                        <Text style={[styles.expectationText, { color: palette.muted }]}>
                          You commit to the {frequencyLabel} cadence
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.expectationsList}>
                      <View style={styles.expectationItem}>
                        <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                        <Text style={[styles.expectationText, { color: palette.muted }]}>
                          You'll complete this single visit on {dateLabel || 'the scheduled date'}
                        </Text>
                      </View>
                      <View style={styles.expectationItem}>
                        <FontAwesome name="info-circle" size={12} color={palette.muted} />
                        <Text style={[styles.expectationText, { color: palette.muted }]}>
                          Future visits will remain open for you or others
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Single confirmation */}
                <Pressable
                  onPress={() => setConfirmed(!confirmed)}
                  style={styles.confirmRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: palette.border },
                      confirmed && {
                        backgroundColor: Colors.brand.mint,
                        borderColor: Colors.brand.mint,
                      },
                    ]}
                  >
                    {confirmed ? (
                      <FontAwesome name="check" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text style={[styles.confirmText, { color: palette.text }]}>
                    I confirm I want to accept this {scopeLabel} and understand the expectations
                  </Text>
                </Pressable>

                {error ? (
                  <View style={[styles.errorBox, { borderColor: palette.danger }]}>
                    <Text style={[styles.errorText, { color: palette.danger }]}>
                      {error}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            {step !== 'scope' ? (
              <Button
                title="Back"
                variant="secondary"
                onPress={handleBack}
                style={styles.footerButton}
              />
            ) : (
              <Button
                title="Cancel"
                variant="secondary"
                onPress={handleClose}
                style={styles.footerButton}
              />
            )}

            {step === 'confirm' ? (
              <Button
                title={submitting ? 'Accepting...' : 'Accept'}
                onPress={handleSubmit}
                disabled={!confirmed || submitting}
                style={[
                  styles.footerButton,
                  { backgroundColor: Colors.brand.mint, borderColor: Colors.brand.mint },
                ]}
                labelStyle={{ color: '#FFFFFF' }}
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 480,
    maxHeight: '92%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  progressItem: {
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContent: {
    gap: 16,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepHint: {
    fontSize: 13,
    marginBottom: 8,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    minHeight: 88,
  },
  scopeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeText: {
    flex: 1,
    gap: 4,
  },
  scopeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  scopeDescription: {
    fontSize: 13,
  },
  scopePayout: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  scopeArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  expectationsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  expectationsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  expectationsList: {
    gap: 8,
  },
  expectationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  expectationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  confirmText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
});
