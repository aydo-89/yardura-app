import { useMemo } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function ConfirmStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const {
    steps,
    visitId,
    analyzedCount,
    analysisGoal,
    hasMetAnalysisMinimum,
    analysisPending,
    confirmChecklist,
    setConfirmChecklist,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  useStepGuard('confirm');

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'confirm'),
    0,
  );

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => {
    const prev = getPreviousStep('confirm');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('confirm');
    goToStep(next);
  };

  const confirmationsReady =
    confirmChecklist.allDeposits &&
    confirmChecklist.analyzedFresh &&
    confirmChecklist.finalSweep;
  const canContinue =
    confirmationsReady &&
    (hasMetAnalysisMinimum || confirmChecklist.insufficientSamples);
  const requiredSamples = analysisGoal > 0 ? analysisGoal : 1;
  const missingSamples = Math.max(requiredSamples - analyzedCount, 0);
  const showAnalysisAlert =
    confirmationsReady &&
    !hasMetAnalysisMinimum &&
    !confirmChecklist.insufficientSamples;

  const analysisStatus = useMemo(() => {
    if (analysisGoal === 0) return 'Analyze at least one fresh sample.';
    return `Analyzed ${analyzedCount} of ${analysisGoal} goal.`;
  }, [analysisGoal, analyzedCount]);

  return (
    <VisitStepShell
      title="Confirm yard is clear"
      subtitle="Verify the yard is clear and the best samples are analyzed."
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Every deposit removed</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>Walk the full yard, including corners.</Text>
          </View>
          <Switch
            value={confirmChecklist.allDeposits}
            onValueChange={(value) => setConfirmChecklist({ allDeposits: value })}
          />
        </View>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Fresh samples analyzed</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>{analysisStatus}</Text>
          </View>
          <Switch
            value={confirmChecklist.analyzedFresh}
            onValueChange={(value) => setConfirmChecklist({ analyzedFresh: value })}
          />
        </View>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Final sweep complete</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>Confirm nothing was missed.</Text>
          </View>
          <Switch
            value={confirmChecklist.finalSweep}
            onValueChange={(value) => setConfirmChecklist({ finalSweep: value })}
          />
        </View>
      </View>

      <Text style={[styles.noticeText, { color: palette.muted }]}>
        Quality assurance review applies to every visit. Missed deposits, skipped sanitation, or
        invalid proof photos can require a return trip and may reduce payout for the visit (up to 50%)
        or result in removal from routes or the platform.
      </Text>

      {showAnalysisAlert ? (
        <View style={[styles.alert, { borderColor: palette.danger, backgroundColor: palette.card }]}>
          <Text style={[styles.alertTitle, { color: palette.danger }]}>
            More samples needed
          </Text>
          <Text style={[styles.alertBody, { color: palette.text }]}>
            Analyze {missingSamples} more fresh sample{missingSamples === 1 ? '' : 's'} before completing
            the yard confirmation.
          </Text>
        </View>
      ) : null}
      {!hasMetAnalysisMinimum ? (
        <View style={[styles.alert, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <View style={styles.rowBetween}>
            <View style={styles.rowText}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Not enough samples today</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>
                Confirm there were not enough fresh samples to meet the goal. This may require a return visit.
              </Text>
            </View>
            <Switch
              value={confirmChecklist.insufficientSamples}
              onValueChange={(value) =>
                setConfirmChecklist({
                  insufficientSamples: value,
                  insufficientSamplesNote: value ? confirmChecklist.insufficientSamplesNote : '',
                })
              }
            />
          </View>
          {confirmChecklist.insufficientSamples ? (
            <TextInput
              value={confirmChecklist.insufficientSamplesNote}
              onChangeText={(value) => setConfirmChecklist({ insufficientSamplesNote: value })}
              placeholder="Optional note about what you found"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />
          ) : null}
        </View>
      ) : null}
      {analysisPending ? (
        <Text style={[styles.pendingText, { color: palette.muted }]}>
          Analysis is still running. Counts will update automatically.
        </Text>
      ) : null}

      <Button
        title="Continue to next step"
        onPress={handleNext}
        disabled={!canContinue}
        variant="cta"
      />
      {!hasMetAnalysisMinimum && !confirmChecklist.insufficientSamples ? (
        <Text style={[styles.helperText, { color: palette.muted }]}
        >
          Analyze at least {analysisGoal || 1} fresh sample before continuing.
        </Text>
      ) : null}
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginTop: 10,
  },
  helperText: {
    fontSize: 12,
  },
  pendingText: {
    fontSize: 12,
    marginTop: 6,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  alert: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertBody: {
    fontSize: 12,
    lineHeight: 16,
  },
});
