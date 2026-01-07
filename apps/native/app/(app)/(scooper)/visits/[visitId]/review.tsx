import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { useVisitFlow } from '@/lib/scooper/visitFlow';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

export default function ReviewStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
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

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'review'),
    0,
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

  const handleBack = () => {
    const prev = getPreviousStep('review');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('review');
    goToStep(next);
  };

  const handleDeleteSample = async (mediaId: string) => {
    if (!mediaId) return;
    setDeletingId(mediaId);
    await deleteMedia(mediaId);
    setDeletingId(null);
  };

  const analysisLabel = useMemo(() => {
    if (analysisGoal === 0) {
      return 'Capture at least one sample to unlock AI summary.';
    }
    return `${analyzedCount} analyzed of ${analysisGoal} recommended`;
  }, [analysisGoal, analyzedCount]);

  useEffect(() => {
    if (!hasMetAnalysisMinimum || summaryLoading || summaryResult || summaryError) return;
    generateSummary();
  }, [hasMetAnalysisMinimum, summaryLoading, summaryResult, summaryError, generateSummary]);

  return (
    <VisitStepShell
      title="Review & summarize"
      subtitle="Confirm the 3Cs and insights that the customer will receive."
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>AI summary</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>{analysisLabel}</Text>
        {summaryResult ? (
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Suggestions loaded from analyzed samples.
          </Text>
        ) : null}
        {summaryError ? (
          <Text style={[styles.errorText, { color: palette.danger }]}>{summaryError}</Text>
        ) : null}
        <Button
          title={summaryLoading ? 'Generating...' : 'Generate AI summary'}
          onPress={generateSummary}
          disabled={summaryLoading || !hasMetAnalysisMinimum}
          variant="secondary"
        />
        {!hasMetAnalysisMinimum ? (
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Analyze at least {Math.max(1, analysisGoal)} samples to enable AI summary.
          </Text>
        ) : null}
      </View>

      {insightMedia.length ? (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Captured samples</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Remove any accidental or blurry captures before completing the visit.
          </Text>
          <View style={styles.sampleGroupList}>
            {sampleGroups.groups.map((group, index) => (
              <View key={group.sampleId} style={[styles.sampleGroupCard, { borderColor: palette.border }]}>
                <View style={styles.sampleGroupHeader}>
                  <Text style={[styles.sampleGroupTitle, { color: palette.text }]}>
                    Sample {index + 1}
                  </Text>
                  <Text style={[styles.sampleGroupMeta, { color: palette.muted }]}>
                    {group.surface && group.cross ? 'Surface + cross-section' : group.surface ? 'Surface only' : 'Cross-section only'}
                  </Text>
                </View>
                <View style={styles.samplePairRow}>
                  {[{ media: group.surface, label: 'Surface' }, { media: group.cross, label: 'Cross-section' }].map(
                    ({ media, label }) => {
                      const status = media?.analysisStatus
                        ? media.analysisStatus.toLowerCase().replace('_', ' ')
                        : 'pending';
                      return (
                        <View
                          key={`${group.sampleId}-${label}`}
                          style={[styles.sampleCard, styles.sampleCardPair, { borderColor: palette.border }]}
                        >
                          {media?.url ? (
                            <Image source={{ uri: media.url }} style={styles.sampleImage} />
                          ) : (
                            <View style={[styles.samplePlaceholder, { backgroundColor: palette.background }]} />
                          )}
                          <Text style={[styles.sampleLabel, { color: palette.text }]}>{label}</Text>
                          {media ? (
                            <Text style={[styles.sampleStatus, { color: palette.muted }]}>Analysis: {status}</Text>
                          ) : (
                            <Text style={[styles.sampleStatus, { color: palette.muted }]}>Missing capture</Text>
                          )}
                          {media ? (
                            <Button
                              title={deletingId === media.id ? 'Removing...' : 'Remove'}
                              onPress={() => handleDeleteSample(media.id)}
                              disabled={deletingId === media.id}
                              variant="ghost"
                              style={styles.sampleRemove}
                              labelStyle={styles.sampleRemoveLabel}
                            />
                          ) : null}
                        </View>
                      );
                    },
                  )}
                </View>
              </View>
            ))}
            {sampleGroups.ungrouped.length ? (
              <View style={styles.ungroupedSection}>
                <Text style={[styles.ungroupedTitle, { color: palette.muted }]}>Unpaired captures</Text>
                <View style={styles.sampleGrid}>
                  {sampleGroups.ungrouped.map((media) => {
                    const label = media.stoolSampleView === 'CROSS_SECTION' ? 'Cross-section' : 'Surface';
                    const status = media.analysisStatus
                      ? media.analysisStatus.toLowerCase().replace('_', ' ')
                      : 'pending';
                    return (
                      <View key={media.id} style={[styles.sampleCard, { borderColor: palette.border }]}>
                        {media.url ? (
                          <Image source={{ uri: media.url }} style={styles.sampleImage} />
                        ) : (
                          <View style={[styles.samplePlaceholder, { backgroundColor: palette.background }]} />
                        )}
                        <Text style={[styles.sampleLabel, { color: palette.text }]}>{label}</Text>
                        <Text style={[styles.sampleStatus, { color: palette.muted }]}>Analysis: {status}</Text>
                        <Button
                          title={deletingId === media.id ? 'Removing...' : 'Remove'}
                          onPress={() => handleDeleteSample(media.id)}
                          disabled={deletingId === media.id}
                          variant="ghost"
                          style={styles.sampleRemove}
                          labelStyle={styles.sampleRemoveLabel}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>3Cs summary</Text>
        <Text style={[styles.inputLabel, { color: palette.text }]}>Color</Text>
        <TextInput
          value={summaryDraft.color}
          onChangeText={(value) => updateSummaryDraft({ color: value })}
          placeholder="e.g. Chocolate brown"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <Text style={[styles.inputLabel, { color: palette.text }]}>Consistency</Text>
        <TextInput
          value={summaryDraft.consistency}
          onChangeText={(value) => updateSummaryDraft({ consistency: value })}
          placeholder="e.g. Firm, logs"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <Text style={[styles.inputLabel, { color: palette.text }]}>Content</Text>
        <TextInput
          value={summaryDraft.content}
          onChangeText={(value) => updateSummaryDraft({ content: value })}
          placeholder="e.g. No visible debris"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <Text style={[styles.inputLabel, { color: palette.text }]}>Notes</Text>
        <TextInput
          value={summaryDraft.observations}
          onChangeText={(value) => updateSummaryDraft({ observations: value })}
          placeholder="Optional notes for the family"
          placeholderTextColor={palette.muted}
          style={[styles.input, styles.textArea, { color: palette.text, borderColor: palette.border }]}
          multiline
          textAlignVertical="top"
        />
        <Text style={[styles.inputLabel, { color: palette.text }]}>Wellness flag</Text>
        <View style={styles.rowWrap}>
          <ChoiceChip
            label="All good"
            selected={!summaryDraft.wellnessFlag}
            onPress={() => updateSummaryDraft({ wellnessFlag: false, flagReason: '' })}
          />
          <ChoiceChip
            label="Flag issue"
            selected={summaryDraft.wellnessFlag}
            onPress={() => updateSummaryDraft({ wellnessFlag: true })}
          />
        </View>
        {summaryDraft.wellnessFlag ? (
          <>
            <Text style={[styles.inputLabel, { color: palette.text }]}>Flag reason</Text>
            <TextInput
              value={summaryDraft.flagReason}
              onChangeText={(value) => updateSummaryDraft({ flagReason: value })}
              placeholder="Describe the concern"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />
          </>
        ) : null}
        {summaryDraft.flaggedSampleReasons.length ? (
          <View style={styles.flagList}>
            <Text style={[styles.cardBody, { color: palette.muted }]}>Flagged samples:</Text>
            {summaryDraft.flaggedSampleReasons.map((reason, index) => (
              <Text key={`${reason}-${index}`} style={[styles.flagItem, { color: palette.muted }]}>
                • {reason}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <Button
        title="Continue to next step"
        onPress={handleNext}
        disabled={!canContinue}
        variant="cta"
      />
      {!canContinue ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Add color, consistency, and content before continuing.
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
    gap: 12,
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flagList: {
    gap: 4,
  },
  flagItem: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 12,
  },
  sampleGroupList: {
    gap: 12,
  },
  sampleGroupCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  sampleGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sampleGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sampleGroupMeta: {
    fontSize: 12,
  },
  samplePairRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  sampleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sampleCard: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 6,
  },
  sampleCardPair: {
    flexBasis: 0,
    minWidth: 0,
  },
  sampleImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  samplePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  sampleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sampleStatus: {
    fontSize: 11,
  },
  sampleRemove: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  sampleRemoveLabel: {
    fontSize: 12,
  },
  ungroupedSection: {
    gap: 8,
  },
  ungroupedTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  errorText: {
    fontSize: 12,
  },
});
