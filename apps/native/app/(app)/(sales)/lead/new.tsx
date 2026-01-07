import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSales } from '@/lib/sales/SalesProvider';
import {
  activityTypes,
  buildNotesWithTags,
  buildTagLine,
  dogPresenceOptions,
  encounterOptions,
  objectionOptions,
  pipelineStageOptions,
} from '@/lib/sales/utils';

type LeadForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  pipelineStage: string;
  territoryId: string;
  ownerId: string;
};

const emptyForm = (ownerId: string, territoryId: string): LeadForm => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  pipelineStage: 'cold',
  territoryId,
  ownerId,
});

const followUpOptions = [
  { value: 'none', label: 'No follow up' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next-week', label: 'Next week' },
  { value: 'custom', label: 'Custom date' },
];

export default function NewLeadScreen() {
  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const { session } = useAuth();
  const { territories, pendingAiResult, setPendingAiResult, refresh } = useSales();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [form, setForm] = useState<LeadForm>(() =>
    emptyForm(session?.user?.id ?? 'unassigned', 'all'),
  );
  const [activityType, setActivityType] = useState('DOOR_KNOCK');
  const [activityResult, setActivityResult] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [followUpSelection, setFollowUpSelection] = useState('none');
  const [customFollowUp, setCustomFollowUp] = useState('');
  const [encounterTags, setEncounterTags] = useState<string[]>([]);
  const [dogPresence, setDogPresence] = useState<string | null>(null);
  const [dogCount, setDogCount] = useState('');
  const [objectionTags, setObjectionTags] = useState<string[]>([]);
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [reverseLookupLoading, setReverseLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentExpanded, setAssignmentExpanded] = useState(false);
  const [quickSelectExpanded, setQuickSelectExpanded] = useState(false);

  const territoryOptions = useMemo(() => {
    return [
      { id: 'all', label: 'No territory' },
      { id: 'unassigned', label: 'Unassigned' },
      ...territories.map((territory) => ({
        id: territory.id,
        label: territory.name,
      })),
    ];
  }, [territories]);

  const ownerDisplayName = session?.user?.name ?? session?.user?.email ?? 'You';
  const territoryLabel =
    territoryOptions.find((option) => option.id === form.territoryId)?.label
    ?? 'No territory';
  const pipelineLabel =
    pipelineStageOptions.find((stage) => stage.value === form.pipelineStage)?.label
    ?? 'Cold';

  useEffect(() => {
    if (!session?.user?.id) return;
    setForm((prev) => ({
      ...prev,
      ownerId: prev.ownerId === 'unassigned' ? session.user.id : prev.ownerId,
    }));
  }, [session?.user?.id]);

  const applyAiResult = useCallback(() => {
    if (!pendingAiResult) return;
    setEncounterTags(pendingAiResult.encounterTags ?? []);
    setObjectionTags(pendingAiResult.objectionTags ?? []);
    setDogPresence(pendingAiResult.dogPresence ?? null);
    setDogCount(
      typeof pendingAiResult.dogCount === 'number'
        ? String(pendingAiResult.dogCount)
        : '',
    );
    const notes = [
      pendingAiResult.summary ? `Summary: ${pendingAiResult.summary}` : null,
      pendingAiResult.followUp ? `Follow up: ${pendingAiResult.followUp}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    setActivityNotes(notes);
    const encounterLabel = encounterOptions.find(
      (option) => option.value === pendingAiResult.encounterTags?.[0],
    )?.label;
    if (encounterLabel) {
      setActivityResult(encounterLabel);
    }
    setPendingAiResult(null);
  }, [pendingAiResult, setPendingAiResult]);

  useEffect(() => {
    if (pendingAiResult) {
      applyAiResult();
    }
  }, [pendingAiResult, applyAiResult]);

  useEffect(() => {
    const hydrateLocation = async () => {
      if (Platform.OS === 'web') return;
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status !== 'granted') {
          setLocationError('Enable location to attach GPS to the visit.');
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(current.coords);
      } catch (err) {
        setLocationError('Unable to read current location.');
      }
    };
    void hydrateLocation();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!lat || !lng) return;
    const latValue = Number(lat);
    const lngValue = Number(lng);
    if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) return;
    setReverseLookupLoading(true);
    Location.reverseGeocodeAsync({ latitude: latValue, longitude: lngValue })
      .then((results) => {
        const first = results[0];
        if (!first) return;
        const address = [first.name, first.street].filter(Boolean).join(' ');
        setForm((prev) => ({
          ...prev,
          address: address || prev.address,
          city: first.city || prev.city,
          state: first.region || prev.state,
          zipCode: first.postalCode || prev.zipCode,
        }));
      })
      .catch((err) => {
        console.warn('Reverse geocode failed', err);
      })
      .finally(() => setReverseLookupLoading(false));
  }, [lat, lng]);

  const handleUpdate = (key: keyof LeadForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!session?.token) return;
    setSubmitting(true);
    setError(null);
    try {
      const hasName = Boolean(form.firstName.trim() || form.lastName.trim());
      const hasContact = Boolean(form.email.trim() || form.phone.trim());
      const hasLocation = Boolean(
        form.address.trim()
          || form.city.trim()
          || form.state.trim()
          || form.zipCode.trim()
          || (lat && lng),
      );

      if (!hasName && !hasContact && !hasLocation) {
        setError('Add a name, contact, or address before saving this lead.');
        return;
      }

      const primaryEncounter = encounterTags[0] ?? null;
      const encounterLabel = encounterOptions.find(
        (option) => option.value === primaryEncounter,
      )?.label;
      let pipelineStage = form.pipelineStage || 'cold';
      if (
        primaryEncounter === 'NO_THANK_YOU'
        || primaryEncounter === 'RUDE'
        || primaryEncounter === 'NO_SOLICITING'
      ) {
        pipelineStage = 'lost';
      } else if (primaryEncounter === 'INTERESTED') {
        pipelineStage = 'contacted';
      }

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
      const resolvedResult = activityResult || encounterLabel || undefined;

      const hasActivity =
        Boolean(activityResult)
        || Boolean(notesPayload)
        || encounterTags.length
        || objectionTags.length
        || dogPresence;

      const payload = {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        dogs: dogCount ? Number(dogCount) : undefined,
        address: {
          line1: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zip: form.zipCode || undefined,
          latitude: lat ? Number(lat) : undefined,
          longitude: lng ? Number(lng) : undefined,
        },
        territoryId:
          form.territoryId === 'all' || form.territoryId === 'unassigned'
            ? undefined
            : form.territoryId,
        pipelineStage,
        ownerId: form.ownerId === 'unassigned' ? null : form.ownerId,
        initialActivity: hasActivity
          ? {
              type: activityType,
              result: resolvedResult,
              notes: notesPayload || undefined,
              followUpAt,
              occurredAt: new Date().toISOString(),
              location: (() => {
                const latValue = lat ? Number(lat) : null;
                const lngValue = lng ? Number(lng) : null;
                if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
                  return {
                    lat: latValue,
                    lng: lngValue,
                  };
                }
                if (location) {
                  return {
                    lat: location.latitude,
                    lng: location.longitude,
                    accuracy: location.accuracy,
                  };
                }
                return undefined;
              })(),
            }
          : undefined,
      };

      const result = await apiRequest<{ lead?: { id?: string } }>(
        '/api/leads/outbound',
        {
          method: 'POST',
          token: session.token,
          body: payload,
        },
      );
      const createdLeadId = result?.lead?.id;

      await refresh();
      if (createdLeadId) {
        router.replace(`/(app)/(sales)/lead/${createdLeadId}`);
      } else {
        router.back();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save lead.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[styles.kicker, { color: palette.muted }]}>New lead</Text>
            <Text style={[styles.title, { color: palette.text }]}>Capture a prospect</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Save the essentials now and keep the follow up moving.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Contact</Text>
            <TextInput
              placeholder="First name"
              placeholderTextColor={palette.muted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              value={form.firstName}
              onChangeText={(value) => handleUpdate('firstName', value)}
            />
            <TextInput
              placeholder="Last name"
              placeholderTextColor={palette.muted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              value={form.lastName}
              onChangeText={(value) => handleUpdate('lastName', value)}
            />
            <TextInput
              placeholder="Email"
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              value={form.email}
              onChangeText={(value) => handleUpdate('email', value)}
            />
            <TextInput
              placeholder="Phone"
              placeholderTextColor={palette.muted}
              keyboardType="phone-pad"
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              value={form.phone}
              onChangeText={(value) => handleUpdate('phone', value)}
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Address</Text>
              {reverseLookupLoading ? (
                <ActivityIndicator size="small" color={palette.tint} />
              ) : null}
            </View>
            <TextInput
              placeholder="Street address"
              placeholderTextColor={palette.muted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              value={form.address}
              onChangeText={(value) => handleUpdate('address', value)}
            />
            <TextInput
              placeholder="City"
              placeholderTextColor={palette.muted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              value={form.city}
              onChangeText={(value) => handleUpdate('city', value)}
            />
            <View style={styles.row}>
              <TextInput
                placeholder="State"
                placeholderTextColor={palette.muted}
                style={[styles.input, styles.rowInput, { borderColor: palette.border, color: palette.text }]}
                value={form.state}
                onChangeText={(value) => handleUpdate('state', value)}
              />
              <TextInput
                placeholder="Zip"
                placeholderTextColor={palette.muted}
                keyboardType="number-pad"
                style={[styles.input, styles.rowInput, { borderColor: palette.border, color: palette.text }]}
                value={form.zipCode}
                onChangeText={(value) => handleUpdate('zipCode', value)}
              />
            </View>
            {locationError ? (
              <Text style={[styles.errorText, { color: palette.danger }]}>
                {locationError}
              </Text>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Assignment</Text>
              <Pressable
                onPress={() => setAssignmentExpanded((prev) => !prev)}
                style={styles.collapseButton}
              >
                <Text style={[styles.collapseLabel, { color: palette.muted }]}>
                  {assignmentExpanded ? 'Hide' : 'Edit'}
                </Text>
                <FontAwesome
                  name={assignmentExpanded ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={palette.muted}
                />
              </Pressable>
            </View>
            <Text style={[styles.assignmentSummary, { color: palette.muted }]}>
              Owner: {ownerDisplayName} • Territory: {territoryLabel} • Stage: {pipelineLabel}
            </Text>
            {assignmentExpanded ? (
              <>
                <Text style={[styles.label, { color: palette.muted }]}>Territory</Text>
                <View style={styles.chipWrap}>
                  {territoryOptions.map((option) => (
                    <ChoiceChip
                      key={option.id}
                      label={option.label}
                      selected={form.territoryId === option.id}
                      onPress={() => handleUpdate('territoryId', option.id)}
                    />
                  ))}
                </View>
                <Text style={[styles.label, { color: palette.muted }]}>Pipeline stage</Text>
                <View style={styles.chipWrap}>
                  {pipelineStageOptions
                    .filter((stage) => stage.value !== 'all')
                    .map((option) => (
                      <ChoiceChip
                        key={option.value}
                        label={option.label}
                        selected={form.pipelineStage === option.value}
                        onPress={() => handleUpdate('pipelineStage', option.value)}
                      />
                    ))}
                </View>
              </>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Activity snapshot</Text>
            <Button
              title="Record with AI"
              onPress={() => router.push('/(app)/(sales)/record')}
              style={styles.aiButton}
              labelStyle={styles.aiButtonLabel}
            />
            <Pressable
              onPress={() => setQuickSelectExpanded((prev) => !prev)}
              style={styles.collapseButton}
            >
              <Text style={[styles.collapseLabel, { color: palette.muted }]}>
                {quickSelectExpanded ? 'Hide quick selects' : 'Show quick selects'}
              </Text>
              <FontAwesome
                name={quickSelectExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={palette.muted}
              />
            </Pressable>
            {!quickSelectExpanded ? (
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Use quick selects if you prefer manual entry.
              </Text>
            ) : (
              <>
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
              </>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Follow up</Text>
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
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}

          <Button
            title={submitting ? 'Saving...' : 'Save lead'}
            onPress={handleSubmit}
            disabled={submitting}
          />
          <Pressable onPress={() => router.back()} style={styles.cancelLink}>
            <Text style={[styles.cancelText, { color: palette.muted }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
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
    lineHeight: 20,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapseLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  assignmentSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
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
  aiButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.brand.evergreen,
    borderColor: Colors.brand.evergreen,
  },
  aiButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowInput: {
    flex: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
