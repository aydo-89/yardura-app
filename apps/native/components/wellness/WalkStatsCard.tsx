import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { TrackingState } from '@/lib/wellness/useWalkTracking';
import type { DogSummary } from '@/lib/api/types';

type WalkStatsCardProps = {
  state: TrackingState;
  distanceLabel: string;
  durationLabel: string;
  paceLabel: string;
  error: string | null;
  dogs: DogSummary[];
  selectedDogId: string | null;
  onSelectDog: (dogId: string | null) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  disabled?: boolean;
  disabledMessage?: string;
};

export default function WalkStatsCard({
  state,
  distanceLabel,
  durationLabel,
  paceLabel,
  error,
  dogs,
  selectedDogId,
  onSelectDog,
  onStart,
  onPause,
  onResume,
  onFinish,
  disabled,
  disabledMessage,
}: WalkStatsCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';
  const isSaving = state === 'saving';
  const isIdle = state === 'idle';

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {/* Header with Live badge */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>
          {isIdle ? 'Walk controls' : isRecording ? 'Recording walk' : isPaused ? 'Walk paused' : 'Saving...'}
        </Text>
        {isRecording && (
          <View style={[styles.liveBadge, { backgroundColor: palette.tint }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statItem, { backgroundColor: `${palette.tint}08` }]}>
          <FontAwesome name="road" size={14} color={palette.tint} />
          <Text style={[styles.statValue, { color: palette.text }]}>{distanceLabel}</Text>
          <Text style={[styles.statLabel, { color: palette.muted }]}>Distance</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: `${Colors.brand.mint}08` }]}>
          <FontAwesome name="clock-o" size={14} color={Colors.brand.mint} />
          <Text style={[styles.statValue, { color: palette.text }]}>{durationLabel}</Text>
          <Text style={[styles.statLabel, { color: palette.muted }]}>Time</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: `${Colors.brand.gold}08` }]}>
          <FontAwesome name="tachometer" size={14} color={Colors.brand.gold} />
          <Text style={[styles.statValue, { color: palette.text }]}>{paceLabel}</Text>
          <Text style={[styles.statLabel, { color: palette.muted }]}>Pace</Text>
        </View>
      </View>

      {/* Dog selector */}
      {dogs.length > 0 && (
        <View style={styles.dogSection}>
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Dog (optional)</Text>
          <View style={styles.chipRow}>
            <ChoiceChip
              label="Household"
              selected={!selectedDogId}
              onPress={() => onSelectDog(null)}
            />
            {dogs.map((dog) => (
              <ChoiceChip
                key={dog.id}
                label={dog.name}
                selected={selectedDogId === dog.id}
                onPress={() => onSelectDog(dog.id)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {isIdle && (
          <Pressable
            style={[styles.startButton, { backgroundColor: disabled ? palette.muted : palette.tint }]}
            onPress={onStart}
            disabled={disabled}
          >
            <FontAwesome name="play" size={16} color="#FFFFFF" />
            <Text style={styles.startButtonText}>{disabled ? 'Limit reached' : 'Start walk'}</Text>
          </Pressable>
        )}

        {isRecording && (
          <>
            <Button title="Pause" onPress={onPause} variant="secondary" style={styles.actionButton} />
            <Button title="Finish" onPress={onFinish} style={styles.actionButton} />
          </>
        )}

        {isPaused && (
          <>
            <Button title="Resume" onPress={onResume} style={styles.actionButton} />
            <Button title="Finish" onPress={onFinish} variant="secondary" style={styles.actionButton} />
          </>
        )}

        {isSaving && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.savingText, { color: palette.muted }]}>Saving walk...</Text>
          </View>
        )}
      </View>

      {/* Error message */}
      {error && (
        <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10` }]}>
          <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      )}

      {/* Helper text */}
      {isIdle && (
        <Text style={[styles.helperText, { color: disabled ? palette.danger : palette.muted }]}>
          {disabled && disabledMessage
            ? disabledMessage
            : 'Keep the app open while tracking for the most accurate route.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dogSection: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
  },
  savingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  savingText: {
    fontSize: 14,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
