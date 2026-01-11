import { useFocusEffect } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import Screen from '@/components/ui/Screen';
import Switch from '@/components/ui/ThemedSwitch';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  useFoodLog,
  TYPE_OPTIONS,
  QUICK_TIME_OPTIONS,
  FoodType,
  formatTypeLabel,
  formatTimeLabel,
  parseTimeInput,
  sortTimes,
  getPlaceholders,
} from '@/lib/food/useFoodLog';
import type { WellnessFoodProduct, WellnessFoodSchedule } from '@/lib/api/types';

export default function FoodPantryScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [typeFilter, setTypeFilter] = useState<'ALL' | FoodType>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<WellnessFoodProduct | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Edit form state
  const [editType, setEditType] = useState<FoodType>('FOOD');
  const [editDogId, setEditDogId] = useState<string | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editPortion, setEditPortion] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [scheduleInput, setScheduleInput] = useState('');

  const {
    dogs,
    products,
    schedules,
    dogNameMap,
    loading,
    savingProduct,
    savingSchedule,
    deletingProductId,
    quickLogId,
    access,
    multiDogLocked,
    inventoryLocked,
    inventoryRemaining,
    productMessage,
    scheduleMessage,
    loadData,
    updateProduct,
    deleteProduct,
    quickLogProduct,
    saveSchedule,
    setProductMessage,
    setScheduleMessage,
  } = useFoodLog({ token: session?.token });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Filter products
  const filteredProducts = useMemo(() => {
    if (typeFilter === 'ALL') return products;
    return products.filter((p) => p.type === typeFilter);
  }, [products, typeFilter]);

  // Get schedule for selected product
  const activeSchedule = useMemo(() => {
    if (!selectedProduct) return null;
    return schedules.find(
      (s) =>
        s.productId === selectedProduct.id &&
        (editDogId ? s.dogId === editDogId : !s.dogId),
    ) ?? null;
  }, [schedules, selectedProduct, editDogId]);

  const handleOpenDetail = (product: WellnessFoodProduct) => {
    setSelectedProduct(product);
    setEditType(product.type);
    setEditDogId(product.dogId ?? null);
    setEditBrand(product.brand ?? '');
    setEditProductName(product.productName ?? '');
    setEditPortion(product.portion ?? '');
    setEditNotes(product.notes ?? '');

    // Load schedule
    const schedule = schedules.find(
      (s) => s.productId === product.id && (product.dogId ? s.dogId === product.dogId : !s.dogId),
    );
    setScheduleEnabled(schedule?.active ?? false);
    setScheduleTimes(schedule ? sortTimes(schedule.timesOfDay) : []);
    setScheduleInput('');

    setDetailSheetOpen(true);
    setProductMessage(null);
    setScheduleMessage(null);
  };

  const handleCloseDetail = () => {
    setDetailSheetOpen(false);
    setSelectedProduct(null);
  };

  const handleSaveProduct = async () => {
    if (!selectedProduct) return;
    await updateProduct(selectedProduct.id, {
      type: editType,
      dogId: editDogId,
      brand: editBrand,
      productName: editProductName,
      portion: editPortion,
      notes: editNotes,
      announce: true,
    });
  };

  const handleDeleteProduct = () => {
    if (!selectedProduct) return;
    deleteProduct(selectedProduct, () => {
      handleCloseDetail();
    });
  };

  const handleQuickLog = async (product: WellnessFoodProduct) => {
    await quickLogProduct(product);
  };

  // Schedule handlers
  const handleAddQuickTime = (value: string) => {
    if (scheduleTimes.includes(value)) return;
    setScheduleTimes(sortTimes([...scheduleTimes, value]));
  };

  const handleAddCustomTime = () => {
    if (!scheduleInput.trim()) return;
    const parsed = parseTimeInput(scheduleInput);
    if (!parsed) {
      setScheduleMessage('Enter a valid time like 7:00 AM.');
      return;
    }
    setScheduleMessage(null);
    setScheduleInput('');
    if (scheduleTimes.includes(parsed)) return;
    setScheduleTimes(sortTimes([...scheduleTimes, parsed]));
  };

  const handleRemoveTime = (value: string) => {
    setScheduleTimes((prev) => prev.filter((t) => t !== value));
  };

  const handleSaveSchedule = async () => {
    if (!selectedProduct) return;
    await saveSchedule({
      productId: selectedProduct.id,
      dogId: editDogId,
      active: scheduleEnabled,
      timesOfDay: scheduleTimes,
      existingScheduleId: activeSchedule?.id,
    });
  };

  const placeholders = useMemo(() => getPlaceholders(editType), [editType]);

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : '#1E293B';

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero header */}
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <Pressable style={styles.backButton} onPress={() => router.push('/(app)/(customer)/food-log' as Href)}>
            <FontAwesome name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>
            Food & Meds
          </Text>
          <Text style={styles.heroTitle}>Pantry</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            Manage saved items and auto-log schedules.
          </Text>
        </View>

        {/* Add item action */}
        <View style={styles.addRow}>
          <Button
            title="Scan new item"
            onPress={() => router.push('/(app)/(customer)/food-scan' as Href)}
            style={styles.addButton}
          />
          {access?.tier === 'FREE' && (
            <Text
              style={[
                styles.limitText,
                { color: inventoryLocked ? palette.danger : palette.muted },
              ]}
            >
              {inventoryRemaining ?? 0} inventory adds left
            </Text>
          )}
        </View>

        {/* Type filter */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: palette.muted }]}>Filter by type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <ChoiceChip
              label="All"
              selected={typeFilter === 'ALL'}
              onPress={() => setTypeFilter('ALL')}
            />
            {TYPE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={typeFilter === option.value}
                onPress={() => setTypeFilter(option.value)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Product list */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Inventory ({filteredProducts.length})
          </Text>

          {loading && products.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                {products.length === 0
                  ? 'No saved items yet. Scan an item to add it.'
                  : 'No items match this filter.'}
              </Text>
            </View>
          ) : (
            filteredProducts.map((product) => {
              const label = product.productName || product.brand || 'Item';
              const dogLabel = product.dogId ? dogNameMap.get(product.dogId) ?? 'Dog' : 'Household';
              const isLogging = quickLogId === product.id;
              const isDeleting = deletingProductId === product.id;
              const productSchedule = schedules.find((s) => s.productId === product.id && s.active);

              return (
                <Pressable
                  key={product.id}
                  style={[styles.productCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                  onPress={() => handleOpenDetail(product)}
                >
                  <View style={styles.productRow}>
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
                    ) : (
                      <View style={[styles.productImageFallback, { backgroundColor: palette.background }]}>
                        <FontAwesome name="cutlery" size={18} color={palette.muted} />
                      </View>
                    )}
                    <View style={styles.productMeta}>
                      <Text style={[styles.productName, { color: palette.text }]} numberOfLines={1}>
                        {label}
                      </Text>
                      <Text style={[styles.productDetails, { color: palette.muted }]}>
                        {formatTypeLabel(product.type)} · {dogLabel}
                      </Text>
                      {productSchedule && (
                        <View style={styles.scheduleIndicator}>
                          <FontAwesome name="clock-o" size={10} color={Colors.brand.mint} />
                          <Text style={[styles.scheduleText, { color: Colors.brand.mint }]}>
                            Auto-log active
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.productActions}>
                    <Pressable
                      style={[styles.actionButton, { borderColor: palette.border }]}
                      onPress={() => handleQuickLog(product)}
                      disabled={isLogging}
                    >
                      <Text style={[styles.actionButtonText, { color: palette.text }]}>
                        {isLogging ? '...' : 'Log now'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => handleOpenDetail(product)}>
                      <Text style={[styles.editLink, { color: palette.tint }]}>Edit</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Detail sheet */}
      <BottomSheet visible={detailSheetOpen} onClose={handleCloseDetail} snapPoints={[0.85]}>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Edit item</Text>
            <Pressable
              style={[styles.closeButton, { backgroundColor: `${palette.muted}15` }]}
              onPress={handleCloseDetail}
            >
              <FontAwesome name="times" size={16} color={palette.muted} />
            </Pressable>
          </View>

          {/* Type */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: palette.muted }]}>Type</Text>
            <View style={styles.chipRow}>
              {TYPE_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  label={option.label}
                  selected={editType === option.value}
                  onPress={() => setEditType(option.value)}
                />
              ))}
            </View>
            <Text style={[styles.typeHint, { color: palette.muted }]}>
              {TYPE_OPTIONS.find((o) => o.value === editType)?.examples}
            </Text>
          </View>

          {/* Dog */}
          {dogs.length > 0 && (
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: palette.muted }]}>For</Text>
              <View style={styles.chipRow}>
                <ChoiceChip
                  label="Household"
                  selected={!editDogId}
                  onPress={() => setEditDogId(null)}
                  disabled={multiDogLocked}
                />
                {dogs.map((dog) => (
                  <ChoiceChip
                    key={dog.id}
                    label={dog.name}
                    selected={editDogId === dog.id}
                    onPress={() => setEditDogId(dog.id)}
                    disabled={multiDogLocked}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Fields */}
          <View style={styles.formSection}>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder={placeholders.brand}
              placeholderTextColor={palette.muted}
              value={editBrand}
              onChangeText={setEditBrand}
            />
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder={placeholders.productName}
              placeholderTextColor={palette.muted}
              value={editProductName}
              onChangeText={setEditProductName}
            />
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder={placeholders.portion}
              placeholderTextColor={palette.muted}
              value={editPortion}
              onChangeText={setEditPortion}
            />
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder={placeholders.notes}
              placeholderTextColor={palette.muted}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
            />
          </View>

          <Button
            title={savingProduct ? 'Saving...' : 'Save changes'}
            onPress={handleSaveProduct}
            disabled={savingProduct}
          />
          {productMessage && (
            <Text style={[styles.messageText, { color: palette.muted }]}>{productMessage}</Text>
          )}

          {/* Schedule section */}
          <View style={[styles.scheduleCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <View style={styles.scheduleHeader}>
              <View style={styles.scheduleMeta}>
                <Text style={[styles.scheduleTitle, { color: palette.text }]}>Auto-log schedule</Text>
                <Text style={[styles.scheduleCaption, { color: palette.muted }]}>
                  Automatically log at set times each day.
                </Text>
              </View>
              <Switch value={scheduleEnabled} onValueChange={setScheduleEnabled} />
            </View>

            {scheduleEnabled && (
              <>
                <Text style={[styles.label, { color: palette.muted, marginTop: 12 }]}>Times</Text>
                <View style={styles.chipRow}>
                  {scheduleTimes.length === 0 ? (
                    <Text style={[styles.helper, { color: palette.muted }]}>Add a time below</Text>
                  ) : (
                    scheduleTimes.map((time) => (
                      <Pressable
                        key={time}
                        onPress={() => handleRemoveTime(time)}
                        style={[styles.timeChip, { borderColor: palette.tint }]}
                      >
                        <Text style={[styles.timeChipText, { color: palette.tint }]}>
                          {formatTimeLabel(time)} ×
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>

                <Text style={[styles.label, { color: palette.muted }]}>Quick add</Text>
                <View style={styles.chipRow}>
                  {QUICK_TIME_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => handleAddQuickTime(option.value)}
                      style={[styles.timeChip, { borderColor: palette.border }]}
                    >
                      <Text style={[styles.timeChipText, { color: palette.text }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.customTimeRow}>
                  <TextInput
                    style={[styles.input, styles.timeInput, { borderColor: palette.border, color: palette.text }]}
                    placeholder="e.g., 7:30 AM"
                    placeholderTextColor={palette.muted}
                    value={scheduleInput}
                    onChangeText={setScheduleInput}
                  />
                  <Pressable
                    style={[styles.addTimeButton, { borderColor: palette.border }]}
                    onPress={handleAddCustomTime}
                  >
                    <Text style={[styles.addTimeText, { color: palette.text }]}>Add</Text>
                  </Pressable>
                </View>

                <Button
                  title={
                    savingSchedule
                      ? 'Saving...'
                      : activeSchedule
                        ? 'Update schedule'
                        : 'Enable auto-log'
                  }
                  onPress={handleSaveSchedule}
                  disabled={savingSchedule || scheduleTimes.length === 0}
                  variant="secondary"
                />
                {scheduleMessage && (
                  <Text style={[styles.messageText, { color: palette.muted }]}>{scheduleMessage}</Text>
                )}
              </>
            )}

            {!scheduleEnabled && activeSchedule && (
              <>
                <Text style={[styles.helper, { color: palette.muted }]}>
                  Schedule paused. Turn on to resume.
                </Text>
                <Button
                  title={savingSchedule ? 'Saving...' : 'Pause auto-log'}
                  onPress={handleSaveSchedule}
                  disabled={savingSchedule}
                  variant="secondary"
                />
              </>
            )}
          </View>

          {/* Delete button at bottom */}
          <View style={styles.deleteSection}>
            <Pressable
              style={[styles.deleteButton, { borderColor: palette.danger }]}
              onPress={handleDeleteProduct}
              disabled={deletingProductId === selectedProduct?.id}
            >
              <FontAwesome name="trash-o" size={14} color={palette.danger} />
              <Text style={[styles.deleteButtonText, { color: palette.danger }]}>
                {deletingProductId === selectedProduct?.id ? 'Deleting...' : 'Delete this item'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    paddingTop: 44,
    overflow: 'hidden',
    marginBottom: 18,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  addRow: {
    marginBottom: 20,
  },
  addButton: {
    marginBottom: 8,
  },
  limitText: {
    fontSize: 13,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  filterRow: {
    gap: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  productCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  productImageFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productMeta: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  productDetails: {
    fontSize: 13,
  },
  scheduleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  scheduleText: {
    fontSize: 11,
    fontWeight: '500',
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  editLink: {
    fontSize: 14,
  },
  sheetScroll: {
    maxHeight: 600,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
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
  deleteSection: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  typeHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: -4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  scheduleCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 20,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scheduleMeta: {
    flex: 1,
    marginRight: 12,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleCaption: {
    fontSize: 13,
  },
  helper: {
    fontSize: 13,
    marginBottom: 10,
  },
  timeChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  customTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  timeInput: {
    flex: 1,
    marginBottom: 0,
  },
  addTimeButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addTimeText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
