import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { WellnessReminder } from '@/lib/api/types';

type ReminderCardProps = {
  reminder: WellnessReminder;
  marking?: boolean;
  onMarkDone: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

const CATEGORY_ICONS: Record<string, keyof typeof FontAwesome.glyphMap> = {
  MEDS: 'medkit',
  VACCINE: 'shield',
  DEWORMING: 'bug',
  FLEA_TICK: 'paw',
  FOOD_TRANSITION: 'cutlery',
  VET_VISIT: 'stethoscope',
  CUSTOM: 'bell',
};

const formatShortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const buildDueStatus = (dueDate: Date, now: Date) => {
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { label: `${days}d overdue`, overdue: true, urgent: true };
  }
  if (diffDays === 0) return { label: 'Due today', overdue: false, urgent: true };
  if (diffDays === 1) return { label: 'Tomorrow', overdue: false, urgent: false };
  if (diffDays <= 7) return { label: `In ${diffDays} days`, overdue: false, urgent: false };
  return { label: formatShortDate(dueDate), overdue: false, urgent: false };
};

const formatFrequency = (days: number | null) => {
  if (!days) return 'One-time';
  if (days === 1) return 'Daily';
  if (days === 7) return 'Weekly';
  if (days === 30) return 'Monthly';
  if (days === 90) return 'Quarterly';
  if (days === 365) return 'Yearly';
  return `Every ${days}d`;
};

export default function ReminderCard({
  reminder,
  marking = false,
  onMarkDone,
  onToggleActive,
  onDelete,
}: ReminderCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [expanded, setExpanded] = useState(false);

  const dueDate = new Date(reminder.nextDueAt);
  const dueStatus = buildDueStatus(dueDate, new Date());
  const categoryIcon = CATEGORY_ICONS[reminder.category] ?? 'bell';
  const isPaused = !reminder.active;

  const statusColor = isPaused
    ? palette.muted
    : dueStatus.overdue
      ? palette.danger
      : dueStatus.urgent
        ? Colors.brand.gold
        : palette.tint;

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
        isPaused && styles.cardPaused,
      ]}
      onPress={() => setExpanded(!expanded)}
    >
      {/* Main Row */}
      <View style={styles.mainRow}>
        <View style={[styles.iconWrapper, { backgroundColor: `${statusColor}15` }]}>
          <FontAwesome name={categoryIcon} size={16} color={statusColor} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {reminder.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: palette.muted }]}>
              {reminder.dogName ?? 'Household'}
            </Text>
            <Text style={[styles.metaDot, { color: palette.muted }]}>·</Text>
            <Text style={[styles.metaText, { color: palette.muted }]}>
              {formatFrequency(reminder.frequencyDays)}
            </Text>
          </View>
        </View>

        <View style={styles.statusColumn}>
          {isPaused ? (
            <View style={[styles.statusBadge, { backgroundColor: `${palette.muted}15` }]}>
              <Text style={[styles.statusText, { color: palette.muted }]}>Paused</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{dueStatus.label}</Text>
            </View>
          )}
          <FontAwesome
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={10}
            color={palette.muted}
            style={styles.chevron}
          />
        </View>
      </View>

      {/* Expanded Content */}
      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: palette.border }]}>
          {/* Details */}
          {reminder.notes && (
            <Text style={[styles.notes, { color: palette.muted }]}>{reminder.notes}</Text>
          )}

          {reminder.lastCompletedAt && (
            <View style={styles.detailRow}>
              <FontAwesome name="check" size={12} color={Colors.brand.mint} />
              <Text style={[styles.detailText, { color: palette.muted }]}>
                Last done {formatShortDate(new Date(reminder.lastCompletedAt))}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            {!isPaused && (
              <Pressable
                style={[
                  styles.actionButton,
                  { backgroundColor: Colors.brand.mint },
                  marking && styles.actionDisabled,
                ]}
                onPress={onMarkDone}
                disabled={marking}
              >
                <FontAwesome name="check" size={12} color="#FFFFFF" />
                <Text style={styles.actionPrimaryText}>
                  {marking ? 'Marking...' : 'Done'}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.actionButton, { backgroundColor: `${palette.muted}15` }]}
              onPress={onToggleActive}
            >
              <FontAwesome
                name={isPaused ? 'play' : 'pause'}
                size={12}
                color={palette.text}
              />
              <Text style={[styles.actionSecondaryText, { color: palette.text }]}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <FontAwesome name="trash-o" size={14} color={palette.danger} />
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardPaused: {
    opacity: 0.7,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  metaDot: {
    fontSize: 12,
  },
  statusColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    marginTop: 2,
  },
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  notes: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionSecondaryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteButton: {
    marginLeft: 'auto',
    padding: 8,
  },
});
