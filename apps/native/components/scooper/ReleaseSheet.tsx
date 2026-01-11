import { useState, useCallback } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const RELEASE_REASON_OPTIONS = [
  { key: 'schedule', label: 'Schedule conflict', icon: 'calendar' as const },
  { key: 'vehicle', label: 'Vehicle issue', icon: 'car' as const },
  { key: 'weather', label: 'Weather/safety', icon: 'cloud' as const },
  { key: 'access', label: 'Access issue', icon: 'lock' as const },
  { key: 'illness', label: 'Illness/emergency', icon: 'medkit' as const },
  { key: 'other', label: 'Other', icon: 'ellipsis-h' as const },
] as const;

type ReleaseReasonKey = (typeof RELEASE_REASON_OPTIONS)[number]['key'];

type ReleaseScope = 'visit' | 'job';

type ReleaseStep = 'scope' | 'reason' | 'confirm';

type ReleaseSheetProps = {
  visible: boolean;
  onClose: () => void;
  onRelease: (scope: ReleaseScope, reason: string) => Promise<void>;
  customerName?: string;
  frequency?: string | null;
  canReleaseJob: boolean;
  isJobOwnedByAnother?: boolean;
  isSameDay?: boolean;
  isLateRelease?: boolean;
  lateReleaseLabel?: string | null;
};

function formatFrequencyLabel(frequency?: string | null): string {
  if (!frequency) return 'recurring';
  return frequency.toLowerCase().replace(/_/g, ' ');
}

export default function ReleaseSheet({
  visible,
  onClose,
  onRelease,
  customerName,
  frequency,
  canReleaseJob,
  isJobOwnedByAnother = false,
  isSameDay = false,
  isLateRelease = false,
  lateReleaseLabel,
}: ReleaseSheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [step, setStep] = useState<ReleaseStep>('scope');
  const [scope, setScope] = useState<ReleaseScope>('visit');
  const [reasonKey, setReasonKey] = useState<ReleaseReasonKey | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frequencyLabel = formatFrequencyLabel(frequency);
  const isOneTime = frequency === 'ONE_TIME';
  const isOtherReason = reasonKey === 'other';

  const selectedReasonLabel =
    RELEASE_REASON_OPTIONS.find((opt) => opt.key === reasonKey)?.label ?? '';

  const reasonText = isOtherReason ? customReason.trim() : selectedReasonLabel;
  const reasonValid = Boolean(reasonKey) && (!isOtherReason || Boolean(customReason.trim()));

  const resetState = useCallback(() => {
    setStep('scope');
    setScope('visit');
    setReasonKey(null);
    setCustomReason('');
    setConfirmed(false);
    setError(null);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleScopeSelect = (selected: ReleaseScope) => {
    if (selected === 'job' && !canReleaseJob) return;
    setScope(selected);
    setStep('reason');
  };

  const handleReasonSelect = (key: ReleaseReasonKey) => {
    setReasonKey(key);
    if (key !== 'other') {
      setCustomReason('');
      setStep('confirm');
    }
  };

  const handleCustomReasonContinue = () => {
    if (customReason.trim()) {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setConfirmed(false);
      setStep('reason');
    } else if (step === 'reason') {
      setReasonKey(null);
      setCustomReason('');
      setStep('scope');
    }
  };

  const handleSubmit = async () => {
    if (isSameDay) {
      setError('Same-day releases are locked. Contact dispatch for help.');
      return;
    }
    if (!reasonValid) {
      setError('Please select a reason.');
      return;
    }
    if (!confirmed) {
      setError('Please confirm to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onRelease(scope, reasonText);
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to release. Try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const scopeLabel = scope === 'job' ? 'recurring job' : 'visit';

  // Step indicators
  const steps: { key: ReleaseStep; label: string }[] = [
    { key: 'scope', label: 'Scope' },
    { key: 'reason', label: 'Reason' },
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
              Release {customerName ? `${customerName}'s` : ''} {scopeLabel}
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
            {/* Same-day warning */}
            {isSameDay ? (
              <View style={[styles.alertBox, { backgroundColor: `${palette.danger}15` }]}>
                <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
                <Text style={[styles.alertText, { color: palette.danger }]}>
                  Same-day releases are locked. Contact dispatch.
                </Text>
              </View>
            ) : null}

            {/* Late release warning */}
            {!isSameDay && isLateRelease && lateReleaseLabel ? (
              <View style={[styles.alertBox, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="clock-o" size={16} color={Colors.brand.gold} />
                <Text style={[styles.alertText, { color: Colors.brand.gold }]}>
                  Late release window started {lateReleaseLabel}
                </Text>
              </View>
            ) : null}

            {/* STEP 1: Scope Selection */}
            {step === 'scope' ? (
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, { color: palette.text }]}>
                  What do you want to release?
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
                      Release just this scheduled stop
                    </Text>
                  </View>
                  <View style={[styles.scopeArrow, { backgroundColor: `${palette.tint}15` }]}>
                    <FontAwesome name="chevron-right" size={12} color={palette.tint} />
                  </View>
                </Pressable>

                {canReleaseJob ? (
                  <Pressable
                    onPress={() => handleScopeSelect('job')}
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
                        Entire {frequencyLabel} job
                      </Text>
                      <Text style={[styles.scopeDescription, { color: palette.muted }]}>
                        Release all upcoming visits from this route
                      </Text>
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
                        : isJobOwnedByAnother
                          ? 'This route is owned by another scooper'
                          : 'Only this visit can be released'}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* STEP 2: Reason Selection */}
            {step === 'reason' ? (
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, { color: palette.muted }]}>
                  Why are you releasing this {scopeLabel}?
                </Text>

                <View style={styles.reasonGrid}>
                  {RELEASE_REASON_OPTIONS.map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => handleReasonSelect(option.key)}
                      style={({ pressed }) => [
                        styles.reasonCard,
                        {
                          borderColor:
                            reasonKey === option.key ? palette.tint : palette.border,
                          backgroundColor:
                            reasonKey === option.key
                              ? `${palette.tint}10`
                              : palette.background,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <FontAwesome
                        name={option.icon}
                        size={18}
                        color={reasonKey === option.key ? palette.tint : palette.muted}
                      />
                      <Text
                        style={[
                          styles.reasonLabel,
                          {
                            color:
                              reasonKey === option.key ? palette.tint : palette.text,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {isOtherReason ? (
                  <View style={styles.customReasonContainer}>
                    <TextInput
                      value={customReason}
                      onChangeText={setCustomReason}
                      placeholder="Tell us what happened"
                      placeholderTextColor={palette.muted}
                      style={[
                        styles.customReasonInput,
                        { color: palette.text, borderColor: palette.border },
                      ]}
                      multiline
                      textAlignVertical="top"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <Button
                      title="Continue"
                      onPress={handleCustomReasonContinue}
                      disabled={!customReason.trim()}
                      style={styles.continueButton}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* STEP 3: Confirmation */}
            {step === 'confirm' ? (
              <View style={styles.stepContent}>
                {/* Summary */}
                <View style={[styles.summaryCard, { backgroundColor: palette.background }]}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                      Releasing
                    </Text>
                    <Text style={[styles.summaryValue, { color: palette.text }]}>
                      {scope === 'job' ? `${frequencyLabel} job` : 'This visit'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                      Reason
                    </Text>
                    <Text style={[styles.summaryValue, { color: palette.text }]}>
                      {reasonText}
                    </Text>
                  </View>
                </View>

                {/* Policy note */}
                <View style={[styles.policyBox, { backgroundColor: palette.background }]}>
                  <Text style={[styles.policyText, { color: palette.muted }]}>
                    3 missed visits/quarter pauses new offers. Late releases (48h) capped at 5/quarter.
                  </Text>
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
                        backgroundColor: palette.tint,
                        borderColor: palette.tint,
                      },
                    ]}
                  >
                    {confirmed ? (
                      <FontAwesome name="check" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text style={[styles.confirmText, { color: palette.text }]}>
                    I confirm I need to release this {scopeLabel} and understand the policy
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
                title={submitting ? 'Releasing...' : 'Release'}
                onPress={handleSubmit}
                disabled={!confirmed || submitting || isSameDay}
                style={[
                  styles.footerButton,
                  { backgroundColor: palette.danger, borderColor: palette.danger },
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
    minHeight: 520,
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
    gap: 24,
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
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderRadius: 16,
    padding: 18,
    minHeight: 80,
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
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reasonCard: {
    width: '31%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  customReasonContainer: {
    gap: 12,
  },
  customReasonInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
  },
  continueButton: {
    alignSelf: 'flex-end',
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
  policyBox: {
    borderRadius: 10,
    padding: 12,
  },
  policyText: {
    fontSize: 12,
    lineHeight: 18,
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
