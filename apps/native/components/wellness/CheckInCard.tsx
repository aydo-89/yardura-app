import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import ChoiceChip from '@/components/ui/ChoiceChip';
import SymptomPicker from '@/components/wellness/SymptomPicker';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type CheckInCardProps = {
  dogName: string;
  noIssues: boolean;
  symptoms: string[];
  behaviorNotes: string;
  diagnosisLabel: string;
  diagnosisNotes: string;
  isSubmitted: boolean;
  isDirty: boolean;
  streakCount?: number;
  onNoIssuesChange: (value: boolean) => void;
  onSymptomsChange: (symptoms: string[]) => void;
  onBehaviorNotesChange: (notes: string) => void;
  onDiagnosisLabelChange: (label: string) => void;
  onDiagnosisNotesChange: (notes: string) => void;
};

export default function CheckInCard({
  dogName,
  noIssues,
  symptoms,
  behaviorNotes,
  diagnosisLabel,
  diagnosisNotes,
  isSubmitted,
  isDirty,
  streakCount,
  onNoIssuesChange,
  onSymptomsChange,
  onBehaviorNotesChange,
  onDiagnosisLabelChange,
  onDiagnosisNotesChange,
}: CheckInCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [vetExpanded, setVetExpanded] = useState(Boolean(diagnosisLabel || diagnosisNotes));

  const handleToggleAllGood = (allGood: boolean) => {
    if (allGood) {
      // Clear everything when "All good" is selected
      onNoIssuesChange(true);
      onSymptomsChange([]);
      onBehaviorNotesChange('');
      onDiagnosisLabelChange('');
      onDiagnosisNotesChange('');
      setVetExpanded(false);
    } else {
      onNoIssuesChange(false);
    }
  };

  const status = isSubmitted && !isDirty ? 'submitted' : isDirty ? 'modified' : 'pending';

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.dogName, { color: palette.text }]}>
            How was {dogName} this week?
          </Text>
          {status === 'submitted' && (
            <View style={[styles.statusBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="check" size={10} color={Colors.brand.mint} />
              <Text style={[styles.statusText, { color: Colors.brand.mint }]}>Submitted</Text>
            </View>
          )}
          {status === 'modified' && (
            <View style={[styles.statusBadge, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="pencil" size={10} color={Colors.brand.gold} />
              <Text style={[styles.statusText, { color: Colors.brand.gold }]}>Modified</Text>
            </View>
          )}
        </View>
        {streakCount && streakCount > 1 && (
          <View style={[styles.streakBadge, { backgroundColor: `${palette.tint}15` }]}>
            <FontAwesome name="fire" size={12} color={palette.tint} />
            <Text style={[styles.streakText, { color: palette.tint }]}>{streakCount}</Text>
          </View>
        )}
      </View>

      {/* Health toggle */}
      <View style={styles.toggleRow}>
        <ChoiceChip
          label="All good"
          selected={noIssues}
          onPress={() => handleToggleAllGood(true)}
        />
        <ChoiceChip
          label="I noticed something"
          selected={!noIssues}
          onPress={() => handleToggleAllGood(false)}
        />
      </View>

      {/* Symptoms section */}
      {!noIssues && (
        <View style={[styles.symptomsSection, { borderColor: palette.border }]}>
          <SymptomPicker
            selectedSymptoms={symptoms}
            onChange={onSymptomsChange}
          />

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={[styles.label, { color: palette.text }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder="Diet changes, behavior shifts, anything notable..."
              placeholderTextColor={palette.muted}
              value={behaviorNotes}
              onChangeText={onBehaviorNotesChange}
              multiline
            />
          </View>

          {/* Vet details */}
          <Pressable
            style={styles.expandRow}
            onPress={() => setVetExpanded(!vetExpanded)}
          >
            <FontAwesome
              name={vetExpanded ? 'minus-circle' : 'plus-circle'}
              size={14}
              color={palette.tint}
            />
            <Text style={[styles.expandText, { color: palette.tint }]}>
              {vetExpanded ? 'Hide vet visit details' : 'Add vet visit details'}
            </Text>
          </Pressable>

          {vetExpanded && (
            <View style={styles.vetSection}>
              <Text style={[styles.label, { color: palette.text }]}>Diagnosis (optional)</Text>
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                placeholder="Condition or diagnosis name"
                placeholderTextColor={palette.muted}
                value={diagnosisLabel}
                onChangeText={onDiagnosisLabelChange}
              />
              <Text style={[styles.label, { color: palette.text }]}>Vet notes (optional)</Text>
              <TextInput
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                placeholder="Notes from the vet visit..."
                placeholderTextColor={palette.muted}
                value={diagnosisNotes}
                onChangeText={onDiagnosisNotesChange}
                multiline
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  dogName: {
    fontSize: 17,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  symptomsSection: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  notesSection: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '600',
  },
  vetSection: {
    gap: 10,
  },
});
