import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { symptomOptions } from '@/lib/wellness/options';
import { assessSymptomRisk, guidanceForSymptomRisk, labelForSymptomRisk } from '@/lib/wellness/symptomRisk';

type SymptomPickerProps = {
  selectedSymptoms: string[];
  onChange: (symptoms: string[]) => void;
};

const PRIMARY_SYMPTOMS = new Set([
  'VOMITING',
  'LETHARGY',
  'APPETITE_LOSS',
  'THIRST_INCREASE',
  'THIRST_DECREASE',
  'ACCIDENTS',
]);

const SYMPTOM_LABELS = symptomOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const SYMPTOM_GROUPS = [
  { title: 'Digestive', values: ['VOMITING', 'ACCIDENTS'], icon: 'leaf' as const },
  { title: 'Energy & Appetite', values: ['LETHARGY', 'APPETITE_LOSS', 'APPETITE_INCREASE'], icon: 'bolt' as const },
  { title: 'Hydration', values: ['THIRST_INCREASE', 'THIRST_DECREASE', 'WEIGHT_LOSS', 'WEIGHT_GAIN'], icon: 'tint' as const },
  { title: 'Respiratory', values: ['COUGHING', 'SNEEZING'], icon: 'cloud' as const },
  { title: 'Skin & Behavior', values: ['ITCHING', 'SKIN_IRRITATION', 'BEHAVIOR_CHANGE'], icon: 'paw' as const },
  { title: 'Other', values: ['OTHER'], icon: 'ellipsis-h' as const },
];

const primarySymptomOptions = symptomOptions.filter((option) => PRIMARY_SYMPTOMS.has(option.value));

export default function SymptomPicker({ selectedSymptoms, onChange }: SymptomPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [expanded, setExpanded] = useState(false);

  const toggleSymptom = (value: string) => {
    const next = selectedSymptoms.includes(value)
      ? selectedSymptoms.filter((item) => item !== value)
      : [...selectedSymptoms, value];
    onChange(next);
  };

  const clearAll = () => onChange([]);

  const risk = assessSymptomRisk(selectedSymptoms);
  const hasSymptoms = selectedSymptoms.length > 0;

  const riskColor = risk.level === 'vet_now' ? palette.danger : Colors.brand.gold;

  return (
    <View style={styles.container}>
      {/* Primary symptoms */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: palette.muted }]}>Common symptoms</Text>
        <View style={styles.chipRow}>
          {primarySymptomOptions.map((option) => (
            <ChoiceChip
              key={option.value}
              label={option.label}
              selected={selectedSymptoms.includes(option.value)}
              onPress={() => toggleSymptom(option.value)}
            />
          ))}
        </View>
      </View>

      {/* Expand toggle */}
      <Pressable style={styles.expandRow} onPress={() => setExpanded(!expanded)}>
        <Text style={[styles.expandText, { color: palette.tint }]}>
          {expanded ? 'Hide more symptoms' : 'Show more symptoms'}
        </Text>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={10}
          color={palette.tint}
        />
      </Pressable>

      {/* Expanded symptoms by group */}
      {expanded && (
        <View style={styles.groupContainer}>
          {SYMPTOM_GROUPS.filter((group) =>
            group.values.some((value) => !PRIMARY_SYMPTOMS.has(value)),
          ).map((group) => (
            <View key={group.title} style={styles.group}>
              <View style={styles.groupHeader}>
                <FontAwesome name={group.icon} size={11} color={palette.muted} />
                <Text style={[styles.groupTitle, { color: palette.muted }]}>{group.title}</Text>
              </View>
              <View style={styles.chipRow}>
                {group.values
                  .filter((value) => !PRIMARY_SYMPTOMS.has(value))
                  .map((value) => {
                    const label = SYMPTOM_LABELS[value] ?? value;
                    return (
                      <ChoiceChip
                        key={value}
                        label={label}
                        selected={selectedSymptoms.includes(value)}
                        onPress={() => toggleSymptom(value)}
                      />
                    );
                  })}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Risk assessment */}
      {hasSymptoms && (
        <View
          style={[
            styles.riskCard,
            {
              backgroundColor: `${riskColor}10`,
              borderColor: riskColor,
            },
          ]}
        >
          <View style={styles.riskHeader}>
            <FontAwesome
              name={risk.level === 'vet_now' ? 'exclamation-triangle' : 'exclamation-circle'}
              size={14}
              color={riskColor}
            />
            <Text style={[styles.riskTitle, { color: palette.text }]}>
              {labelForSymptomRisk(risk.level)}
            </Text>
          </View>
          <Text style={[styles.riskGuidance, { color: palette.muted }]}>
            {guidanceForSymptomRisk(risk.level)}
          </Text>
        </View>
      )}

      {/* Clear button */}
      {hasSymptoms && (
        <Pressable style={styles.clearRow} onPress={clearAll}>
          <FontAwesome name="times" size={12} color={palette.muted} />
          <Text style={[styles.clearText, { color: palette.muted }]}>Clear all</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupContainer: {
    gap: 14,
    paddingTop: 4,
  },
  group: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  riskCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  riskGuidance: {
    fontSize: 12,
    lineHeight: 17,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 12,
  },
});
