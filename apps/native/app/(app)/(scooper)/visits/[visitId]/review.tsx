import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function ReviewStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const successTone = Colors.brand.mint;
  const warningTone = Colors.brand.gold;

  const {
    steps,
    visitId,
    analyzedCount,
    analysisGoal,
    hasMetAnalysisMinimum,
    insightMedia,
    summaryDraft,
    summaryLoading,
    summaryError,
    summaryResult,
    generateSummary,
    updateSummaryDraft,
    deleteMedia,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);

  const sampleGroups = useMemo(() => {
    const grouped = new Map<string, typeof insightMedia>();
    const ungrouped: typeof insightMedia = [];

    insightMedia.forEach((media) => {
      if (media.stoolSampleId) {
        const existing = grouped.get(media.stoolSampleId) ?? [];
        existing.push(media);
        grouped.set(media.stoolSampleId, existing);
      } else {
        ungrouped.push(media);
      }
    });

    const resolveMediaTime = (media?: typeof insightMedia[number] | null) => {
      const time =
        media?.capturedAt ??
        media?.uploadedAt ??
        media?.updatedAt ??
        media?.createdAt ??
        null;
      if (!time) return 0;
      const parsed = Date.parse(time);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const groups = Array.from(grouped.entries()).map(([sampleId, media]) => {
      const sorted = [...media].sort((a, b) => {
        if (a.stoolSampleView === 'SURFACE') return -1;
        if (b.stoolSampleView === 'SURFACE') return 1;
        return resolveMediaTime(a) - resolveMediaTime(b);
      });
      const surface = sorted.find((item) => item.stoolSampleView !== 'CROSS_SECTION') ?? null;
      const cross = sorted.find((item) => item.stoolSampleView === 'CROSS_SECTION') ?? null;
      const sortTime = Math.max(resolveMediaTime(surface), resolveMediaTime(cross));
      return {
        sampleId,
        surface,
        cross,
        sortTime,
      };
    });

    groups.sort((a, b) => a.sortTime - b.sortTime);

    return { groups, ungrouped };
  }, [insightMedia]);

  useStepGuard('review');

  const stepIndex = useMemo(
    () => Math.max(steps.findIndex((step) => step.id === 'review'), 0),
    [steps],
  );

  const canContinue = Boolean(
    summaryDraft.color.trim() &&
      summaryDraft.consistency.trim() &&
      summaryDraft.content.trim(),
  );

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => goToStep(getPreviousStep('review'));
  const handleNext = () => goToStep(getNextStep('review'));

  const handleDeleteSample = async (mediaId: string) => {
    if (!mediaId) return;
    setDeletingId(mediaId);
    await deleteMedia(mediaId);
    setDeletingId(null);
  };

  useEffect(() => {
    if (!hasMetAnalysisMinimum || summaryLoading || summaryResult || summaryError) return;
    generateSummary();
  }, [hasMetAnalysisMinimum, summaryLoading, summaryResult, summaryError, generateSummary]);

  const totalSamples = sampleGroups.groups.length + sampleGroups.ungrouped.length;

  return (
    <VisitStepShell
      title="Review & summarize"
      subtitle="Complete the 3Cs summary for the customer"
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      {/* AI Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryIcon, { backgroundColor: `${palette.tint}15` }]}>
            <FontAwesome name="magic" size={18} color={palette.tint} />
          </View>
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryTitle, { color: palette.text }]}>AI Summary</Text>
            <Text style={[styles.summarySubtitle, { color: palette.muted }]}>
              {analyzedCount} of {Math.max(1, analysisGoal)} samples analyzed
            </Text>
          </View>
          {hasMetAnalysisMinimum ? (
            <View style={[styles.statusBadge, { backgroundColor: `${successTone}20` }]}>
              <Text style={[styles.statusText, { color: successTone }]}>Ready</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: `${warningTone}20` }]}>
              <Text style={[styles.statusText, { color: warningTone }]}>Pending</Text>
            </View>
          )}
        </View>
        {summaryError ? (
          <View style={[styles.errorBanner, { backgroundColor: `${palette.danger}10` }]}>
            <FontAwesome name="exclamation-circle" size={12} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{summaryError}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={generateSummary}
          disabled={summaryLoading || !hasMetAnalysisMinimum}
          style={({ pressed }) => [
            styles.generateButton,
            {
              backgroundColor: hasMetAnalysisMinimum ? `${palette.tint}15` : palette.background,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <FontAwesome
            name={summaryLoading ? 'spinner' : 'refresh'}
            size={14}
            color={hasMetAnalysisMinimum ? palette.tint : palette.muted}
          />
          <Text
            style={[
              styles.generateText,
              { color: hasMetAnalysisMinimum ? palette.tint : palette.muted },
            ]}
          >
            {summaryLoading ? 'Generating...' : summaryResult ? 'Regenerate' : 'Generate summary'}
          </Text>
        </Pressable>
      </View>

      {/* Samples Section (Collapsible) */}
      {insightMedia.length > 0 ? (
        <View style={styles.samplesSection}>
          <Pressable
            onPress={() => setShowSamples(!showSamples)}
            style={[styles.samplesHeader, { backgroundColor: palette.card, borderColor: cardBorder }]}
          >
            <View style={[styles.samplesIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="image" size={16} color={palette.tint} />
            </View>
            <View style={styles.samplesHeaderContent}>
              <Text style={[styles.samplesTitle, { color: palette.text }]}>
                Captured samples
              </Text>
              <Text style={[styles.samplesSubtitle, { color: palette.muted }]}>
                {totalSamples} sample{totalSamples !== 1 ? 's' : ''} • Tap to {showSamples ? 'hide' : 'review'}
              </Text>
            </View>
            <FontAwesome
              name={showSamples ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={palette.muted}
            />
          </Pressable>

          {showSamples ? (
            <View style={[styles.samplesContent, { backgroundColor: palette.card, borderColor: cardBorder }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sampleScroll}>
                <View style={styles.sampleRow}>
                  {sampleGroups.groups.map((group, index) => (
                    <View key={group.sampleId} style={[styles.sampleCard, { borderColor: cardBorder }]}>
                      <View style={styles.sampleImageRow}>
                        {group.surface?.url ? (
                          <Image source={{ uri: group.surface.url }} style={styles.sampleThumb} />
                        ) : (
                          <View style={[styles.sampleThumbPlaceholder, { backgroundColor: palette.background }]} />
                        )}
                        {group.cross?.url ? (
                          <Image source={{ uri: group.cross.url }} style={styles.sampleThumb} />
                        ) : (
                          <View style={[styles.sampleThumbPlaceholder, { backgroundColor: palette.background }]} />
                        )}
                      </View>
                      <Text style={[styles.sampleCardLabel, { color: palette.text }]}>Sample {index + 1}</Text>
                      <View style={styles.sampleActions}>
                        {group.surface ? (
                          <Pressable
                            onPress={() => handleDeleteSample(group.surface!.id)}
                            disabled={deletingId === group.surface.id}
                            style={styles.removeButton}
                          >
                            <FontAwesome name="trash-o" size={12} color={palette.danger} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                  {sampleGroups.ungrouped.map((media) => (
                    <View key={media.id} style={[styles.sampleCard, { borderColor: cardBorder }]}>
                      {media.url ? (
                        <Image source={{ uri: media.url }} style={styles.singleThumb} />
                      ) : (
                        <View style={[styles.singleThumbPlaceholder, { backgroundColor: palette.background }]} />
                      )}
                      <Text style={[styles.sampleCardLabel, { color: palette.muted }]}>Unpaired</Text>
                      <Pressable
                        onPress={() => handleDeleteSample(media.id)}
                        disabled={deletingId === media.id}
                        style={styles.removeButton}
                      >
                        <FontAwesome name="trash-o" size={12} color={palette.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 3Cs Form */}
      <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
        <View style={styles.formHeader}>
          <Text style={[styles.formTitle, { color: palette.text }]}>3Cs Summary</Text>
          <Text style={[styles.formSubtitle, { color: palette.muted }]}>Color, Consistency, Content</Text>
        </View>

        <View style={styles.formField}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Color</Text>
          <TextInput
            value={summaryDraft.color}
            onChangeText={(value) => updateSummaryDraft({ color: value })}
            placeholder="e.g. Chocolate brown"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: cardBorder, backgroundColor: palette.background }]}
          />
        </View>

        <View style={styles.formField}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Consistency</Text>
          <TextInput
            value={summaryDraft.consistency}
            onChangeText={(value) => updateSummaryDraft({ consistency: value })}
            placeholder="e.g. Firm, logs"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: cardBorder, backgroundColor: palette.background }]}
          />
        </View>

        <View style={styles.formField}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Content</Text>
          <TextInput
            value={summaryDraft.content}
            onChangeText={(value) => updateSummaryDraft({ content: value })}
            placeholder="e.g. No visible debris"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: cardBorder, backgroundColor: palette.background }]}
          />
        </View>

        <View style={styles.formField}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Notes (optional)</Text>
          <TextInput
            value={summaryDraft.observations}
            onChangeText={(value) => updateSummaryDraft({ observations: value })}
            placeholder="Additional observations for the family"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.textArea, { color: palette.text, borderColor: cardBorder, backgroundColor: palette.background }]}
            multiline
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Wellness Flag */}
      <Pressable
        onPress={() => updateSummaryDraft({ wellnessFlag: !summaryDraft.wellnessFlag, flagReason: '' })}
        style={[
          styles.flagCard,
          {
            backgroundColor: summaryDraft.wellnessFlag ? `${warningTone}10` : palette.card,
            borderColor: summaryDraft.wellnessFlag ? warningTone : cardBorder,
          },
        ]}
      >
        <View style={[styles.flagIcon, { backgroundColor: summaryDraft.wellnessFlag ? `${warningTone}20` : `${palette.tint}15` }]}>
          <FontAwesome
            name="flag"
            size={18}
            color={summaryDraft.wellnessFlag ? warningTone : palette.tint}
          />
        </View>
        <View style={styles.flagContent}>
          <Text style={[styles.flagTitle, { color: summaryDraft.wellnessFlag ? warningTone : palette.text }]}>
            {summaryDraft.wellnessFlag ? 'Issue flagged' : 'Flag wellness issue'}
          </Text>
          <Text style={[styles.flagSubtitle, { color: palette.muted }]}>
            {summaryDraft.wellnessFlag ? 'Customer will be notified' : 'Toggle if you noticed a concern'}
          </Text>
        </View>
        <View
          style={[
            styles.flagToggle,
            {
              borderColor: summaryDraft.wellnessFlag ? warningTone : cardBorder,
              backgroundColor: summaryDraft.wellnessFlag ? warningTone : 'transparent',
            },
          ]}
        >
          {summaryDraft.wellnessFlag ? (
            <FontAwesome name="check" size={12} color="#FFFFFF" />
          ) : null}
        </View>
      </Pressable>

      {summaryDraft.wellnessFlag ? (
        <View style={[styles.flagReasonCard, { backgroundColor: palette.card, borderColor: cardBorder }]}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Describe the concern</Text>
          <TextInput
            value={summaryDraft.flagReason}
            onChangeText={(value) => updateSummaryDraft({ flagReason: value })}
            placeholder="What did you notice?"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: cardBorder, backgroundColor: palette.background }]}
          />
        </View>
      ) : null}

      {summaryDraft.flaggedSampleReasons.length > 0 ? (
        <View style={[styles.flaggedList, { backgroundColor: `${warningTone}08`, borderColor: warningTone }]}>
          <Text style={[styles.flaggedTitle, { color: warningTone }]}>AI-detected flags</Text>
          {summaryDraft.flaggedSampleReasons.map((reason, index) => (
            <Text key={`${reason}-${index}`} style={[styles.flaggedItem, { color: palette.text }]}>
              • {reason}
            </Text>
          ))}
        </View>
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
            Complete color, consistency, and content
          </Text>
        ) : null}
      </View>
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContent: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  summarySubtitle: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  generateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  samplesSection: {
    gap: 0,
  },
  samplesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  samplesIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  samplesHeaderContent: {
    flex: 1,
    gap: 2,
  },
  samplesTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  samplesSubtitle: {
    fontSize: 12,
  },
  samplesContent: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 12,
    marginTop: -16,
    paddingTop: 20,
  },
  sampleScroll: {
    marginHorizontal: -4,
  },
  sampleRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
  },
  sampleCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 6,
    width: 100,
  },
  sampleImageRow: {
    flexDirection: 'row',
    gap: 4,
  },
  sampleThumb: {
    flex: 1,
    height: 50,
    borderRadius: 8,
  },
  sampleThumbPlaceholder: {
    flex: 1,
    height: 50,
    borderRadius: 8,
  },
  singleThumb: {
    width: '100%',
    height: 60,
    borderRadius: 8,
  },
  singleThumbPlaceholder: {
    width: '100%',
    height: 60,
    borderRadius: 8,
  },
  sampleCardLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sampleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  removeButton: {
    padding: 6,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  formHeader: {
    gap: 2,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  formSubtitle: {
    fontSize: 12,
  },
  formField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
  },
  flagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  flagIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagContent: {
    flex: 1,
    gap: 2,
  },
  flagTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  flagSubtitle: {
    fontSize: 12,
  },
  flagToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagReasonCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  flaggedList: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  flaggedTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  flaggedItem: {
    fontSize: 12,
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
