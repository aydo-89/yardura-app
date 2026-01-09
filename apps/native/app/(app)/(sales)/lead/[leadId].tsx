import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';

import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiRequest } from '@/lib/api/client';
import type { LeadActivity, LeadOwner, OutboundLead } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSales } from '@/lib/sales/SalesProvider';
import {
  activityTypes,
  buildNotesWithTags,
  buildTagLine,
  encounterOptions,
  formatActivityType,
  formatEncounterLabel,
  parseTagLine,
  formatLeadAddress,
  formatLeadName,
  objectionOptions,
  dogPresenceOptions,
  stageColorToHex,
} from '@/lib/sales/utils';

const followUpOptions = [
  { value: 'none', label: 'No follow up' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next-week', label: 'Next week' },
  { value: 'custom', label: 'Custom date' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const ownerLabel = (owner: LeadOwner | null | undefined) =>
  owner?.name || owner?.email || 'Unassigned';

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  return phone.replace(/[^\d+]/g, '');
}

const formatTagToken = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const stripTagLine = (notes?: string | null) => {
  if (!notes) return null;
  const clean = notes
    .split(/\r?\n/)
    .filter((line) => !line.trim().toLowerCase().startsWith('tags:'))
    .join('\n')
    .trim();
  return clean.length ? clean : null;
};

const buildActivityBadges = (activity: LeadActivity) => {
  const tags = parseTagLine(activity.notes);
  const badges: string[] = [];
  const encounterLabel = tags.encounter ? formatEncounterLabel(tags.encounter) : null;
  const dogLabel = tags.dog
    ? dogPresenceOptions.find((option) => option.value === tags.dog)?.label
    : null;

  if (encounterLabel) badges.push(encounterLabel);
  if (dogLabel) badges.push(dogLabel);
  if (tags.dog_count) badges.push(`Dogs: ${tags.dog_count}`);
  if (tags.objections) {
    tags.objections
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((token) => {
        const label =
          objectionOptions.find((option) => option.value === token)?.label
          ?? formatTagToken(token);
        badges.push(label);
      });
  }

  return { badges, encounterLabel };
};

export default function LeadDetailScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { session } = useAuth();
  const { owners, cadences, refresh } = useSales();
  const [lead, setLead] = useState<OutboundLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [cadenceModalOpen, setCadenceModalOpen] = useState(false);
  const [activityType, setActivityType] = useState('DOOR_KNOCK');
  const [activityResult, setActivityResult] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [followUpSelection, setFollowUpSelection] = useState('none');
  const [customFollowUp, setCustomFollowUp] = useState('');
  const [encounterTags, setEncounterTags] = useState<string[]>([]);
  const [dogPresence, setDogPresence] = useState<string | null>(null);
  const [dogCount, setDogCount] = useState('');
  const [objectionTags, setObjectionTags] = useState<string[]>([]);

  const loadLead = useCallback(async () => {
    if (!leadId || !session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<OutboundLead>(`/api/leads/${leadId}`, {
        token: session.token,
      });
      setLead(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load lead.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [leadId, session?.token]);

  const loadActivities = useCallback(
    async ({ cursor }: { cursor?: string | null } = {}) => {
      if (!leadId || !session?.token) return;
      setActivityLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '25');
        if (cursor) params.set('cursor', cursor);
        const data = await apiRequest<{
          activities: LeadActivity[];
          pageInfo: { nextCursor: string | null };
        }>(`/api/leads/${leadId}/activities?${params.toString()}`, {
          token: session.token,
        });
        setActivities((prev) => (cursor ? [...prev, ...data.activities] : data.activities));
        setActivityCursor(data.pageInfo?.nextCursor ?? null);
        setActivityHasMore(Boolean(data.pageInfo?.nextCursor));
      } catch (err) {
        console.warn('Unable to load activities', err);
      } finally {
        setActivityLoading(false);
      }
    },
    [leadId, session?.token],
  );

  useFocusEffect(
    useCallback(() => {
      void loadLead();
      void loadActivities();
    }, [loadLead, loadActivities]),
  );

  const primaryCadence = lead?.cadenceEnrollments?.[0]?.cadence?.name ?? null;

  const handleAssignOwner = async (ownerId: string | null) => {
    if (!leadId || !session?.token) return;
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PATCH',
        token: session.token,
        body: { ownerId },
      });
      await loadLead();
      await refresh();
    } catch (err) {
      console.warn('Unable to assign owner', err);
    } finally {
      setOwnerModalOpen(false);
    }
  };

  const handleAssignCadence = async (cadenceId: string) => {
    if (!leadId || !session?.token) return;
    try {
      await apiRequest(`/api/leads/${leadId}/cadences`, {
        method: 'POST',
        token: session.token,
        body: { cadenceId },
      });
      await loadLead();
    } catch (err) {
      console.warn('Unable to assign cadence', err);
    } finally {
      setCadenceModalOpen(false);
    }
  };

  const handleLogActivity = async () => {
    if (!leadId || !session?.token || activitySubmitting) return;
    setActivitySubmitting(true);
    try {
      let followUpAt: string | undefined;
      if (followUpSelection === 'tomorrow') {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        followUpAt = date.toISOString();
      } else if (followUpSelection === 'next-week') {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        followUpAt = date.toISOString();
      } else if (followUpSelection === 'custom' && customFollowUp.trim()) {
        const date = new Date(customFollowUp);
        if (!Number.isNaN(date.getTime())) {
          followUpAt = date.toISOString();
        }
      }

      const tagLine = buildTagLine({
        dogPresence: dogPresence as any,
        dogCount: dogCount ? Number(dogCount) : null,
        encounterTags,
        objectionTags,
      });
      const notesPayload = buildNotesWithTags(tagLine, activityNotes);
      const primaryEncounter = encounterTags[0] ?? null;
      const encounterLabel = encounterOptions.find(
        (option) => option.value === primaryEncounter,
      )?.label;
      const resolvedResult = activityResult || encounterLabel || undefined;

      await apiRequest(`/api/leads/${leadId}/activities`, {
        method: 'POST',
        token: session.token,
        body: {
          type: activityType,
          result: resolvedResult,
          notes: notesPayload || undefined,
          followUpAt,
        },
      });

      setActivityNotes('');
      setActivityResult('');
      setEncounterTags([]);
      setDogPresence(null);
      setDogCount('');
      setObjectionTags([]);
      setFollowUpSelection('none');
      setCustomFollowUp('');
      await loadLead();
      await loadActivities();
    } catch (err) {
      console.warn('Unable to log activity', err);
    } finally {
      setActivitySubmitting(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!leadId || !session?.token) return;
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'DELETE',
        token: session.token,
      });
      await refresh();
      router.back();
    } catch (err) {
      console.warn('Unable to delete lead', err);
    }
  };

  const leadPhone = normalizePhone(lead?.phone);
  const leadEmail = lead?.email?.trim();
  const addressLine = formatLeadAddress(lead);
  const mapsUrl = lead?.latitude && lead?.longitude
    ? `https://maps.google.com/?q=${lead.latitude},${lead.longitude}`
    : addressLine
      ? `https://maps.google.com/?q=${encodeURIComponent(addressLine)}`
      : null;
  const nextActionLabel = lead?.nextActionAt
    ? formatDateTime(lead.nextActionAt)
    : null;

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={palette.tint} />
      </Screen>
    );
  }

  if (error || !lead) {
    return (
      <Screen>
        <Text style={[styles.errorText, { color: palette.danger }]}>
          {error || 'Lead not found.'}
        </Text>
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Lead detail</Text>
          <Text style={[styles.title, { color: palette.text }]}>
            {formatLeadName(lead)}
          </Text>
          {addressLine ? (
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              {addressLine}
            </Text>
          ) : null}
          <View style={styles.stageRow}>
            <View style={[styles.stageDot, { backgroundColor: stageColorToHex(lead.stageColor) }]} />
            <Text style={[styles.stageLabel, { color: palette.text }]}>
              {lead.pipelineStage ?? 'Unknown stage'}
            </Text>
          </View>
          {nextActionLabel ? (
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Next action due {nextActionLabel}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Contacts</Text>
          {leadPhone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${leadPhone}`)}>
              <Text style={[styles.cardRow, { color: palette.text }]}>
                <FontAwesome name="phone" /> {leadPhone}
              </Text>
            </Pressable>
          ) : null}
          {leadEmail ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${leadEmail}`)}>
              <Text style={[styles.cardRow, { color: palette.text }]}>
                <FontAwesome name="envelope" /> {leadEmail}
              </Text>
            </Pressable>
          ) : null}
          {mapsUrl ? (
            <Button title="Navigate" onPress={() => Linking.openURL(mapsUrl)} variant="secondary" />
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Owner</Text>
            <Button title="Change" onPress={() => setOwnerModalOpen(true)} variant="ghost" />
          </View>
          <Text style={[styles.cardRow, { color: palette.text }]}>
            {ownerLabel(lead.owner)}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Coverage</Text>
          <Text style={[styles.cardRow, { color: palette.text }]}>
            Territory: {lead.territory?.name ?? 'Unassigned'}
          </Text>
          {lead.serviceArea ? (
            <Text style={[styles.cardRow, { color: palette.text }]}>
              Service area: {lead.serviceArea.slug} - {lead.serviceArea.status.toLowerCase()}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Cadence</Text>
            <Button title="Assign" onPress={() => setCadenceModalOpen(true)} variant="ghost" />
          </View>
          <Text style={[styles.cardRow, { color: palette.text }]}>
            {primaryCadence || 'No cadence assigned'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Activity</Text>
          {activities.length === 0 ? (
            <Text style={[styles.cardRow, { color: palette.muted }]}>No activity yet.</Text>
          ) : (
            activities.map((activity) => {
              const title = formatActivityType(activity.type) ?? 'Activity';
              const { badges, encounterLabel } = buildActivityBadges(activity);
              const resultLabel = formatEncounterLabel(activity.result);
              const subtitle =
                resultLabel && resultLabel !== encounterLabel ? resultLabel : null;
              const cleanNotes = stripTagLine(activity.notes);

              return (
                <View
                  key={activity.id}
                  style={[styles.activityItem, { borderBottomColor: palette.border }]}
                >
                  <View style={styles.activityHeader}>
                    <View style={styles.activityTitleRow}>
                      <View style={[styles.activityIcon, { backgroundColor: palette.tint }]}>
                        <FontAwesome name="bolt" size={12} color="#ffffff" />
                      </View>
                      <View>
                        <Text style={[styles.activityTitle, { color: palette.text }]}>
                          {title}
                        </Text>
                        {subtitle ? (
                          <Text style={[styles.activitySubtitle, { color: palette.muted }]}>
                            {subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.activityMeta, { color: palette.muted }]}>
                    {formatDateTime(activity.occurredAt)}{' '}
                    {activity.user?.name || activity.user?.email || 'Unknown rep'}
                  </Text>
                  {badges.length ? (
                    <View style={styles.activityTags}>
                      {badges.map((badge, index) => (
                        <View
                          key={`${activity.id}-badge-${index}`}
                          style={[
                            styles.activityTag,
                            { backgroundColor: palette.background, borderColor: palette.border },
                          ]}
                        >
                          <Text style={[styles.activityTagText, { color: palette.text }]}>
                            {badge}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {cleanNotes ? (
                    <Text style={[styles.activityNotes, { color: palette.text }]}>
                      {cleanNotes}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
          {activityHasMore ? (
            <Button
              title={activityLoading ? 'Loading...' : 'Load more'}
              onPress={() => loadActivities({ cursor: activityCursor })}
              disabled={activityLoading}
              variant="secondary"
              style={styles.activityMore}
            />
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Log activity</Text>
          <Text style={[styles.label, { color: palette.muted }]}>Activity type</Text>
          <View style={styles.chipWrap}>
            {activityTypes.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={activityType === option.value}
                onPress={() => setActivityType(option.value)}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>Encounter outcome</Text>
          <View style={styles.chipWrap}>
            {encounterOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={encounterTags.includes(option.value)}
                onPress={() =>
                  setEncounterTags((prev) =>
                    prev.includes(option.value)
                      ? prev.filter((item) => item !== option.value)
                      : [...prev, option.value],
                  )
                }
              />
            ))}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>Dog presence</Text>
          <View style={styles.chipWrap}>
            {dogPresenceOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={dogPresence === option.value}
                onPress={() => setDogPresence(option.value)}
              />
            ))}
          </View>

          <TextInput
            placeholder="Dog count (optional)"
            placeholderTextColor={palette.muted}
            keyboardType="numeric"
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            value={dogCount}
            onChangeText={setDogCount}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Objections</Text>
          <View style={styles.chipWrap}>
            {objectionOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={objectionTags.includes(option.value)}
                onPress={() =>
                  setObjectionTags((prev) =>
                    prev.includes(option.value)
                      ? prev.filter((item) => item !== option.value)
                      : [...prev, option.value],
                  )
                }
              />
            ))}
          </View>

          <TextInput
            placeholder="Result summary (optional)"
            placeholderTextColor={palette.muted}
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            value={activityResult}
            onChangeText={setActivityResult}
          />
          <TextInput
            placeholder="Notes"
            placeholderTextColor={palette.muted}
            multiline
            style={[
              styles.input,
              styles.notesInput,
              { borderColor: palette.border, color: palette.text },
            ]}
            value={activityNotes}
            onChangeText={setActivityNotes}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Follow up</Text>
          <View style={styles.chipWrap}>
            {followUpOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={followUpSelection === option.value}
                onPress={() => setFollowUpSelection(option.value)}
              />
            ))}
          </View>
          {followUpSelection === 'custom' ? (
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              value={customFollowUp}
              onChangeText={setCustomFollowUp}
            />
          ) : null}

          <Button
            title={activitySubmitting ? 'Saving...' : 'Save activity'}
            onPress={handleLogActivity}
            disabled={activitySubmitting}
          />
        </View>

        <Button
          title="Delete lead"
          onPress={handleDeleteLead}
          variant="danger"
          style={styles.deleteButton}
        />
      </ScrollView>

      <Modal visible={ownerModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.text }]}>Assign owner</Text>
            <ScrollView style={styles.modalList}>
              <Pressable
                style={styles.modalOption}
                onPress={() => handleAssignOwner(null)}
              >
                <Text style={[styles.modalOptionLabel, { color: palette.text }]}>
                  Unassigned
                </Text>
              </Pressable>
              {owners.map((owner) => (
                <Pressable
                  key={owner.id}
                  style={styles.modalOption}
                  onPress={() => handleAssignOwner(owner.id)}
                >
                  <Text style={[styles.modalOptionLabel, { color: palette.text }]}>
                    {ownerLabel(owner)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button title="Close" onPress={() => setOwnerModalOpen(false)} variant="ghost" />
          </View>
        </View>
      </Modal>

      <Modal visible={cadenceModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.text }]}>Assign cadence</Text>
            <ScrollView style={styles.modalList}>
              {cadences.map((cadence) => (
                <Pressable
                  key={cadence.id}
                  style={styles.modalOption}
                  onPress={() => handleAssignCadence(cadence.id)}
                >
                  <Text style={[styles.modalOptionLabel, { color: palette.text }]}>
                    {cadence.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button title="Close" onPress={() => setCadenceModalOpen(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    marginBottom: 16,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stageLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRow: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  activityItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activitySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  activityMeta: {
    fontSize: 12,
  },
  activityTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  activityTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activityTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityNotes: {
    fontSize: 13,
  },
  activityMore: {
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  deleteButton: {
    marginBottom: 40,
  },
  errorText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    maxHeight: '80%',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalList: {
    maxHeight: 320,
  },
  modalOption: {
    paddingVertical: 10,
  },
  modalOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
