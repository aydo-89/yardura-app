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
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import FoodEntrySheet from '@/components/food/FoodEntrySheet';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  useFoodLog,
  formatTypeLabel,
  formatLogTimestamp,
} from '@/lib/food/useFoodLog';
import { analyzeIngredients } from '@/lib/wellness/ingredientInsights';
import type { WellnessFoodProduct, WellnessFoodLog } from '@/lib/api/types';

export default function FoodLogScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WellnessFoodProduct | null>(null);
  const [detailLog, setDetailLog] = useState<WellnessFoodLog | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const {
    dogs,
    logs,
    products,
    dogNameMap,
    loading,
    saving,
    quickLogId,
    deletingLogId,
    multiDogLocked,
    success,
    error,
    loadData,
    createLog,
    deleteLog,
    quickLogProduct,
    clearMessages,
  } = useFoodLog({ token: session?.token });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Filter today's logs
  const todaysLogs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return logs.filter((log) => {
      const logDate = new Date(log.loggedAt);
      return logDate >= today;
    });
  }, [logs]);

  // Get recent products for quick re-log (last 5 used)
  const recentProducts = useMemo(() => {
    const productIds = new Set<string>();
    const recent: WellnessFoodProduct[] = [];
    for (const log of logs) {
      if (log.productId && !productIds.has(log.productId)) {
        const product = products.find((p) => p.id === log.productId);
        if (product) {
          productIds.add(log.productId);
          recent.push(product);
        }
        if (recent.length >= 5) break;
      }
    }
    return recent;
  }, [logs, products]);

  const handleOpenEntrySheet = (product: WellnessFoodProduct) => {
    setSelectedProduct(product);
    setEntrySheetOpen(true);
    clearMessages();
  };

  const handleCloseEntrySheet = () => {
    setEntrySheetOpen(false);
    setSelectedProduct(null);
  };

  const handleSubmitEntry = async (params: {
    productId: string;
    dogId: string | null;
    portion: string;
    notes: string;
    loggedAt: Date;
  }) => {
    const product = selectedProduct;
    if (!product) return;

    await createLog({
      productId: params.productId,
      dogId: params.dogId ?? undefined,
      type: product.type,
      portion: params.portion,
      notes: params.notes,
      loggedAt: params.loggedAt,
    });
    handleCloseEntrySheet();
  };

  const handleQuickLog = async (product: WellnessFoodProduct) => {
    await quickLogProduct(product);
  };

  const handleOpenDetail = (log: WellnessFoodLog) => {
    setDetailLog(log);
    setDetailSheetOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailSheetOpen(false);
    setDetailLog(null);
  };

  const handleDeleteFromDetail = () => {
    if (!detailLog) return;
    deleteLog(detailLog);
    handleCloseDetail();
  };

  // Calculate wellness insights for detail log
  const detailInsights = useMemo(() => {
    if (!detailLog?.ingredients) return null;
    return analyzeIngredients(detailLog.ingredients);
  }, [detailLog?.ingredients]);

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;

  const getTypeIcon = (type: string): keyof typeof FontAwesome.glyphMap => {
    switch (type) {
      case 'FOOD':
        return 'cutlery';
      case 'TREAT':
        return 'heart';
      case 'SUPPLEMENT':
        return 'leaf';
      case 'MEDICATION':
        return 'medkit';
      default:
        return 'cutlery';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'FOOD':
        return palette.tint;
      case 'TREAT':
        return Colors.brand.mint;
      case 'SUPPLEMENT':
        return Colors.brand.gold;
      case 'MEDICATION':
        return palette.danger;
      default:
        return palette.tint;
    }
  };

  const renderLogCard = (log: WellnessFoodLog, showTimeline = true, isFirst = false, isLast = false) => {
    const label = log.productName || log.brand || 'Item';
    const dogLabel = log.dogId ? dogNameMap.get(log.dogId) ?? 'Dog' : null;
    const typeColor = getTypeColor(log.type);

    return (
      <View key={log.id} style={showTimeline ? styles.timelineItem : undefined}>
        {/* Timeline connector */}
        {showTimeline && (
          <View style={styles.timelineConnector}>
            {!isFirst && <View style={[styles.connectorLine, { backgroundColor: palette.border }]} />}
            <View style={[styles.timelineDot, { backgroundColor: typeColor }]}>
              <FontAwesome name={getTypeIcon(log.type)} size={10} color="#FFFFFF" />
            </View>
            {!isLast && <View style={[styles.connectorLine, { backgroundColor: palette.border }]} />}
          </View>
        )}

        {/* Log card */}
        <Pressable
          style={[
            styles.logCard,
            { backgroundColor: palette.card, borderColor: palette.border },
            !showTimeline && styles.logCardStandalone,
          ]}
          onPress={() => handleOpenDetail(log)}
        >
          <View style={styles.logHeader}>
            <Text style={[styles.logLabel, { color: palette.text }]} numberOfLines={1}>
              {label}
            </Text>
            <Text style={[styles.logTime, { color: palette.muted }]}>
              {new Date(log.loggedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.logMeta}>
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}15` }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {formatTypeLabel(log.type)}
              </Text>
            </View>
            {dogLabel && (
              <Text style={[styles.logDog, { color: palette.muted }]}>{dogLabel}</Text>
            )}
            {log.portion && (
              <Text style={[styles.logPortion, { color: palette.muted }]}>· {log.portion}</Text>
            )}
          </View>
          {log.allergenMatches && log.allergenMatches.length > 0 && (
            <View style={[styles.allergenBadge, { backgroundColor: `${palette.danger}15` }]}>
              <FontAwesome name="exclamation-triangle" size={10} color={palette.danger} />
              <Text style={[styles.allergenText, { color: palette.danger }]}>
                {log.allergenMatches.join(', ')}
              </Text>
            </View>
          )}
          <View style={styles.tapHint}>
            <Text style={[styles.tapHintText, { color: palette.muted }]}>Tap for details</Text>
            <FontAwesome name="chevron-right" size={10} color={palette.muted} />
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero header */}
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="chevron-left" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>
            Wellness
          </Text>
          <Text style={styles.heroTitle}>Food & Meds</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            Track meals, treats, supplements & medications.
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.actionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.push('/(app)/(customer)/food-scan' as Href)}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="camera" size={18} color={palette.tint} />
            </View>
            <Text style={[styles.actionLabel, { color: palette.text }]}>Scan item</Text>
            <Text style={[styles.actionDesc, { color: palette.muted }]}>Add new product</Text>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.push('/(app)/(customer)/food-pantry' as Href)}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${Colors.brand.mint}15` }]}>
              <FontAwesome name="archive" size={18} color={Colors.brand.mint} />
            </View>
            <Text style={[styles.actionLabel, { color: palette.text }]}>Pantry</Text>
            <Text style={[styles.actionDesc, { color: palette.muted }]}>Manage inventory</Text>
          </Pressable>
        </View>

        {/* Success/Error Messages */}
        {success && (
          <View style={[styles.messageCard, { backgroundColor: `${Colors.brand.mint}15`, borderColor: Colors.brand.mint }]}>
            <FontAwesome name="check-circle" size={16} color={Colors.brand.mint} />
            <Text style={[styles.messageText, { color: Colors.brand.mint }]}>{success}</Text>
          </View>
        )}
        {error && (
          <View style={[styles.messageCard, { backgroundColor: `${palette.danger}15`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={16} color={palette.danger} />
            <Text style={[styles.messageText, { color: palette.danger }]}>{error}</Text>
          </View>
        )}

        {/* Quick Re-log (Recent Items) */}
        {recentProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick log</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
            >
              {recentProducts.map((product) => {
                const label = product.productName || product.brand || 'Item';
                const isLogging = quickLogId === product.id;
                const typeColor = getTypeColor(product.type);

                return (
                  <Pressable
                    key={product.id}
                    style={[styles.recentChip, { backgroundColor: palette.card, borderColor: palette.border }]}
                    onPress={() => handleQuickLog(product)}
                    disabled={isLogging}
                  >
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={styles.recentImage} />
                    ) : (
                      <View style={[styles.recentImageFallback, { backgroundColor: `${typeColor}15` }]}>
                        <FontAwesome name={getTypeIcon(product.type)} size={12} color={typeColor} />
                      </View>
                    )}
                    <Text style={[styles.recentLabel, { color: palette.text }]} numberOfLines={1}>
                      {isLogging ? 'Logging...' : label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Today's Log Timeline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Today's log</Text>
            <Text style={[styles.sectionCount, { color: palette.muted }]}>
              {todaysLogs.length} {todaysLogs.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          {loading && logs.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={palette.tint} />
              <Text style={[styles.loadingText, { color: palette.muted }]}>Loading...</Text>
            </View>
          ) : todaysLogs.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: `${palette.muted}15` }]}>
                <FontAwesome name="cutlery" size={20} color={palette.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No items logged today</Text>
              <Text style={[styles.emptyDesc, { color: palette.muted }]}>
                Tap a quick log item above or scan a new item.
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {todaysLogs.map((log, index) =>
                renderLogCard(log, true, index === 0, index === todaysLogs.length - 1)
              )}
            </View>
          )}
        </View>

        {/* Empty inventory prompt */}
        {products.length === 0 && !loading && (
          <View style={[styles.emptyInventoryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="archive" size={20} color={palette.tint} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No items in inventory</Text>
            <Text style={[styles.emptyDesc, { color: palette.muted }]}>
              Scan a food label to add items to your inventory, then log them here.
            </Text>
            <Button
              title="Scan first item"
              onPress={() => router.push('/(app)/(customer)/food-scan' as Href)}
              style={styles.emptyButton}
            />
          </View>
        )}

        {/* Recent History (not today) */}
        {logs.length > todaysLogs.length && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent history</Text>
            {logs
              .filter((log) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const logDate = new Date(log.loggedAt);
                return logDate < today;
              })
              .slice(0, 5)
              .map((log) => {
                const label = log.productName || log.brand || 'Item';
                const typeColor = getTypeColor(log.type);

                return (
                  <Pressable
                    key={log.id}
                    style={[styles.historyRow, { borderBottomColor: palette.border }]}
                    onPress={() => handleOpenDetail(log)}
                  >
                    <View style={[styles.historyIcon, { backgroundColor: `${typeColor}15` }]}>
                      <FontAwesome name={getTypeIcon(log.type)} size={12} color={typeColor} />
                    </View>
                    <View style={styles.historyMeta}>
                      <Text style={[styles.historyLabel, { color: palette.text }]} numberOfLines={1}>
                        {label}
                      </Text>
                      <Text style={[styles.historyTime, { color: palette.muted }]}>
                        {formatLogTimestamp(log.loggedAt)}
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={12} color={palette.muted} />
                  </Pressable>
                );
              })}
          </View>
        )}
      </ScrollView>

      {/* FAB for logging */}
      {products.length > 0 && (
        <Pressable
          style={[styles.fab, { backgroundColor: palette.tint }]}
          onPress={() => setProductPickerOpen(true)}
        >
          <FontAwesome name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Product Picker Sheet */}
      <BottomSheet visible={productPickerOpen} onClose={() => setProductPickerOpen(false)} snapPoints={[0.75]}>
        <View style={styles.pickerHeader}>
          <Text style={[styles.pickerTitle, { color: palette.text }]}>Select item to log</Text>
          <Text style={[styles.pickerSubtitle, { color: palette.muted }]}>
            Choose from your inventory
          </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
          {products.map((product) => {
            const label = product.productName || product.brand || 'Item';
            const typeColor = getTypeColor(product.type);
            const isLogging = quickLogId === product.id;

            return (
              <Pressable
                key={product.id}
                style={[
                  styles.pickerItem,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                onPress={() => {
                  setProductPickerOpen(false);
                  handleOpenEntrySheet(product);
                }}
                disabled={isLogging}
              >
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.pickerImage} />
                ) : (
                  <View style={[styles.pickerImageFallback, { backgroundColor: `${typeColor}15` }]}>
                    <FontAwesome name={getTypeIcon(product.type)} size={20} color={typeColor} />
                  </View>
                )}
                <View style={styles.pickerMeta}>
                  <Text style={[styles.pickerLabel, { color: palette.text }]} numberOfLines={1}>
                    {label}
                  </Text>
                  <View style={[styles.pickerTypeBadge, { backgroundColor: `${typeColor}15` }]}>
                    <Text style={[styles.pickerTypeText, { color: typeColor }]}>
                      {formatTypeLabel(product.type)}
                    </Text>
                  </View>
                </View>
                <FontAwesome name="chevron-right" size={14} color={palette.muted} />
              </Pressable>
            );
          })}

          {/* Add new item link */}
          <Pressable
            style={[styles.pickerAddItem, { borderColor: palette.border }]}
            onPress={() => {
              setProductPickerOpen(false);
              router.push('/(app)/(customer)/food-scan' as Href);
            }}
          >
            <View style={[styles.pickerAddIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="camera" size={16} color={palette.tint} />
            </View>
            <Text style={[styles.pickerAddLabel, { color: palette.tint }]}>
              Scan new item
            </Text>
          </Pressable>
        </ScrollView>
      </BottomSheet>

      {/* Entry Sheet */}
      <FoodEntrySheet
        visible={entrySheetOpen}
        onClose={handleCloseEntrySheet}
        product={selectedProduct}
        dogs={dogs}
        dogNameMap={dogNameMap}
        multiDogLocked={multiDogLocked}
        saving={saving}
        onSubmit={handleSubmitEntry}
      />

      {/* Log Detail Sheet */}
      <BottomSheet visible={detailSheetOpen} onClose={handleCloseDetail} snapPoints={[0.75]}>
        {detailLog && (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.detailScroll}>
            {/* Header with close button */}
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailHeader}>
                <View style={[styles.detailIcon, { backgroundColor: `${getTypeColor(detailLog.type)}15` }]}>
                  <FontAwesome name={getTypeIcon(detailLog.type)} size={24} color={getTypeColor(detailLog.type)} />
                </View>
                <View style={styles.detailHeaderText}>
                  <Text style={[styles.detailTitle, { color: palette.text }]}>
                    {detailLog.productName || detailLog.brand || 'Item'}
                  </Text>
                  <Text style={[styles.detailSubtitle, { color: palette.muted }]}>
                    {formatLogTimestamp(detailLog.loggedAt, true)}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.closeButton, { backgroundColor: `${palette.muted}15` }]}
                onPress={handleCloseDetail}
              >
                <FontAwesome name="times" size={16} color={palette.muted} />
              </Pressable>
            </View>

            {/* Type & Dog badges */}
            <View style={styles.detailBadges}>
              <View style={[styles.detailBadge, { backgroundColor: `${getTypeColor(detailLog.type)}15` }]}>
                <FontAwesome name={getTypeIcon(detailLog.type)} size={12} color={getTypeColor(detailLog.type)} />
                <Text style={[styles.detailBadgeText, { color: getTypeColor(detailLog.type) }]}>
                  {formatTypeLabel(detailLog.type)}
                </Text>
              </View>
              {detailLog.dogId && (
                <View style={[styles.detailBadge, { backgroundColor: `${palette.muted}15` }]}>
                  <FontAwesome name="paw" size={12} color={palette.muted} />
                  <Text style={[styles.detailBadgeText, { color: palette.muted }]}>
                    {dogNameMap.get(detailLog.dogId) ?? 'Dog'}
                  </Text>
                </View>
              )}
            </View>

            {/* Details section */}
            <View style={[styles.detailSection, { borderColor: palette.border }]}>
              {detailLog.brand && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>Brand</Text>
                  <Text style={[styles.detailValue, { color: palette.text }]}>{detailLog.brand}</Text>
                </View>
              )}
              {detailLog.productName && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>Product</Text>
                  <Text style={[styles.detailValue, { color: palette.text }]}>{detailLog.productName}</Text>
                </View>
              )}
              {detailLog.portion && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>Portion</Text>
                  <Text style={[styles.detailValue, { color: palette.text }]}>{detailLog.portion}</Text>
                </View>
              )}
            </View>

            {/* Ingredients */}
            {detailLog.ingredients && (
              <View style={[styles.detailSection, { borderColor: palette.border }]}>
                <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Ingredients</Text>
                <Text style={[styles.detailIngredients, { color: palette.muted }]}>
                  {detailLog.ingredients}
                </Text>
              </View>
            )}

            {/* Allergen Warnings */}
            {detailLog.allergenMatches && detailLog.allergenMatches.length > 0 && (
              <View style={[styles.allergenCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
                <View style={styles.allergenHeader}>
                  <FontAwesome name="exclamation-triangle" size={16} color={palette.danger} />
                  <Text style={[styles.allergenTitle, { color: palette.danger }]}>Allergen Alert</Text>
                </View>
                <Text style={[styles.allergenList, { color: palette.danger }]}>
                  {detailLog.allergenMatches.join(', ')}
                </Text>
              </View>
            )}

            {/* Wellness Score & Analysis */}
            {detailInsights && detailInsights.score !== null && (
              <View
                style={[
                  styles.wellnessScoreCard,
                  {
                    backgroundColor:
                      detailInsights.score >= 85
                        ? `${Colors.brand.mint}10`
                        : detailInsights.score >= 70
                          ? `${palette.tint}10`
                          : detailInsights.score >= 55
                            ? `${Colors.brand.gold}10`
                            : `${palette.danger}10`,
                    borderWidth: 1,
                    borderColor:
                      detailInsights.score >= 85
                        ? Colors.brand.mint
                        : detailInsights.score >= 70
                          ? palette.tint
                          : detailInsights.score >= 55
                            ? Colors.brand.gold
                            : palette.danger,
                  },
                ]}
              >
                <View style={styles.wellnessScoreHeader}>
                  <View style={styles.wellnessScoreMeta}>
                    <Text style={[styles.wellnessScoreTitle, { color: palette.text }]}>
                      Wellness Score
                    </Text>
                    <Text style={[styles.wellnessScoreSummary, { color: palette.muted }]}>
                      {detailInsights.scoreSummary}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.wellnessScoreBadge,
                      {
                        backgroundColor:
                          detailInsights.score >= 85
                            ? Colors.brand.mint
                            : detailInsights.score >= 70
                              ? palette.tint
                              : detailInsights.score >= 55
                                ? Colors.brand.gold
                                : palette.danger,
                      },
                    ]}
                  >
                    <Text style={styles.wellnessScoreValue}>{detailInsights.score}</Text>
                  </View>
                </View>

                <View style={[styles.wellnessScoreTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.wellnessScoreFill,
                      {
                        width: `${Math.min(100, Math.max(0, detailInsights.score))}%`,
                        backgroundColor:
                          detailInsights.score >= 85
                            ? Colors.brand.mint
                            : detailInsights.score >= 70
                              ? palette.tint
                              : detailInsights.score >= 55
                                ? Colors.brand.gold
                                : palette.danger,
                      },
                    ]}
                  />
                </View>

                {/* Concerns */}
                {detailInsights.concerns.length > 0 && (
                  <View style={styles.wellnessInsightSection}>
                    <Text style={[styles.wellnessInsightTitle, { color: palette.danger }]}>
                      Watch for
                    </Text>
                    {detailInsights.concerns.map((item) => (
                      <View key={item.label} style={styles.wellnessInsightRow}>
                        <View style={[styles.wellnessInsightDot, { backgroundColor: palette.danger }]} />
                        <View style={styles.wellnessInsightContent}>
                          <Text style={[styles.wellnessInsightLabel, { color: palette.text }]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.wellnessInsightNote, { color: palette.muted }]}>
                            {item.note}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Benefits */}
                {detailInsights.benefits.length > 0 && (
                  <View style={styles.wellnessInsightSection}>
                    <Text style={[styles.wellnessInsightTitle, { color: Colors.brand.mint }]}>
                      Good signs
                    </Text>
                    {detailInsights.benefits.map((item) => (
                      <View key={item.label} style={styles.wellnessInsightRow}>
                        <View style={[styles.wellnessInsightDot, { backgroundColor: Colors.brand.mint }]} />
                        <View style={styles.wellnessInsightContent}>
                          <Text style={[styles.wellnessInsightLabel, { color: palette.text }]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.wellnessInsightNote, { color: palette.muted }]}>
                            {item.note}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Notes */}
            {detailLog.notes && (
              <View style={[styles.detailSection, { borderColor: palette.border }]}>
                <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Notes</Text>
                <Text style={[styles.detailNotes, { color: palette.muted }]}>
                  {detailLog.notes}
                </Text>
              </View>
            )}

            {/* Delete button */}
            <View style={styles.detailActions}>
              <Button
                title={deletingLogId === detailLog.id ? 'Deleting...' : 'Delete log entry'}
                variant="secondary"
                onPress={handleDeleteFromDetail}
                disabled={deletingLogId === detailLog.id}
                style={styles.deleteButton}
              />
            </View>
          </ScrollView>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
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
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: 12,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionCount: {
    fontSize: 13,
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 12,
  },
  recentRow: {
    gap: 10,
    paddingRight: 20,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 16,
  },
  recentImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  recentImageFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentLabel: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 100,
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineConnector: {
    width: 24,
    alignItems: 'center',
  },
  connectorLine: {
    flex: 1,
    width: 2,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  logCardStandalone: {
    flex: undefined,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 12,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  logDog: {
    fontSize: 12,
  },
  logPortion: {
    fontSize: 12,
  },
  allergenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  allergenText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  tapHintText: {
    fontSize: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyMeta: {
    flex: 1,
    gap: 2,
  },
  historyLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyTime: {
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Detail sheet styles
  detailScroll: {
    maxHeight: 550,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  detailIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderText: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  detailSubtitle: {
    fontSize: 13,
  },
  detailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailSection: {
    borderTopWidth: 1,
    paddingVertical: 14,
    gap: 10,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailIngredients: {
    fontSize: 13,
    lineHeight: 20,
  },
  detailNotes: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  allergenCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
    gap: 8,
  },
  allergenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allergenTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  allergenList: {
    fontSize: 13,
  },
  detailActions: {
    marginTop: 16,
    paddingBottom: 20,
  },
  deleteButton: {
    borderColor: '#EF4444',
  },
  // Product picker styles
  pickerHeader: {
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  pickerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  pickerScroll: {
    maxHeight: 450,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  pickerImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  pickerImageFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerMeta: {
    flex: 1,
    gap: 4,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickerTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pickerTypeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pickerAddItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  pickerAddIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAddLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyInventoryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  emptyButton: {
    marginTop: 8,
  },
  // Wellness score in detail sheet
  wellnessScoreCard: {
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
  },
  wellnessScoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  wellnessScoreMeta: {
    flex: 1,
    marginRight: 12,
  },
  wellnessScoreTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  wellnessScoreSummary: {
    fontSize: 12,
  },
  wellnessScoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellnessScoreValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  wellnessScoreTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  wellnessScoreFill: {
    height: '100%',
    borderRadius: 2,
  },
  wellnessInsightSection: {
    marginTop: 12,
    gap: 8,
  },
  wellnessInsightTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wellnessInsightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  wellnessInsightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  wellnessInsightContent: {
    flex: 1,
  },
  wellnessInsightLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  wellnessInsightNote: {
    fontSize: 11,
    marginTop: 2,
  },
});
