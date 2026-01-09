import { useMemo, useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { DogSummary, WellnessReminder } from '@/lib/api/types';

type ReminderSheetProps = {
  visible: boolean;
  onClose: () => void;
  dogs: DogSummary[];
  multiDogLocked: boolean;
  saving: boolean;
  onSave: (data: {
    title: string;
    category: WellnessReminder['category'];
    dogId: string | null;
    notes: string;
    nextDueAt: Date;
    frequencyDays: number | null;
  }) => void;
  prefill?: {
    title?: string;
    category?: WellnessReminder['category'];
    dogId?: string;
    notes?: string;
    dueDate?: Date;
    frequencyDays?: number;
  };
};

const CATEGORY_OPTIONS: { label: string; value: WellnessReminder['category']; icon: keyof typeof FontAwesome.glyphMap }[] = [
  { label: 'Meds', value: 'MEDS', icon: 'medkit' },
  { label: 'Vaccine', value: 'VACCINE', icon: 'shield' },
  { label: 'Deworm', value: 'DEWORMING', icon: 'bug' },
  { label: 'Flea/Tick', value: 'FLEA_TICK', icon: 'paw' },
  { label: 'Food', value: 'FOOD_TRANSITION', icon: 'cutlery' },
  { label: 'Vet', value: 'VET_VISIT', icon: 'stethoscope' },
  { label: 'Custom', value: 'CUSTOM', icon: 'bell' },
];

const FREQUENCY_OPTIONS = [
  { label: 'One-time', value: null },
  { label: 'Daily', value: 1 },
  { label: 'Weekly', value: 7 },
  { label: 'Monthly', value: 30 },
  { label: 'Quarterly', value: 90 },
  { label: 'Yearly', value: 365 },
];

const QUICK_DUE_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'Next month', days: 30 },
];

const formatDateDisplay = (date: Date) =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function ReminderSheet({
  visible,
  onClose,
  dogs,
  multiDogLocked,
  saving,
  onSave,
  prefill,
}: ReminderSheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WellnessReminder['category']>('CUSTOM');
  const [dogId, setDogId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const [frequencyDays, setFrequencyDays] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when sheet opens
  useEffect(() => {
    if (visible) {
      if (prefill) {
        setTitle(prefill.title ?? '');
        setCategory(prefill.category ?? 'CUSTOM');
        setDogId(prefill.dogId ?? null);
        setNotes(prefill.notes ?? '');
        setFrequencyDays(prefill.frequencyDays ?? null);
        if (prefill.dueDate) {
          setDueDate(prefill.dueDate);
        } else {
          const date = new Date();
          date.setDate(date.getDate() + 7);
          date.setHours(9, 0, 0, 0);
          setDueDate(date);
        }
      } else {
        setTitle('');
        setCategory('CUSTOM');
        setDogId(null);
        setNotes('');
        setFrequencyDays(null);
        const date = new Date();
        date.setDate(date.getDate() + 7);
        date.setHours(9, 0, 0, 0);
        setDueDate(date);
      }
      setShowNotes(!!prefill?.notes);
      setError(null);
    }
  }, [visible, prefill]);

  const handleQuickDue = (days: number) => {
    const next = new Date();
    next.setDate(next.getDate() + days);
    next.setHours(9, 0, 0, 0);
    setDueDate(next);
  };

  const selectedDueOption = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(dueDate);
    dueDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
    return QUICK_DUE_OPTIONS.find((opt) => opt.days === diffDays)?.days ?? null;
  }, [dueDate]);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Please enter a reminder title');
      return;
    }
    setError(null);
    onSave({
      title: title.trim(),
      category,
      dogId,
      notes: notes.trim(),
      nextDueAt: dueDate,
      frequencyDays,
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.8]}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>New reminder</Text>
          <Pressable
            style={[styles.closeButton, { backgroundColor: `${palette.muted}15` }]}
            onPress={onClose}
          >
            <FontAwesome name="times" size={16} color={palette.muted} />
          </Pressable>
        </View>

        {/* Title input */}
        <TextInput
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          placeholder="What's the reminder for?"
          placeholderTextColor={palette.muted}
          value={title}
          onChangeText={setTitle}
          autoFocus
        />

        {/* Category */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.muted }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORY_OPTIONS.map((option) => {
              const isSelected = category === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? `${palette.tint}15` : palette.card,
                      borderColor: isSelected ? palette.tint : palette.border,
                    },
                  ]}
                  onPress={() => setCategory(option.value)}
                >
                  <FontAwesome
                    name={option.icon}
                    size={14}
                    color={isSelected ? palette.tint : palette.muted}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: isSelected ? palette.tint : palette.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Dog selector */}
        {dogs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.muted }]}>For</Text>
            <View style={styles.chipRow}>
              <ChoiceChip
                label="Household"
                selected={!dogId}
                onPress={() => setDogId(null)}
                disabled={multiDogLocked}
              />
              {dogs.map((dog) => (
                <ChoiceChip
                  key={dog.id}
                  label={dog.name}
                  selected={dogId === dog.id}
                  onPress={() => setDogId(dog.id)}
                  disabled={multiDogLocked}
                />
              ))}
            </View>
          </View>
        )}

        {/* Due date */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.muted }]}>When</Text>
          <View style={styles.chipRow}>
            {QUICK_DUE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.label}
                label={option.label}
                selected={selectedDueOption === option.days}
                onPress={() => handleQuickDue(option.days)}
              />
            ))}
          </View>
          <View style={[styles.dueDateCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <FontAwesome name="calendar" size={14} color={palette.muted} />
            <Text style={[styles.dueDateText, { color: palette.text }]}>
              {formatDateDisplay(dueDate)}
            </Text>
          </View>
        </View>

        {/* Frequency */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.muted }]}>Repeat</Text>
          <View style={styles.chipRow}>
            {FREQUENCY_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.label}
                label={option.label}
                selected={frequencyDays === option.value}
                onPress={() => setFrequencyDays(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Pressable onPress={() => setShowNotes(!showNotes)}>
            <Text style={[styles.link, { color: palette.tint }]}>
              {showNotes ? 'Hide notes' : notes.trim() ? 'Edit notes' : 'Add notes (optional)'}
            </Text>
          </Pressable>
          {showNotes && (
            <TextInput
              style={[styles.input, styles.notesInput, { borderColor: palette.border, color: palette.text }]}
              placeholder="Additional details..."
              placeholderTextColor={palette.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          )}
        </View>

        {/* Error */}
        {error && (
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            style={styles.cancelButton}
          />
          <Button
            title={saving ? 'Saving...' : 'Save reminder'}
            onPress={handleSubmit}
            disabled={saving}
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 600,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dueDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dueDateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  link: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingBottom: 16,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
