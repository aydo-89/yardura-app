import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';

export type AvailabilityWindow = 'AM' | 'PM' | 'FULL';

export type TileSchedule = {
  weekdays: number[];
  window: AvailabilityWindow;
  maxStops: number;
};

type TileScheduleSheetProps = {
  visible: boolean;
  tileName: string;
  tileStatus: string;
  schedule: TileSchedule;
  palette: typeof Colors.light;
  colorScheme: 'light' | 'dark';
  onClose: () => void;
  onSave: (schedule: TileSchedule) => void;
  onRemove?: () => void;
};

const WEEKDAYS = [
  { label: 'S', fullLabel: 'Sun', value: 0 },
  { label: 'M', fullLabel: 'Mon', value: 1 },
  { label: 'T', fullLabel: 'Tue', value: 2 },
  { label: 'W', fullLabel: 'Wed', value: 3 },
  { label: 'T', fullLabel: 'Thu', value: 4 },
  { label: 'F', fullLabel: 'Fri', value: 5 },
  { label: 'S', fullLabel: 'Sat', value: 6 },
];

const PRESETS = [
  { label: 'Weekdays', weekdays: [1, 2, 3, 4, 5] },
  { label: 'Weekends', weekdays: [0, 6] },
  { label: 'All week', weekdays: [0, 1, 2, 3, 4, 5, 6] },
];

const WINDOW_OPTIONS: Array<{ label: string; value: AvailabilityWindow }> = [
  { label: 'Full day', value: 'FULL' },
  { label: 'Morning', value: 'AM' },
  { label: 'Afternoon', value: 'PM' },
];

export default function TileScheduleSheet({
  visible,
  tileName,
  tileStatus,
  schedule,
  palette,
  colorScheme,
  onClose,
  onSave,
  onRemove,
}: TileScheduleSheetProps) {
  const insets = useSafeAreaInsets();
  const [weekdays, setWeekdays] = useState<number[]>(schedule.weekdays);
  const [window, setWindow] = useState<AvailabilityWindow>(schedule.window);
  // Max stops is now regulated by scooper tier, use schedule value directly
  const maxStops = schedule.maxStops;

  const translateY = useSharedValue(300);
  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;

  useEffect(() => {
    if (visible) {
      setWeekdays(schedule.weekdays);
      setWindow(schedule.window);
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      translateY.value = withSpring(300, { damping: 20, stiffness: 200 });
    }
  }, [visible, schedule, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const toggleWeekday = useCallback((day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }, []);

  const applyPreset = useCallback((preset: (typeof PRESETS)[0]) => {
    setWeekdays(preset.weekdays);
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      weekdays,
      window,
      maxStops, // Use existing value from tier
    });
  }, [weekdays, window, maxStops, onSave]);

  const isValid = weekdays.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            animatedStyle,
            { backgroundColor: palette.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Handle Bar */}
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: palette.border }]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: palette.text }]}>{tileName}</Text>
                <Text style={[styles.subtitle, { color: palette.muted }]}>
                  {tileStatus === 'LIVE' ? 'Live area' : tileStatus === 'WAITLIST' ? 'Waitlist' : tileStatus}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <FontAwesome name="times" size={18} color={palette.muted} />
              </Pressable>
            </View>

            {/* Presets */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.muted }]}>Quick presets</Text>
              <View style={styles.presetsRow}>
                {PRESETS.map((preset) => {
                  const isActive =
                    preset.weekdays.length === weekdays.length &&
                    preset.weekdays.every((d) => weekdays.includes(d));
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => applyPreset(preset)}
                      style={[
                        styles.presetChip,
                        {
                          borderColor: isActive ? palette.tint : cardBorder,
                          backgroundColor: isActive ? `${palette.tint}15` : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          { color: isActive ? palette.tint : palette.text },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Day Toggles */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.muted }]}>Days</Text>
              <View style={styles.daysRow}>
                {WEEKDAYS.map((day) => {
                  const isActive = weekdays.includes(day.value);
                  return (
                    <Pressable
                      key={day.value}
                      onPress={() => toggleWeekday(day.value)}
                      style={[
                        styles.dayButton,
                        {
                          backgroundColor: isActive ? palette.tint : 'transparent',
                          borderColor: isActive ? palette.tint : cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          { color: isActive ? '#FFFFFF' : palette.text },
                        ]}
                      >
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Time Window */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.muted }]}>Time window</Text>
              <View style={styles.windowRow}>
                {WINDOW_OPTIONS.map((option) => {
                  const isActive = window === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setWindow(option.value)}
                      style={[
                        styles.windowChip,
                        {
                          borderColor: isActive ? palette.tint : cardBorder,
                          backgroundColor: isActive ? `${palette.tint}15` : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.windowChipText,
                          { color: isActive ? palette.tint : palette.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Max stops is now regulated by scooper tier, no user input needed */}

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title="Save schedule"
                onPress={handleSave}
                disabled={!isValid}
                variant="primary"
                style={styles.saveButton}
              />
              {onRemove ? (
                <Pressable onPress={onRemove} style={styles.removeLink}>
                  <Text style={[styles.removeLinkText, { color: palette.danger }]}>
                    Remove from availability
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  closeButton: {
    padding: 8,
    marginTop: -4,
    marginRight: -4,
  },
  section: {
    paddingVertical: 12,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  windowRow: {
    flexDirection: 'row',
    gap: 8,
  },
  windowChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  windowChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    paddingTop: 16,
    gap: 12,
  },
  saveButton: {
    width: '100%',
  },
  removeLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  removeLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
