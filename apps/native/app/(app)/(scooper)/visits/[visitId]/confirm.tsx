import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

type CheckKey = 'allDeposits' | 'analyzedFresh' | 'finalSweep';

type CheckItemConfig = {
  key: CheckKey;
  icon: string;
  title: string;
  description: string;
};

const CHECKLIST_ITEMS: CheckItemConfig[] = [
  {
    key: 'allDeposits',
    icon: 'check-circle',
    title: 'Every deposit removed',
    description: 'Walk the full yard, including corners',
  },
  {
    key: 'analyzedFresh',
    icon: 'flask',
    title: 'Fresh samples analyzed',
    description: 'Best samples captured for wellness',
  },
  {
    key: 'finalSweep',
    icon: 'search',
    title: 'Final sweep complete',
    description: 'Confirm nothing was missed',
  },
];

function AnimatedCheckCard({
  item,
  checked,
  detail,
  onToggle,
  palette,
  colorScheme,
}: {
  item: CheckItemConfig;
  checked: boolean;
  detail?: string;
  onToggle: () => void;
  palette: typeof Colors.light;
  colorScheme: 'light' | 'dark';
}) {
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const successTone = Colors.brand.mint;
  const scale = useSharedValue(1);
  const checkScale = useSharedValue(checked ? 1 : 0);

  const handlePress = useCallback(() => {
    if (!checked) {
      scale.value = withSequence(
        withSpring(0.97, { damping: 15 }),
        withSpring(1, { damping: 10 }),
      );
      checkScale.value = withSequence(
        withTiming(0, { duration: 50 }),
        withSpring(1.2, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12 }),
      );
    } else {
      checkScale.value = withTiming(0, { duration: 150 });
    }
    onToggle();
  }, [checked, onToggle, scale, checkScale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.checkCard,
          cardStyle,
          {
            backgroundColor: checked ? `${successTone}10` : palette.card,
            borderColor: checked ? successTone : cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: checked ? `${successTone}20` : `${palette.tint}15`,
            },
          ]}
        >
          <FontAwesome
            name={item.icon as 'check-circle'}
            size={18}
            color={checked ? successTone : palette.tint}
          />
        </View>
        <View style={styles.checkContent}>
          <Text style={[styles.checkTitle, { color: checked ? successTone : palette.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.checkDescription, { color: palette.muted }]}>
            {detail || item.description}
          </Text>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: checked ? successTone : cardBorder,
              backgroundColor: checked ? successTone : 'transparent',
            },
          ]}
        >
          <Animated.View style={checkStyle}>
            <FontAwesome name="check" size={12} color="#FFFFFF" />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function ConfirmStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;

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

  const [showInsufficientNote, setShowInsufficientNote] = useState(
    confirmChecklist.insufficientSamples,
  );

  useStepGuard('confirm');

  const stepIndex = useMemo(
    () => Math.max(steps.findIndex((step) => step.id === 'confirm'), 0),
    [steps],
  );

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => goToStep(getPreviousStep('confirm'));
  const handleNext = () => goToStep(getNextStep('confirm'));

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
    confirmationsReady && !hasMetAnalysisMinimum && !confirmChecklist.insufficientSamples;

  const checkedCount = [
    confirmChecklist.allDeposits,
    confirmChecklist.analyzedFresh,
    confirmChecklist.finalSweep,
  ].filter(Boolean).length;
  const progressPct = Math.round((checkedCount / CHECKLIST_ITEMS.length) * 100);

  const analysisDetail = useMemo(() => {
    if (analysisGoal === 0) return 'Analyze at least one fresh sample';
    return `${analyzedCount} of ${analysisGoal} analyzed`;
  }, [analysisGoal, analyzedCount]);

  return (
    <VisitStepShell
      title="Confirm yard is clear"
      subtitle="Verify yard completion and sample quality"
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      {/* Sample Badge */}
      <View style={[styles.sampleBadge, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <View style={[styles.sampleIcon, { backgroundColor: `${palette.tint}15` }]}>
          <FontAwesome name="flask" size={16} color={palette.tint} />
        </View>
        <View style={styles.sampleInfo}>
          <Text style={[styles.sampleCount, { color: palette.text }]}>
            {analyzedCount} of {requiredSamples}
          </Text>
          <Text style={[styles.sampleLabel, { color: palette.muted }]}>samples analyzed</Text>
        </View>
        {analysisPending ? (
          <View style={[styles.pendingBadge, { backgroundColor: `${palette.tint}20` }]}>
            <Text style={[styles.pendingText, { color: palette.tint }]}>Processing</Text>
          </View>
        ) : hasMetAnalysisMinimum ? (
          <View style={[styles.pendingBadge, { backgroundColor: `${Colors.brand.mint}20` }]}>
            <Text style={[styles.pendingText, { color: Colors.brand.mint }]}>Goal met</Text>
          </View>
        ) : null}
      </View>

      {/* Progress Card */}
      <View style={[styles.progressCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: palette.muted }]}>Confirmation progress</Text>
          <Text style={[styles.progressValue, { color: palette.text }]}>
            {checkedCount} / {CHECKLIST_ITEMS.length}
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPct}%`,
                backgroundColor: progressPct === 100 ? Colors.brand.mint : palette.tint,
              },
            ]}
          />
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.checklist}>
        {CHECKLIST_ITEMS.map((item) => (
          <AnimatedCheckCard
            key={item.key}
            item={item}
            checked={confirmChecklist[item.key]}
            detail={item.key === 'analyzedFresh' ? analysisDetail : undefined}
            onToggle={() => setConfirmChecklist({ [item.key]: !confirmChecklist[item.key] })}
            palette={palette}
            colorScheme={colorScheme}
          />
        ))}
      </View>

      {/* Analysis Alert */}
      {showAnalysisAlert ? (
        <View style={[styles.alertCard, { borderColor: palette.danger, backgroundColor: `${palette.danger}10` }]}>
          <FontAwesome name="exclamation-triangle" size={16} color={palette.danger} />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: palette.danger }]}>More samples needed</Text>
            <Text style={[styles.alertBody, { color: palette.text }]}>
              Analyze {missingSamples} more fresh sample{missingSamples === 1 ? '' : 's'} before
              completing.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Insufficient Samples Override */}
      {!hasMetAnalysisMinimum ? (
        <Pressable
          onPress={() => {
            const newValue = !confirmChecklist.insufficientSamples;
            setConfirmChecklist({
              insufficientSamples: newValue,
              insufficientSamplesNote: newValue ? confirmChecklist.insufficientSamplesNote : '',
            });
            setShowInsufficientNote(newValue);
          }}
        >
          <View
            style={[
              styles.overrideCard,
              {
                backgroundColor: confirmChecklist.insufficientSamples ? `${Colors.brand.gold}10` : palette.card,
                borderColor: confirmChecklist.insufficientSamples ? Colors.brand.gold : cardBorder,
              },
            ]}
          >
            <View style={styles.overrideHeader}>
              <View style={[styles.overrideIcon, { backgroundColor: `${Colors.brand.gold}20` }]}>
                <FontAwesome name="info-circle" size={16} color={Colors.brand.evergreen} />
              </View>
              <View style={styles.overrideContent}>
                <Text style={[styles.overrideTitle, { color: palette.text }]}>
                  Not enough samples today
                </Text>
                <Text style={[styles.overrideDescription, { color: palette.muted }]}>
                  Toggle if there weren't enough fresh samples
                </Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: confirmChecklist.insufficientSamples ? Colors.brand.gold : cardBorder,
                    backgroundColor: confirmChecklist.insufficientSamples ? Colors.brand.gold : 'transparent',
                  },
                ]}
              >
                {confirmChecklist.insufficientSamples ? (
                  <FontAwesome name="check" size={12} color="#FFFFFF" />
                ) : null}
              </View>
            </View>
            {showInsufficientNote && confirmChecklist.insufficientSamples ? (
              <TextInput
                value={confirmChecklist.insufficientSamplesNote}
                onChangeText={(value) => setConfirmChecklist({ insufficientSamplesNote: value })}
                placeholder="Optional note about what you found"
                placeholderTextColor={palette.muted}
                style={[styles.noteInput, { color: palette.text, borderColor: cardBorder, backgroundColor: palette.background }]}
              />
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleNext}
          variant={canContinue ? 'cta' : 'secondary'}
          disabled={!canContinue}
          style={styles.ctaButton}
        />
        {!canContinue ? (
          <Text style={[styles.footerHint, { color: palette.muted }]}>
            {!confirmationsReady
              ? 'Complete all confirmations'
              : 'Analyze samples or mark as insufficient'}
          </Text>
        ) : null}
      </View>
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  sampleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  sampleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleInfo: {
    flex: 1,
  },
  sampleCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  sampleLabel: {
    fontSize: 12,
  },
  pendingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  checklist: {
    gap: 10,
  },
  checkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkContent: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  checkDescription: {
    fontSize: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  overrideCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  overrideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overrideIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideContent: {
    flex: 1,
    gap: 2,
  },
  overrideTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  overrideDescription: {
    fontSize: 12,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
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
});
