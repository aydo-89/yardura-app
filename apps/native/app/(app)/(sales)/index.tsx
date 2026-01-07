import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import type { LeadOwner, OutboundLead } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSales } from '@/lib/sales/SalesProvider';
import {
  dogPresenceOptions,
  encounterOptions,
  formatLeadAddress,
  formatLeadName,
  getLeadCoordinates,
  objectionOptions,
  pipelineStageOptions,
  stageColorToHex,
} from '@/lib/sales/utils';

const nextActionOptions = [
  { value: 'all', label: 'All next actions' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'none', label: 'No next action' },
];

const ownerFilterLabel = (owner: LeadOwner | null | undefined) =>
  owner?.name || owner?.email || 'Unassigned';

const buildOwnerOptions = (owners: LeadOwner[]) => [
  { id: 'all', label: 'All reps' },
  { id: 'unassigned', label: 'Unassigned' },
  ...owners.map((owner) => ({
    id: owner.id,
    label: ownerFilterLabel(owner),
  })),
];

const buildTerritoryOptions = (territories: Array<{ id: string; name: string }>) => [
  { id: 'all', label: 'All territories' },
  { id: 'unassigned', label: 'Unassigned' },
  ...territories.map((territory) => ({
    id: territory.id,
    label: territory.name,
  })),
];

const formatRelativeTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatNextAction = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

function LeadCard({
  lead,
  selected,
  selectionMode,
  onPress,
  onSelect,
  onViewMap,
}: {
  lead: OutboundLead;
  selected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onSelect: () => void;
  onViewMap?: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const name = formatLeadName(lead);
  const address = formatLeadAddress(lead);
  const ownerLabel = ownerFilterLabel(lead.owner);
  const stageLabel =
    pipelineStageOptions.find((stage) => stage.value === lead.pipelineStage)?.label
    || lead.pipelineStage
    || 'Unknown';
  const lastActivity = lead.lastActivity?.result ?? lead.lastActivity?.type ?? null;
  const lastActivityTime = formatRelativeTime(lead.lastActivity?.occurredAt);
  const nextAction = formatNextAction(lead.nextActionAt);
  const cadenceLabel = lead.cadenceEnrollments?.[0]?.cadence?.name ?? null;
  const coords = useMemo(() => getLeadCoordinates(lead), [lead]);

  return (
    <Pressable
      onPress={selectionMode ? onSelect : onPress}
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          {selectionMode ? (
            <Pressable
              onPress={onSelect}
              style={[
                styles.selectDot,
                {
                  borderColor: selected ? palette.tint : palette.border,
                  backgroundColor: selected ? palette.tint : 'transparent',
                },
              ]}
            >
              {selected ? (
                <FontAwesome name="check" size={12} color="#fff" />
              ) : null}
            </Pressable>
          ) : null}
          <Text style={[styles.cardTitle, { color: palette.text }]}>{name}</Text>
        </View>
        <View
          style={[
            styles.stageBadge,
            {
              borderColor: stageColorToHex(lead.stageColor),
              backgroundColor:
                colorScheme === 'dark'
                  ? 'rgba(15, 23, 42, 0.6)'
                  : 'rgba(255,255,255,0.8)',
            },
          ]}
        >
          <View
            style={[
              styles.stageDot,
              { backgroundColor: stageColorToHex(lead.stageColor) },
            ]}
          />
          <Text style={[styles.stageText, { color: palette.text }]}>{stageLabel}</Text>
        </View>
      </View>

      {address ? (
        <Text style={[styles.cardBody, { color: palette.muted }]}>{address}</Text>
      ) : null}

      {!selectionMode && coords && onViewMap ? (
        <Pressable onPress={onViewMap} style={styles.mapQuickRow}>
          <FontAwesome name="map-marker" size={14} color={palette.tint} />
          <Text style={[styles.mapQuickLabel, { color: palette.tint }]}>
            View on map
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.cardMetaRow}>
        <Text style={[styles.metaLabel, { color: palette.muted }]}>Owner</Text>
        <Text style={[styles.metaValue, { color: palette.text }]}>{ownerLabel}</Text>
      </View>
      {lead.territory?.name ? (
        <View style={styles.cardMetaRow}>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>Territory</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>{lead.territory.name}</Text>
        </View>
      ) : null}
      {lead.serviceArea ? (
        <View style={styles.cardMetaRow}>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>Service area</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>
            {lead.serviceArea.slug} - {lead.serviceArea.status.toLowerCase()}
          </Text>
        </View>
      ) : null}
      {nextAction ? (
        <View style={styles.cardMetaRow}>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>Next action</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>{nextAction}</Text>
        </View>
      ) : null}
      {lastActivity ? (
        <View style={styles.cardMetaRow}>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>Last activity</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>
            {lastActivity}
            {lastActivityTime ? ` - ${lastActivityTime}` : ''}
          </Text>
        </View>
      ) : null}
      {cadenceLabel ? (
        <View style={styles.cardMetaRow}>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>Cadence</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>{cadenceLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function SalesLeadsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { highlightLeadId } = useLocalSearchParams<{ highlightLeadId?: string }>();
  const { session } = useAuth();
  const {
    filters,
    updateFilters,
    leads,
    filteredLeads,
    loading,
    error,
    owners,
    territories,
    refresh,
    loadMore,
    hasMore,
  } = useSales();
  const listRef = useRef<FlatList<OutboundLead> | null>(null);
  const [search, setSearch] = useState(filters.search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignOwnerId, setBulkAssignOwnerId] = useState<string>('unassigned');
  const [bulkLoading, setBulkLoading] = useState(false);

  const ownerOptions = useMemo(() => buildOwnerOptions(owners), [owners]);
  const territoryOptions = useMemo(
    () => buildTerritoryOptions(territories),
    [territories],
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      updateFilters({ search: search.trim() });
    }, 400);
    return () => clearTimeout(handler);
  }, [search, updateFilters]);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedLeadIds([]);
    }
  }, [selectionMode]);

  useEffect(() => {
    if (!highlightLeadId) return;
    const index = filteredLeads.findIndex((lead) => lead.id === highlightLeadId);
    if (index < 0) return;
    if (!listRef.current) return;
    try {
      listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    } catch {
      // ignore
    }
  }, [filteredLeads, highlightLeadId]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.stage !== 'all') count += 1;
    if (filters.ownerId !== 'all') count += 1;
    if (filters.territoryId !== 'all') count += 1;
    if (filters.nextAction !== 'all') count += 1;
    if (filters.encounterIncludes.length || filters.encounterExclusions.length) count += 1;
    if (filters.dogIncludes.length || filters.dogExclusions.length) count += 1;
    if (filters.objectionIncludes.length || filters.objectionExclusions.length) count += 1;
    if (filters.includeConverted) count += 1;
    return count;
  }, [filters]);

  const handleToggleSelection = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => (
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    ));
  }, []);

  const handleBulkAssign = async (ownerId: string | null) => {
    if (!session?.token || bulkLoading || selectedLeadIds.length === 0) return;
    setBulkLoading(true);
    try {
      for (const leadId of selectedLeadIds) {
        await apiRequest(`/api/leads/${leadId}`, {
          method: 'PATCH',
          token: session.token,
          body: { ownerId },
        });
      }
      await refresh();
      setSelectedLeadIds([]);
      setSelectionMode(false);
    } catch (err) {
      console.warn('Bulk assignment failed', err);
    } finally {
      setBulkLoading(false);
      setBulkAssignOpen(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!session?.token || bulkLoading || selectedLeadIds.length === 0) return;
    setBulkLoading(true);
    try {
      for (const leadId of selectedLeadIds) {
        await apiRequest(`/api/leads/${leadId}`, {
          method: 'DELETE',
          token: session.token,
        });
      }
      await refresh();
      setSelectedLeadIds([]);
      setSelectionMode(false);
    } catch (err) {
      console.warn('Bulk delete failed', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleEncounterInclude = (value: string) => {
    updateFilters((prev) => {
      const includes = prev.encounterIncludes.includes(value)
        ? prev.encounterIncludes.filter((item) => item !== value)
        : [...prev.encounterIncludes, value];
      const exclusions = prev.encounterExclusions.filter((item) => item !== value);
      return { ...prev, encounterIncludes: includes, encounterExclusions: exclusions };
    });
  };

  const toggleEncounterExclude = (value: string) => {
    updateFilters((prev) => {
      const exclusions = prev.encounterExclusions.includes(value)
        ? prev.encounterExclusions.filter((item) => item !== value)
        : [...prev.encounterExclusions, value];
      const includes = prev.encounterIncludes.filter((item) => item !== value);
      return { ...prev, encounterExclusions: exclusions, encounterIncludes: includes };
    });
  };

  const toggleDogInclude = (value: string) => {
    updateFilters((prev) => {
      const includes = prev.dogIncludes.includes(value as any)
        ? prev.dogIncludes.filter((item) => item !== value)
        : [...prev.dogIncludes, value as any];
      const exclusions = prev.dogExclusions.filter((item) => item !== value);
      return { ...prev, dogIncludes: includes, dogExclusions: exclusions };
    });
  };

  const toggleDogExclude = (value: string) => {
    updateFilters((prev) => {
      const exclusions = prev.dogExclusions.includes(value as any)
        ? prev.dogExclusions.filter((item) => item !== value)
        : [...prev.dogExclusions, value as any];
      const includes = prev.dogIncludes.filter((item) => item !== value);
      return { ...prev, dogExclusions: exclusions, dogIncludes: includes };
    });
  };

  const toggleObjectionInclude = (value: string) => {
    updateFilters((prev) => {
      const includes = prev.objectionIncludes.includes(value)
        ? prev.objectionIncludes.filter((item) => item !== value)
        : [...prev.objectionIncludes, value];
      const exclusions = prev.objectionExclusions.filter((item) => item !== value);
      return { ...prev, objectionIncludes: includes, objectionExclusions: exclusions };
    });
  };

  const toggleObjectionExclude = (value: string) => {
    updateFilters((prev) => {
      const exclusions = prev.objectionExclusions.includes(value)
        ? prev.objectionExclusions.filter((item) => item !== value)
        : [...prev.objectionExclusions, value];
      const includes = prev.objectionIncludes.filter((item) => item !== value);
      return { ...prev, objectionExclusions: exclusions, objectionIncludes: includes };
    });
  };

  const clearTagFilters = () => {
    updateFilters({
      encounterIncludes: [],
      encounterExclusions: [],
      dogIncludes: [],
      dogExclusions: [],
      objectionIncludes: [],
      objectionExclusions: [],
    });
  };

  return (
    <Screen padded={false}>
      <View style={[styles.header, { backgroundColor: palette.background }]}>
        <View>
          <Text style={[styles.kicker, { color: palette.muted }]}>Canvassing</Text>
          <Text style={[styles.title, { color: palette.text }]}>Outbound leads</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Track every knock, follow up on schedule, and keep your turf moving.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/(app)/(sales)/lead/new')}
          style={[styles.newLeadButton, { backgroundColor: palette.tint }]}
        >
          <FontAwesome name="plus" size={16} color="#fff" />
          <Text style={styles.newLeadLabel}>New lead</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchField, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <FontAwesome name="search" size={14} color={palette.muted} />
          <TextInput
            placeholder="Search leads"
            placeholderTextColor={palette.muted}
            style={[styles.searchInput, { color: palette.text }]}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable
          onPress={() => setFilterOpen(true)}
          style={[
            styles.filterButton,
            {
              borderColor: palette.border,
              backgroundColor: palette.card,
            },
          ]}
        >
          <FontAwesome name="sliders" size={14} color={palette.text} />
          <Text style={[styles.filterButtonLabel, { color: palette.text }]}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      <View style={styles.toolbarRow}>
        <Text style={[styles.resultLabel, { color: palette.muted }]}>
          Showing {filteredLeads.length} of {leads.length}
        </Text>
        <View style={styles.toolbarActions}>
          <Button
            title={selectionMode ? 'Done' : 'Select'}
            onPress={() => setSelectionMode((prev) => !prev)}
            variant="ghost"
            style={styles.toolbarButton}
            labelStyle={styles.toolbarButtonLabel}
          />
          <Button
            title="Refresh"
            onPress={refresh}
            variant="secondary"
            style={styles.toolbarButton}
            labelStyle={styles.toolbarButtonLabel}
          />
        </View>
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
      ) : null}

      {loading && leads.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={palette.tint} />
        </View>
      ) : (
        <FlatList
          ref={(ref) => {
            listRef.current = ref;
          }}
          contentContainerStyle={styles.listContent}
          data={filteredLeads}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={refresh}
          onScrollToIndexFailed={(info) => {
            if (!listRef.current) return;
            listRef.current.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          renderItem={({ item }) => (
            <LeadCard
              lead={item}
              selected={selectedLeadIds.includes(item.id)}
              selectionMode={selectionMode}
              onSelect={() => handleToggleSelection(item.id)}
              onPress={() => router.push(`/(app)/(sales)/lead/${item.id}`)}
              onViewMap={() =>
                router.push({
                  pathname: '/(app)/(sales)/map',
                  params: { leadId: item.id },
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                No leads match these filters yet.
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Button
                title={loading ? 'Loading...' : 'Load more'}
                onPress={loadMore}
                disabled={loading}
                variant="secondary"
                style={styles.loadMore}
              />
            ) : null
          }
        />
      )}

      {selectionMode && selectedLeadIds.length > 0 ? (
        <View
          style={[
            styles.bulkBar,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.bulkLabel, { color: palette.text }]}>
            {selectedLeadIds.length} selected
          </Text>
          <View style={styles.bulkActions}>
            <Button
              title="Assign"
              onPress={() => setBulkAssignOpen(true)}
              variant="secondary"
              style={styles.bulkButton}
              labelStyle={styles.bulkButtonLabel}
            />
            <Button
              title="Unassign"
              onPress={() => handleBulkAssign(null)}
              variant="ghost"
              style={styles.bulkButton}
              labelStyle={styles.bulkButtonLabel}
            />
            <Button
              title="Delete"
              onPress={handleBulkDelete}
              variant="danger"
              style={styles.bulkButton}
              labelStyle={styles.bulkButtonLabel}
            />
          </View>
        </View>
      ) : null}

      <Modal visible={filterOpen} animationType="slide">
        <Screen>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Filters</Text>
              <Button title="Done" onPress={() => setFilterOpen(false)} variant="ghost" />
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Pipeline stage</Text>
              <View style={styles.chipWrap}>
                {pipelineStageOptions.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={filters.stage === option.value}
                    onPress={() => updateFilters({ stage: option.value })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Owner</Text>
              <View style={styles.chipWrap}>
                {ownerOptions.map((option) => (
                  <ChoiceChip
                    key={option.id}
                    label={option.label}
                    selected={filters.ownerId === option.id}
                    onPress={() => updateFilters({ ownerId: option.id })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Territory</Text>
              <View style={styles.chipWrap}>
                {territoryOptions.map((option) => (
                  <ChoiceChip
                    key={option.id}
                    label={option.label}
                    selected={filters.territoryId === option.id}
                    onPress={() => updateFilters({ territoryId: option.id })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Next action</Text>
              <View style={styles.chipWrap}>
                {nextActionOptions.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={filters.nextAction === option.value}
                    onPress={() => updateFilters({ nextAction: option.value as any })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Converted leads</Text>
              <ChoiceChip
                label={filters.includeConverted ? 'Including converted' : 'Hide converted'}
                selected={filters.includeConverted}
                onPress={() => updateFilters({ includeConverted: !filters.includeConverted })}
              />
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Encounter outcomes</Text>
              <Text style={[styles.sectionHint, { color: palette.muted }]}>Include</Text>
              <View style={styles.chipWrap}>
                {encounterOptions.map((option) => (
                  <ChoiceChip
                    key={`encounter-inc-${option.value}`}
                    label={option.label}
                    selected={filters.encounterIncludes.includes(option.value)}
                    onPress={() => toggleEncounterInclude(option.value)}
                  />
                ))}
              </View>
              <Text style={[styles.sectionHint, { color: palette.muted }]}>Exclude</Text>
              <View style={styles.chipWrap}>
                {encounterOptions.map((option) => (
                  <ChoiceChip
                    key={`encounter-exc-${option.value}`}
                    label={option.label}
                    selected={filters.encounterExclusions.includes(option.value)}
                    onPress={() => toggleEncounterExclude(option.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Dog presence</Text>
              <Text style={[styles.sectionHint, { color: palette.muted }]}>Include</Text>
              <View style={styles.chipWrap}>
                {dogPresenceOptions.map((option) => (
                  <ChoiceChip
                    key={`dog-inc-${option.value}`}
                    label={option.label}
                    selected={filters.dogIncludes.includes(option.value)}
                    onPress={() => toggleDogInclude(option.value)}
                  />
                ))}
              </View>
              <Text style={[styles.sectionHint, { color: palette.muted }]}>Exclude</Text>
              <View style={styles.chipWrap}>
                {dogPresenceOptions.map((option) => (
                  <ChoiceChip
                    key={`dog-exc-${option.value}`}
                    label={option.label}
                    selected={filters.dogExclusions.includes(option.value)}
                    onPress={() => toggleDogExclude(option.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Objections</Text>
              <Text style={[styles.sectionHint, { color: palette.muted }]}>Include</Text>
              <View style={styles.chipWrap}>
                {objectionOptions.map((option) => (
                  <ChoiceChip
                    key={`obj-inc-${option.value}`}
                    label={option.label}
                    selected={filters.objectionIncludes.includes(option.value)}
                    onPress={() => toggleObjectionInclude(option.value)}
                  />
                ))}
              </View>
              <Text style={[styles.sectionHint, { color: palette.muted }]}>Exclude</Text>
              <View style={styles.chipWrap}>
                {objectionOptions.map((option) => (
                  <ChoiceChip
                    key={`obj-exc-${option.value}`}
                    label={option.label}
                    selected={filters.objectionExclusions.includes(option.value)}
                    onPress={() => toggleObjectionExclude(option.value)}
                  />
                ))}
              </View>
              <Button
                title="Clear tag filters"
                onPress={clearTagFilters}
                variant="ghost"
                style={styles.clearFilters}
              />
            </View>
          </ScrollView>
        </Screen>
      </Modal>

      <Modal visible={bulkAssignOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.bulkModal,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.text }]}>Assign leads</Text>
            <ScrollView style={styles.bulkList}>
              {ownerOptions
                .filter((option) => option.id !== 'all')
                .map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => setBulkAssignOwnerId(option.id)}
                    style={[
                      styles.bulkOption,
                      {
                        borderColor:
                          bulkAssignOwnerId === option.id
                            ? palette.tint
                            : palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.bulkOptionLabel, { color: palette.text }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
            <View style={styles.bulkFooter}>
              <Button
                title="Cancel"
                onPress={() => setBulkAssignOpen(false)}
                variant="ghost"
                style={styles.bulkButton}
                labelStyle={styles.bulkButtonLabel}
              />
              <Button
                title={bulkLoading ? 'Assigning...' : 'Assign'}
                onPress={() =>
                  handleBulkAssign(
                    bulkAssignOwnerId === 'unassigned'
                      ? null
                      : bulkAssignOwnerId,
                  )
                }
                disabled={bulkLoading}
                style={styles.bulkButton}
                labelStyle={styles.bulkButtonLabel}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  newLeadButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  newLeadLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  filterButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  toolbarRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: {
    fontSize: 12,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toolbarButtonLabel: {
    fontSize: 12,
  },
  errorText: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 13,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
    gap: 12,
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  selectDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 13,
  },
  mapQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  mapQuickLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 12,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadMore: {
    marginTop: 8,
  },
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  bulkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkButton: {
    flex: 1,
    paddingVertical: 10,
  },
  bulkButtonLabel: {
    fontSize: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterSection: {
    marginBottom: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clearFilters: {
    alignSelf: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  bulkModal: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    maxHeight: '80%',
  },
  bulkList: {
    marginTop: 12,
  },
  bulkOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  bulkOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
});
