import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import type { CustomerServicePlan } from '@/lib/api/types';
import { API_BASE_URL } from '@/lib/config';

type AreasToClean = NonNullable<CustomerServicePlan['areasToClean']>;

type AreaOption = {
  key: keyof AreasToClean;
  label: string;
  icon: keyof typeof FontAwesome.glyphMap;
};

const AREA_OPTIONS: AreaOption[] = [
  { key: 'frontYard', label: 'Front yard', icon: 'home' },
  { key: 'backYard', label: 'Back yard', icon: 'tree' },
  { key: 'sideYard', label: 'Side yard', icon: 'arrows-h' },
  { key: 'dogRun', label: 'Dog run', icon: 'road' },
  { key: 'fencedArea', label: 'Fenced area', icon: 'th-large' },
];

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly', description: 'Once per week', icon: 'calendar' as const },
  { value: 'biweekly', label: 'Every 2 weeks', description: 'Twice per month', icon: 'calendar-o' as const },
  { value: 'monthly', label: 'Monthly', description: 'Once per month', icon: 'calendar-check-o' as const },
] as const;

const DEODORIZE_OPTIONS = [
  { value: 'none', label: 'No', description: 'No deodorizing', icon: 'times-circle' as const },
  { value: 'each-visit', label: 'Yes', description: 'Enzyme spray every visit', icon: 'check-circle' as const },
] as const;

const DIVERT_OPTIONS = [
  { value: 'none', label: 'Leave in bin', description: 'We bag it, you toss it', icon: 'trash' as const },
  { value: 'takeaway', label: 'Haul away', description: 'We take it with us', icon: 'truck' as const },
  { value: 'compost', label: 'Compost', description: 'Eco-friendly routing', icon: 'leaf' as const },
] as const;

const YARD_SIZE_LABELS: Record<string, { label: string; icon: keyof typeof FontAwesome.glyphMap }> = {
  small: { label: 'Small yard', icon: 'square' },
  medium: { label: 'Medium yard', icon: 'th-large' },
  large: { label: 'Large yard', icon: 'th' },
  'extra-large': { label: 'Extra large', icon: 'expand' },
};

const formatCurrency = (value?: number | null) => {
  if (typeof value !== 'number') return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100);
};

const getFrequencyLabel = (freq: string | null | undefined) => {
  if (!freq) return 'Weekly';
  const option = FREQUENCY_OPTIONS.find((o) => o.value === freq.toLowerCase());
  return option?.label ?? freq;
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
      plan.frequency !== draft.frequency ||
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
        frequency: draft.frequency,
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
      setSuccessMessage('Plan updated successfully!');
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
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: `${palette.tint}15` }]}>
            <FontAwesome name="calendar-check-o" size={32} color={palette.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No active service</Text>
          <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
            Get a scooping plan to manage your yard and keep your pups healthy.
          </Text>
          <Button
            title="Get a quote"
            onPress={() => Linking.openURL(`${API_BASE_URL}/quote`).catch(() => null)}
          />
        </View>
      </Screen>
    );
  }

  const pricing = plan?.pricing ?? {};
  const estimatedPerVisit = typeof pricing.perVisit === 'number'
    ? formatCurrency(pricing.perVisit)
    : formatCurrency(plan?.perVisitAmountCents ?? null);
  const estimatedMonthly = typeof pricing.monthly === 'number'
    ? formatCurrency(pricing.monthly)
    : formatCurrency(plan?.recurringAmountCents ?? null);

  const selectedAreasCount = AREA_OPTIONS.filter(
    (o) => (draft?.areasToClean as AreasToClean | undefined)?.[o.key]
  ).length + ((draft?.areasToClean as AreasToClean | undefined)?.other ? 1 : 0);

  const yardSizeInfo = draft?.yardSize
    ? YARD_SIZE_LABELS[draft.yardSize] ?? { label: draft.yardSize, icon: 'th-large' as const }
    : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: `${palette.tint}15` }]}>
            <FontAwesome name="sliders" size={20} color={palette.tint} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.text }]}>Service Plan</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Customize your scooping service
            </Text>
          </View>
          {/* Active badge */}
          <View style={[styles.activeBadge, { backgroundColor: `${Colors.brand.mint}15` }]}>
            <FontAwesome name="check-circle" size={12} color={Colors.brand.mint} />
            <Text style={[styles.activeBadgeText, { color: Colors.brand.mint }]}>Active</Text>
          </View>
        </View>

        {/* Service Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.summaryRow}>
            {/* Frequency */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: `${Colors.brand.coral}15` }]}>
                <FontAwesome name="calendar" size={14} color={Colors.brand.coral} />
              </View>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {getFrequencyLabel(draft?.frequency)}
              </Text>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Schedule</Text>
            </View>
            {/* Dogs */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
                <FontAwesome name="paw" size={14} color={Colors.brand.mint} />
              </View>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {draft?.dogCount ?? 1}
              </Text>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                {(draft?.dogCount ?? 1) === 1 ? 'Dog' : 'Dogs'}
              </Text>
            </View>
            {/* Areas */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
                <FontAwesome name="map" size={14} color={Colors.brand.gold} />
              </View>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {selectedAreasCount}
              </Text>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>
                {selectedAreasCount === 1 ? 'Area' : 'Areas'}
              </Text>
            </View>
          </View>
          {/* Yard size badge */}
          {yardSizeInfo && (
            <View style={[styles.yardSizeBadge, { backgroundColor: `${palette.tint}08` }]}>
              <FontAwesome name={yardSizeInfo.icon} size={12} color={palette.tint} />
              <Text style={[styles.yardSizeText, { color: palette.tint }]}>{yardSizeInfo.label}</Text>
            </View>
          )}
        </View>

        {/* Pricing Card */}
        <View style={[styles.pricingCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.pricingHeader}>
            <FontAwesome name="tag" size={14} color={palette.tint} />
            <Text style={[styles.pricingLabel, { color: palette.muted }]}>Current pricing</Text>
          </View>
          <View style={styles.pricingRow}>
            <View style={styles.pricingItem}>
              <Text style={[styles.pricingValue, { color: palette.text }]}>{estimatedPerVisit}</Text>
              <Text style={[styles.pricingUnit, { color: palette.muted }]}>per visit</Text>
            </View>
            <View style={[styles.pricingDivider, { backgroundColor: palette.border }]} />
            <View style={styles.pricingItem}>
              <Text style={[styles.pricingValue, { color: palette.text }]}>{estimatedMonthly}</Text>
              <Text style={[styles.pricingUnit, { color: palette.muted }]}>monthly est.</Text>
            </View>
          </View>
          {isDirty && (
            <View style={[styles.dirtyBadge, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="info-circle" size={12} color={Colors.brand.gold} />
              <Text style={[styles.dirtyText, { color: Colors.brand.gold }]}>
                Unsaved changes - pricing may update
              </Text>
            </View>
          )}
        </View>

        {/* Service Frequency Section */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: `${Colors.brand.coral}15` }]}>
              <FontAwesome name="calendar" size={16} color={Colors.brand.coral} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Service frequency</Text>
              <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                How often we visit
              </Text>
            </View>
          </View>
          <View style={styles.frequencyRow}>
            {FREQUENCY_OPTIONS.map((option) => {
              const isSelected = (draft?.frequency?.toLowerCase() ?? 'weekly') === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => updateDraft({ frequency: option.value })}
                  style={({ pressed }) => [
                    styles.frequencyChip,
                    {
                      backgroundColor: isSelected ? `${palette.tint}15` : palette.background,
                      borderColor: isSelected ? palette.tint : palette.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <FontAwesome
                    name={option.icon}
                    size={14}
                    color={isSelected ? palette.tint : palette.muted}
                  />
                  <Text
                    style={[
                      styles.frequencyChipText,
                      { color: isSelected ? palette.tint : palette.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkBadge, { backgroundColor: palette.tint }]}>
                      <FontAwesome name="check" size={8} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Dogs Section */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="paw" size={16} color={Colors.brand.mint} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Dogs covered</Text>
              <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                Number of dogs in your household
              </Text>
            </View>
          </View>
          <View style={styles.counterContainer}>
            <Pressable
              onPress={() => adjustDogs(-1)}
              disabled={(draft?.dogCount ?? 1) <= 1}
              style={({ pressed }) => [
                styles.counterButton,
                { backgroundColor: palette.background, borderColor: palette.border },
                pressed && { opacity: 0.7 },
                (draft?.dogCount ?? 1) <= 1 && { opacity: 0.4 },
              ]}
            >
              <FontAwesome name="minus" size={16} color={palette.text} />
            </Pressable>
            <View style={[styles.counterDisplay, { backgroundColor: palette.background }]}>
              <Text style={[styles.counterValue, { color: palette.text }]}>
                {draft?.dogCount ?? 1}
              </Text>
              <Text style={[styles.counterLabel, { color: palette.muted }]}>
                {(draft?.dogCount ?? 1) === 1 ? 'dog' : 'dogs'}
              </Text>
            </View>
            <Pressable
              onPress={() => adjustDogs(1)}
              style={({ pressed }) => [
                styles.counterButton,
                { backgroundColor: palette.background, borderColor: palette.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <FontAwesome name="plus" size={16} color={palette.text} />
            </Pressable>
          </View>
        </View>

        {/* Areas Section */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
              <FontAwesome name="map" size={16} color={Colors.brand.gold} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Areas to clean</Text>
              <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                {selectedAreasCount} area{selectedAreasCount !== 1 ? 's' : ''} selected
              </Text>
            </View>
          </View>
          <View style={styles.areaGrid}>
            {AREA_OPTIONS.map((option) => {
              const isSelected = Boolean((draft?.areasToClean as AreasToClean | undefined)?.[option.key]);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => updateAreas(option.key, !isSelected)}
                  style={({ pressed }) => [
                    styles.areaCard,
                    {
                      backgroundColor: isSelected ? `${palette.tint}10` : palette.background,
                      borderColor: isSelected ? palette.tint : palette.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <FontAwesome
                    name={option.icon}
                    size={18}
                    color={isSelected ? palette.tint : palette.muted}
                  />
                  <Text
                    style={[
                      styles.areaLabel,
                      { color: isSelected ? palette.tint : palette.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.areaCheck, { backgroundColor: palette.tint }]}>
                      <FontAwesome name="check" size={8} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                const current = (draft?.areasToClean as AreasToClean | undefined)?.other ?? '';
                updateOtherArea(current ? '' : 'Other area');
              }}
              style={({ pressed }) => [
                styles.areaCard,
                {
                  backgroundColor: (draft?.areasToClean as AreasToClean | undefined)?.other
                    ? `${palette.tint}10`
                    : palette.background,
                  borderColor: (draft?.areasToClean as AreasToClean | undefined)?.other
                    ? palette.tint
                    : palette.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <FontAwesome
                name="plus-circle"
                size={18}
                color={
                  (draft?.areasToClean as AreasToClean | undefined)?.other
                    ? palette.tint
                    : palette.muted
                }
              />
              <Text
                style={[
                  styles.areaLabel,
                  {
                    color: (draft?.areasToClean as AreasToClean | undefined)?.other
                      ? palette.tint
                      : palette.text,
                  },
                ]}
              >
                Other
              </Text>
            </Pressable>
          </View>
          {Boolean((draft?.areasToClean as AreasToClean | undefined)?.other) && (
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.background }]}
              placeholder="Describe the other area"
              placeholderTextColor={palette.muted}
              value={(draft?.areasToClean as AreasToClean | undefined)?.other ?? ''}
              onChangeText={updateOtherArea}
            />
          )}
        </View>

        {/* Deodorizing Section */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: `${Colors.brand.coral}15` }]}>
              <FontAwesome name="magic" size={16} color={Colors.brand.coral} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Deodorizing</Text>
              <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                Enzyme spray for odor control
              </Text>
            </View>
          </View>
          <View style={styles.optionList}>
            {DEODORIZE_OPTIONS.map((option) => {
              const isSelected = (draft?.deodorizeMode ?? 'none') === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => updateDraft({ deodorizeMode: option.value })}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      backgroundColor: isSelected ? `${palette.tint}10` : palette.background,
                      borderColor: isSelected ? palette.tint : palette.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: isSelected ? `${palette.tint}15` : `${palette.muted}15` }]}>
                    <FontAwesome name={option.icon} size={14} color={isSelected ? palette.tint : palette.muted} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionLabel, { color: palette.text }]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, { color: palette.muted }]}>{option.description}</Text>
                  </View>
                  <View style={[styles.radioOuter, { borderColor: isSelected ? palette.tint : palette.border }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: palette.tint }]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Waste Routing Section */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="recycle" size={16} color={Colors.brand.mint} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Waste routing</Text>
              <Text style={[styles.cardSubtitle, { color: palette.muted }]}>
                How we handle the waste
              </Text>
            </View>
          </View>
          <View style={styles.optionList}>
            {DIVERT_OPTIONS.map((option) => {
              const isSelected = (draft?.divertMode ?? 'none') === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => updateDraft({ divertMode: option.value })}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      backgroundColor: isSelected ? `${palette.tint}10` : palette.background,
                      borderColor: isSelected ? palette.tint : palette.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: isSelected ? `${palette.tint}15` : `${palette.muted}15` }]}>
                    <FontAwesome name={option.icon} size={14} color={isSelected ? palette.tint : palette.muted} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionLabel, { color: palette.text }]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, { color: palette.muted }]}>{option.description}</Text>
                  </View>
                  <View style={[styles.radioOuter, { borderColor: isSelected ? palette.tint : palette.border }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: palette.tint }]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Error/Success Messages */}
        {error && (
          <View style={[styles.messageCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
            <Text style={[styles.messageText, { color: palette.danger }]}>{error}</Text>
          </View>
        )}
        {successMessage && (
          <View style={[styles.messageCard, { backgroundColor: `${Colors.brand.mint}10`, borderColor: Colors.brand.mint }]}>
            <FontAwesome name="check-circle" size={14} color={Colors.brand.mint} />
            <Text style={[styles.messageText, { color: Colors.brand.mint }]}>{successMessage}</Text>
          </View>
        )}

        {/* Save Button */}
        <Button
          title={saving ? 'Saving...' : isDirty ? 'Save changes' : 'No changes'}
          onPress={handleSave}
          disabled={!isDirty || saving}
        />

        {/* Help Link */}
        <Pressable
          onPress={() => Linking.openURL(`${API_BASE_URL}/dashboard`).catch(() => null)}
          style={({ pressed }) => [styles.helpLink, pressed && { opacity: 0.7 }]}
        >
          <FontAwesome name="external-link" size={12} color={palette.muted} />
          <Text style={[styles.helpText, { color: palette.muted }]}>
            Manage billing & more on the web dashboard
          </Text>
        </Pressable>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 6,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
  },
  yardSizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  yardSizeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pricingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pricingLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricingItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pricingValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  pricingUnit: {
    fontSize: 12,
  },
  pricingDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  dirtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dirtyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  frequencyChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 14,
    position: 'relative',
  },
  frequencyChipText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  counterButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterDisplay: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 80,
  },
  counterValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  counterLabel: {
    fontSize: 12,
  },
  areaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  areaCard: {
    width: '31%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'relative',
  },
  areaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  areaCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  helpText: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
