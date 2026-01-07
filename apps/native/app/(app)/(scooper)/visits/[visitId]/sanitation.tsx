import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VisitStepShell from '@/components/scooper/VisitStepShell';
import { SANITATION_NOTES, useVisitFlow } from '@/lib/scooper/visitFlow';
import { captureWithFallback } from '@/lib/media/imagePicker';
import { useStepGuard } from '@/lib/scooper/useStepGuard';

type MediaAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function resolveAsset(asset: MediaAsset, prefix: string, fallbackType: string) {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `${prefix}-${Date.now()}.${asset.uri.split('.').pop() ?? 'jpg'}`,
    type: asset.mimeType ?? fallbackType,
  };
}

export default function SanitationStepScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const {
    steps,
    visitId,
    sanitationCaptured,
    sanitationVideoMedia,
    sanitationShoesMedia,
    sanitationToolsMedia,
    uploadingType,
    uploadMedia,
    error,
    getNextStep,
    getPreviousStep,
  } = useVisitFlow();

  const [showBackup, setShowBackup] = useState(false);
  useStepGuard('sanitation');

  const stepIndex = Math.max(
    steps.findIndex((step) => step.id === 'sanitation'),
    0,
  );

  const uploading = uploadingType === 'OTHER';

  const handleCapture = async (mode: 'video' | 'shoes' | 'tools') => {
    const isVideo = mode === 'video';
    const assetResult = await captureWithFallback({
      kind: isVideo ? 'video' : 'photo',
      quality: 0.85,
      videoMaxDuration: isVideo ? 60 : undefined,
    });
    if (!assetResult) return;
    const asset = resolveAsset(
      assetResult,
      `sanitation-${mode}`,
      isVideo ? 'video/mp4' : 'image/jpeg',
    );

    await uploadMedia(asset, {
      assetType: 'OTHER',
      notes:
        mode === 'video'
          ? SANITATION_NOTES.video
          : mode === 'shoes'
            ? SANITATION_NOTES.shoes
            : SANITATION_NOTES.tools,
    });
  };

  const goToStep = (stepId: string | null) => {
    if (!stepId) {
      router.back();
      return;
    }
    router.push(`/(app)/(scooper)/visits/${visitId}/${stepId}`);
  };

  const handleBack = () => {
    const prev = getPreviousStep('sanitation');
    goToStep(prev);
  };

  const handleNext = () => {
    const next = getNextStep('sanitation');
    goToStep(next);
  };

  const hasVideo = sanitationVideoMedia.length > 0;
  const hasShoes = sanitationShoesMedia.length > 0;
  const hasTools = sanitationToolsMedia.length > 0;
  const videoUrl = sanitationVideoMedia[0]?.url ?? null;

  const statusLabel = useMemo(() => {
    if (hasVideo) {
      return 'Sanitation clip uploaded.';
    }
    if (hasShoes || hasTools) {
      return 'Photos captured. Add any missing proof.';
    }
    return 'No sanitation proof yet.';
  }, [hasVideo, hasShoes, hasTools]);

  const handleOpenVideo = () => {
    if (!videoUrl) return;
    Linking.openURL(videoUrl).catch(() => null);
  };

  return (
    <VisitStepShell
      title="Sanitation"
      subtitle="Record sanitation proof after every visit."
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Preferred: 60s sanitation clip</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>
          Capture a quick video of boots + tools being sanitized before leaving.
        </Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>{statusLabel}</Text>
        {videoUrl ? (
          <View style={[styles.videoPreview, { borderColor: palette.border }]}>
            <Text style={[styles.videoLabel, { color: palette.text }]}>Sanitation clip ready</Text>
            <Button title="View sanitation clip" onPress={handleOpenVideo} variant="secondary" />
          </View>
        ) : hasVideo ? (
          <Text style={[styles.previewHint, { color: palette.muted }]}>Clip uploaded. Preview will appear once synced.</Text>
        ) : null}
        <Button
          title={uploading ? 'Uploading...' : hasVideo ? 'Retake sanitation clip' : 'Record sanitation clip'}
          onPress={() => handleCapture('video')}
          disabled={uploading}
        />
        {uploading ? <ActivityIndicator size="small" color={palette.tint} /> : null}
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Backup photos (optional)</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>
          Only use these if you cannot record the sanitation clip.
        </Text>
        <Button
          title={showBackup ? 'Hide backup photos' : 'Show backup photos'}
          onPress={() => setShowBackup((prev) => !prev)}
          variant="ghost"
        />
        {showBackup ? (
          <>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              Capture both boots + tools.
            </Text>
            <View style={styles.photoRow}>
              <View style={styles.photoBlock}>
                {sanitationShoesMedia[0]?.url ? (
                  <Image
                    source={{ uri: sanitationShoesMedia[0].url ?? '' }}
                    style={styles.photo}
                  />
                ) : (
                  <View style={[styles.photoPlaceholder, { borderColor: palette.border }]}>
                    <Text style={[styles.photoLabel, { color: palette.muted }]}>Boots</Text>
                  </View>
                )}
                <Button
                  title={hasShoes ? 'Retake boots photo' : 'Capture boots photo'}
                  onPress={() => handleCapture('shoes')}
                  disabled={uploading}
                  variant="secondary"
                />
              </View>
              <View style={styles.photoBlock}>
                {sanitationToolsMedia[0]?.url ? (
                  <Image
                    source={{ uri: sanitationToolsMedia[0].url ?? '' }}
                    style={styles.photo}
                  />
                ) : (
                  <View style={[styles.photoPlaceholder, { borderColor: palette.border }]}>
                    <Text style={[styles.photoLabel, { color: palette.muted }]}>Tools</Text>
                  </View>
                )}
                <Button
                  title={hasTools ? 'Retake tools photo' : 'Capture tools photo'}
                  onPress={() => handleCapture('tools')}
                  disabled={uploading}
                  variant="secondary"
                />
              </View>
            </View>
          </>
        ) : null}
        {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}
      </View>

      <Button
        title="Continue to next step"
        onPress={handleNext}
        disabled={!sanitationCaptured}
        variant="cta"
      />
      {!sanitationCaptured ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Add a sanitation clip or both boots + tools photos to continue.
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
  photoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoBlock: {
    flex: 1,
    gap: 8,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  photoPlaceholder: {
    height: 140,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    fontSize: 12,
  },
  videoPreview: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  videoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewHint: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
  },
});
