import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { CustomerServicePlan } from '@/lib/api/types';
import { API_BASE_URL } from '@/lib/config';

type AreasToClean = NonNullable<CustomerServicePlan['areasToClean']>;

const AREA_OPTIONS: Array<{ key: keyof AreasToClean; label: string }> = [
  { key: 'frontYard', label: 'Front yard' },
  { key: 'backYard', label: 'Back yard' },
  { key: 'sideYard', label: 'Side yard' },
  { key: 'dogRun', label: 'Dog run' },
  { key: 'fencedArea', label: 'Fenced area' },
];

const DIVERT_OPTIONS = [
  { value: 'none', label: 'Leave in bin' },
  { value: 'takeaway', label: 'Haul away' },
  { value: 'compost', label: 'Compost routing' },
] as const;

const DEODORIZE_OPTIONS = [
  { value: 'none', label: 'No deodorize' },
  { value: 'first-visit', label: 'First visit' },
  { value: 'each-visit', label: 'Every visit' },
] as const;

const formatCurrency = (value?: number | null) => {
  if (typeof value !== 'number') return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100);
};

export default function CustomerServicePlanScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [plan, setPlan] = useState<CustomerServicePlan | null>(null);
  const [draft, setDraft] = useState<CustomerServicePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<CustomerServicePlan>('/api/mobile/customer/service-plan', {
        token: session.token,
      });
      setPlan(data);
      setDraft(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load service plan.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const hasService = plan?.hasActiveService ?? false;

  const isDirty = useMemo(() => {
    if (!plan || !draft) return false;
    return (
      plan.dogCount !== draft.dogCount ||
      plan.deodorizeMode !== draft.deodorizeMode ||
      plan.divertMode !== draft.divertMode ||
      JSON.stringify(plan.areasToClean ?? {}) !== JSON.stringify(draft.areasToClean ?? {})
    );
  }, [draft, plan]);

  const updateDraft = (updates: Partial<CustomerServicePlan>) => {
    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
    setSuccessMessage(null);
  };

  const updateAreas = (key: keyof AreasToClean, value: boolean) => {
    const current = (draft?.areasToClean ?? {}) as AreasToClean;
    updateDraft({
      areasToClean: {
        ...current,
        [key]: value,
      },
    });
  };

  const updateOtherArea = (value: string) => {
    const current = (draft?.areasToClean ?? {}) as AreasToClean;
    updateDraft({
      areasToClean: {
        ...current,
        other: value,
      },
    });
  };

  const adjustDogs = (delta: number) => {
    if (!draft) return;
    const next = Math.max(1, (draft.dogCount ?? 1) + delta);
    updateDraft({ dogCount: next });
  };

  const handleSave = async () => {
    if (!session?.token || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        dogs: draft.dogCount,
        deodorizeMode: draft.deodorizeMode,
        divertMode: draft.divertMode,
        areasToClean: draft.areasToClean ?? {},
      };
      const data = await apiRequest<CustomerServicePlan>('/api/mobile/customer/service-plan', {
        method: 'PATCH',
        token: session.token,
        body: payload,
      });
      setPlan(data);
      setDraft(data);
      setSuccessMessage('Plan updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update plan.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={palette.tint} />
          <Text style={[styles.helperText, { color: palette.muted }]}>Loading plan...</Text>
        </View>
      </Screen>
    );
  }

  if (!plan && error) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={[styles.title, { color: palette.text }]}>Service plan</Text>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          <Button title="Try again" onPress={loadPlan} />
        </View>
      </Screen>
    );
  }

  if (!hasService) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={[styles.title, { color: palette.text }]}>Service plan</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Add a scooping plan to manage add-ons and keep pricing in sync.
          </Text>
          <Button title="Get a scooping quote" onPress={() => {
            Linking.openURL(`${API_BASE_URL}/quote`).catch(() => null);
          }} />
        </View>
      </Screen>
    );
  }

  const perVisitPrice = formatCurrency(plan?.perVisitAmountCents ?? null);
  const recurringPrice = formatCurrency(plan?.recurringAmountCents ?? null);
  const pricing = plan?.pricing ?? {};
  const estimatedPerVisit = typeof pricing.perVisit === 'number'
    ? formatCurrency(pricing.perVisit)
    : perVisitPrice;
  const estimatedMonthly = typeof pricing.monthly === 'number'
    ? formatCurrency(pricing.monthly)
    : recurringPrice;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: palette.muted }]}>Service plan</Text>
          <Text style={[styles.title, { color: palette.text }]}>Customize your scooping plan</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Adjust dogs, areas, and add-ons. We will update your per-visit price instantly.
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Current pricing</Text>
          <View style={styles.priceRow}>
            <View>
              <Text style={[styles.priceLabel, { color: palette.muted }]}>Per visit</Text>
              <Text style={[styles.priceValue, { color: palette.text }]}>{estimatedPerVisit}</Text>
            </View>
            <View>
              <Text style={[styles.priceLabel, { color: palette.muted }]}>Monthly</Text>
              <Text style={[styles.priceValue, { color: palette.text }]}>{estimatedMonthly}</Text>
            </View>
          </View>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Changes will update future visits. Taxes may apply at billing.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Dogs covered</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Keep your plan in sync with the number of dogs in the household.
          </Text>
          <View style={styles.counterRow}>
            <Pressable
              onPress={() => adjustDogs(-1)}
              style={({ pressed }) => [
                styles.counterButton,
                { borderColor: palette.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <FontAwesome name="minus" size={14} color={palette.text} />
            </Pressable>
            <Text style={[styles.counterValue, { color: palette.text }]}>
              {draft?.dogCount ?? 1}
            </Text>
            <Pressable
              onPress={() => adjustDogs(1)}
              style={({ pressed }) => [
                styles.counterButton,
                { borderColor: palette.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <FontAwesome name="plus" size={14} color={palette.text} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Areas to clean</Text>
          <View style={styles.chipWrap}>
            {AREA_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.key}
                label={option.label}
                selected={Boolean((draft?.areasToClean as AreasToClean | undefined)?.[option.key])}
                onPress={() =>
                  updateAreas(
                    option.key,
                    !Boolean((draft?.areasToClean as AreasToClean | undefined)?.[option.key]),
                  )
                }
              />
            ))}
            <ChoiceChip
              label="Other"
              selected={Boolean((draft?.areasToClean as AreasToClean | undefined)?.other)}
              onPress={() => {
                const current = (draft?.areasToClean as AreasToClean | undefined)?.other ?? '';
                updateOtherArea(current ? '' : 'Other area');
              }}
            />
          </View>
          {Boolean((draft?.areasToClean as AreasToClean | undefined)?.other) ? (
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder="Describe the other area"
              placeholderTextColor={palette.muted}
              value={(draft?.areasToClean as AreasToClean | undefined)?.other ?? ''}
              onChangeText={updateOtherArea}
            />
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Add-ons</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>
            Optional upgrades that change how we handle your visits.
          </Text>

          <Text style={[styles.subLabel, { color: palette.muted }]}>Deodorizing</Text>
          <View style={styles.chipWrap}>
            {DEODORIZE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={draft?.deodorizeMode === option.value}
                onPress={() => updateDraft({ deodorizeMode: option.value })}
              />
            ))}
          </View>

          <Text style={[styles.subLabel, { color: palette.muted }]}>Waste routing</Text>
          <View style={styles.chipWrap}>
            {DIVERT_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={draft?.divertMode === option.value}
                onPress={() => updateDraft({ divertMode: option.value })}
              />
            ))}
          </View>
        </View>

        {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}
        {successMessage ? (
          <Text style={[styles.successText, { color: palette.tint }]}>{successMessage}</Text>
        ) : null}

        <Button
          title={saving ? 'Saving...' : 'Save changes'}
          onPress={handleSave}
          disabled={!isDirty || saving}
        />

        <Text style={[styles.helperText, { color: palette.muted }]}>
          Need more help? Visit your full dashboard at {API_BASE_URL}.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  header: {
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 12,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardBody: {
    fontSize: 13,
  },
  helperText: {
    fontSize: 12,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
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
  subLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
