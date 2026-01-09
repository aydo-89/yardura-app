import { useState, useMemo, useEffect } from 'react';
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
import type { WellnessFoodProduct, DogSummary } from '@/lib/api/types';
import {
  FoodType,
  PORTION_PRESETS,
  QUICK_TIME_OPTIONS,
  formatTimeLabel,
  formatTypeLabel,
  getPlaceholders,
} from '@/lib/food/useFoodLog';

type FoodEntrySheetProps = {
  visible: boolean;
  onClose: () => void;
  product: WellnessFoodProduct | null;
  dogs: DogSummary[];
  dogNameMap: Map<string, string>;
  multiDogLocked: boolean;
  saving: boolean;
  onSubmit: (params: {
    productId: string;
    dogId: string | null;
    portion: string;
    notes: string;
    loggedAt: Date;
  }) => void;
};

export default function FoodEntrySheet({
  visible,
  onClose,
  product,
  dogs,
  dogNameMap,
  multiDogLocked,
  saving,
  onSubmit,
}: FoodEntrySheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [dogId, setDogId] = useState<string | null>(null);
  const [portion, setPortion] = useState('');
  const [customPortion, setCustomPortion] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [loggedAt, setLoggedAt] = useState(() => new Date());
  const [showTimeOptions, setShowTimeOptions] = useState(false);

  // Reset form when sheet opens with a new product
  useEffect(() => {
    if (visible && product) {
      setDogId(product.dogId ?? null);
      setPortion(product.portion ?? '');
      setCustomPortion(false);
      setNotes('');
      setShowNotes(false);
      setLoggedAt(new Date());
      setShowTimeOptions(false);
    }
  }, [visible, product?.id]);

  const productType = product?.type ?? 'FOOD';
  const portionPresets = useMemo(
    () => PORTION_PRESETS[productType] ?? PORTION_PRESETS.FOOD,
    [productType],
  );
  const placeholders = useMemo(() => getPlaceholders(productType), [productType]);

  const productLabel = product?.productName || product?.brand || 'Item';
  const dogLabel = dogId ? dogNameMap.get(dogId) ?? 'Dog' : 'Household';

  const applyQuickTime = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
    const next = new Date(loggedAt);
    next.setHours(hour, minute, 0, 0);
    setLoggedAt(next);
  };

  const handleSubmit = () => {
    if (!product) return;
    onSubmit({
      productId: product.id,
      dogId,
      portion: portion.trim(),
      notes: notes.trim(),
      loggedAt,
    });
  };

  const timeLabel = loggedAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.65]}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Log entry</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            {productLabel} ({formatTypeLabel(productType)})
          </Text>
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

        {/* Portion selector */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.muted }]}>Amount</Text>
          <View style={styles.chipRow}>
            {portionPresets.map((preset) => (
              <ChoiceChip
                key={preset.value}
                label={preset.label}
                selected={portion === preset.value && !customPortion}
                onPress={() => {
                  setPortion(preset.value);
                  setCustomPortion(false);
                }}
              />
            ))}
          </View>
          <Pressable onPress={() => setCustomPortion(!customPortion)}>
            <Text style={[styles.link, { color: palette.tint }]}>
              {customPortion ? 'Use preset' : 'Custom amount'}
            </Text>
          </Pressable>
          {customPortion && (
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder={placeholders.portion}
              placeholderTextColor={palette.muted}
              value={portion}
              onChangeText={setPortion}
            />
          )}
        </View>

        {/* Time - collapsed by default */}
        <View style={styles.section}>
          <Pressable
            style={[styles.timeRow, { backgroundColor: `${palette.tint}08`, borderColor: palette.border }]}
            onPress={() => setShowTimeOptions(!showTimeOptions)}
          >
            <View style={styles.timeInfo}>
              <FontAwesome name="clock-o" size={14} color={palette.muted} />
              <Text style={[styles.timeLabel, { color: palette.text }]}>
                {timeLabel}
              </Text>
              <Text style={[styles.timeNow, { color: palette.muted }]}>(Now)</Text>
            </View>
            <View style={styles.timeChange}>
              <Text style={[styles.changeText, { color: palette.tint }]}>
                {showTimeOptions ? 'Done' : 'Change'}
              </Text>
              <FontAwesome
                name={showTimeOptions ? 'chevron-up' : 'chevron-down'}
                size={10}
                color={palette.tint}
              />
            </View>
          </Pressable>
          {showTimeOptions && (
            <View style={styles.timeOptions}>
              <Text style={[styles.timeHint, { color: palette.muted }]}>
                Select a different time:
              </Text>
              <View style={styles.chipRow}>
                {QUICK_TIME_OPTIONS.map((option) => {
                  const [hour, minute] = option.value.split(':').map(Number);
                  const isSelected =
                    loggedAt.getHours() === hour && loggedAt.getMinutes() === minute;
                  return (
                    <ChoiceChip
                      key={option.value}
                      label={formatTimeLabel(option.value)}
                      selected={isSelected}
                      onPress={() => applyQuickTime(option.value)}
                    />
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Pressable onPress={() => setShowNotes(!showNotes)}>
            <Text style={[styles.link, { color: palette.tint }]}>
              {showNotes ? 'Hide notes' : notes.trim() ? 'Edit notes' : 'Add notes'}
            </Text>
          </Pressable>
          {showNotes && (
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder={placeholders.notes}
              placeholderTextColor={palette.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          )}
          {!showNotes && notes.trim() ? (
            <Text style={[styles.preview, { color: palette.muted }]} numberOfLines={2}>
              {notes}
            </Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            style={styles.cancelButton}
          />
          <Button
            title={saving ? 'Logging...' : 'Log now'}
            onPress={handleSubmit}
            disabled={saving}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 500,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  link: {
    fontSize: 14,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginTop: 8,
  },
  preview: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeNow: {
    fontSize: 13,
  },
  timeChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeOptions: {
    marginTop: 12,
    gap: 8,
  },
  timeHint: {
    fontSize: 12,
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
  submitButton: {
    flex: 2,
  },
});
