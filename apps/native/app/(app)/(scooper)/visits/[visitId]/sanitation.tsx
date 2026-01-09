import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const successTone = Colors.brand.mint;

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

  const stepIndex = useMemo(
    () => Math.max(steps.findIndex((step) => step.id === 'sanitation'), 0),
    [steps],
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

  const handleBack = () => goToStep(getPreviousStep('sanitation'));
  const handleNext = () => goToStep(getNextStep('sanitation'));

  const hasVideo = sanitationVideoMedia.length > 0;
  const hasShoes = sanitationShoesMedia.length > 0;
  const hasTools = sanitationToolsMedia.length > 0;
  const videoUrl = sanitationVideoMedia[0]?.url ?? null;

  const handleOpenVideo = () => {
    if (!videoUrl) return;
    Linking.openURL(videoUrl).catch(() => null);
  };

  return (
    <VisitStepShell
      title="Sanitation"
      subtitle="Document boots and tools sanitization"
      stepIndex={stepIndex}
      stepCount={steps.length || 1}
      onBack={handleBack}
    >
      {/* Instruction Card */}
      <View style={[styles.instructionCard, { backgroundColor: `${Colors.brand.mint}10`, borderColor: Colors.brand.mint }]}>
        <View style={[styles.instructionIcon, { backgroundColor: `${Colors.brand.mint}20` }]}>
          <FontAwesome name="shield" size={20} color={Colors.brand.mint} />
        </View>
        <View style={styles.instructionContent}>
          <Text style={[styles.instructionTitle, { color: Colors.brand.evergreen }]}>Disease prevention</Text>
          <Text style={[styles.instructionBody, { color: palette.muted }]}>
            Sanitize boots and tools between every yard
          </Text>
        </View>
      </View>

      {/* Video Capture Section */}
      {hasVideo ? (
        <View style={styles.videoSection}>
          <Pressable
            onPress={handleOpenVideo}
            style={[styles.videoPreviewCard, { backgroundColor: palette.card, borderColor: cardBorder }]}
          >
            <View style={[styles.videoIcon, { backgroundColor: `${successTone}20` }]}>
              <FontAwesome name="play-circle" size={28} color={successTone} />
            </View>
            <View style={styles.videoContent}>
              <Text style={[styles.videoTitle, { color: palette.text }]}>Sanitation clip ready</Text>
              <Text style={[styles.videoSubtitle, { color: palette.muted }]}>
                {videoUrl ? 'Tap to view' : 'Preview syncing...'}
              </Text>
            </View>
            {videoUrl ? (
              <FontAwesome name="external-link" size={14} color={palette.muted} />
            ) : null}
          </Pressable>
          <View style={[styles.successBadge, { backgroundColor: `${successTone}15` }]}>
            <FontAwesome name="check-circle" size={14} color={successTone} />
            <Text style={[styles.successText, { color: successTone }]}>Video uploaded</Text>
          </View>
          <Pressable
            onPress={() => handleCapture('video')}
            disabled={uploading}
            style={({ pressed }) => [
              styles.retakeButton,
              { backgroundColor: palette.background, borderColor: cardBorder, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <FontAwesome name="refresh" size={12} color={palette.muted} />
            <Text style={[styles.retakeText, { color: palette.muted }]}>Retake video</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => handleCapture('video')}
          disabled={uploading}
          style={({ pressed }) => [
            styles.captureCard,
            { borderColor: palette.tint, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.captureIcon, { backgroundColor: `${palette.tint}15` }]}>
            <FontAwesome name="video-camera" size={28} color={palette.tint} />
          </View>
          <Text style={[styles.captureTitle, { color: palette.text }]}>
            {uploading ? 'Uploading...' : 'Record 60s clip'}
          </Text>
          <Text style={[styles.captureBody, { color: palette.muted }]}>
            Show boots and tools being sanitized
          </Text>
          {uploading ? <ActivityIndicator size="small" color={palette.tint} style={styles.spinner} /> : null}
        </Pressable>
      )}

      {/* Backup Photos Section */}
      <Pressable
        onPress={() => setShowBackup(!showBackup)}
        style={[styles.backupHeader, { backgroundColor: palette.card, borderColor: cardBorder }]}
      >
        <View style={[styles.backupIcon, { backgroundColor: `${palette.tint}15` }]}>
          <FontAwesome name="camera" size={16} color={palette.tint} />
        </View>
        <View style={styles.backupHeaderContent}>
          <Text style={[styles.backupTitle, { color: palette.text }]}>
            {showBackup ? 'Hide backup photos' : 'Having trouble recording?'}
          </Text>
          <Text style={[styles.backupSubtitle, { color: palette.muted }]}>
            {hasShoes && hasTools ? 'Both photos captured' : 'Use photos as fallback'}
          </Text>
        </View>
        <FontAwesome
          name={showBackup ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={palette.muted}
        />
      </Pressable>

      {showBackup ? (
        <View style={styles.photoRow}>
          {/* Boots Photo */}
          <Pressable
            onPress={() => handleCapture('shoes')}
            disabled={uploading}
            style={({ pressed }) => [
              styles.photoCard,
              { backgroundColor: palette.card, borderColor: hasShoes ? successTone : cardBorder, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            {sanitationShoesMedia[0]?.url ? (
              <Image source={{ uri: sanitationShoesMedia[0].url }} style={styles.photoImage} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: palette.background }]}>
                <FontAwesome name="bolt" size={24} color={palette.muted} />
              </View>
            )}
            <View style={styles.photoCardContent}>
              <Text style={[styles.photoLabel, { color: palette.text }]}>Boots</Text>
              {hasShoes ? (
                <FontAwesome name="check-circle" size={14} color={successTone} />
              ) : (
                <Text style={[styles.photoHint, { color: palette.muted }]}>Tap to capture</Text>
              )}
            </View>
          </Pressable>

          {/* Tools Photo */}
          <Pressable
            onPress={() => handleCapture('tools')}
            disabled={uploading}
            style={({ pressed }) => [
              styles.photoCard,
              { backgroundColor: palette.card, borderColor: hasTools ? successTone : cardBorder, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            {sanitationToolsMedia[0]?.url ? (
              <Image source={{ uri: sanitationToolsMedia[0].url }} style={styles.photoImage} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: palette.background }]}>
                <FontAwesome name="wrench" size={24} color={palette.muted} />
              </View>
            )}
            <View style={styles.photoCardContent}>
              <Text style={[styles.photoLabel, { color: palette.text }]}>Tools</Text>
              {hasTools ? (
                <FontAwesome name="check-circle" size={14} color={successTone} />
              ) : (
                <Text style={[styles.photoHint, { color: palette.muted }]}>Tap to capture</Text>
              )}
            </View>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
          <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleNext}
          variant={sanitationCaptured ? 'cta' : 'secondary'}
          disabled={!sanitationCaptured}
          style={styles.ctaButton}
        />
        {!sanitationCaptured ? (
          <Text style={[styles.footerHint, { color: palette.muted }]}>
            Record video or capture both photos
          </Text>
        ) : null}
      </View>
    </VisitStepShell>
  );
}

const styles = StyleSheet.create({
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  instructionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionContent: {
    flex: 1,
    gap: 2,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  instructionBody: {
    fontSize: 12,
  },
  captureCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  captureIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  captureBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 4,
  },
  videoSection: {
    gap: 10,
  },
  videoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  videoIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoContent: {
    flex: 1,
    gap: 2,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  videoSubtitle: {
    fontSize: 12,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  retakeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  backupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupHeaderContent: {
    flex: 1,
    gap: 2,
  },
  backupTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  backupSubtitle: {
    fontSize: 12,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: 100,
  },
  photoPlaceholder: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoHint: {
    fontSize: 11,
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
});
