import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import ChoiceChip from '@/components/ui/ChoiceChip';
import Screen from '@/components/ui/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { captureWithFallback } from '@/lib/media/imagePicker';
import { analyzeIngredients, type IngredientInsights } from '@/lib/wellness/ingredientInsights';
import {
  useFoodLog,
  TYPE_OPTIONS,
  FoodType,
  ScanAsset,
  normalizeScanType,
  getPlaceholders,
} from '@/lib/food/useFoodLog';

export default function FoodScanScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const [type, setType] = useState<FoodType>('FOOD');
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [labelAsset, setLabelAsset] = useState<ScanAsset | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [ingredientScanAttempted, setIngredientScanAttempted] = useState(false);

  const {
    access,
    foodScansRemaining,
    foodScanLocked,
    inventoryLocked,
    scanLoading,
    scanError,
    success,
    error,
    productMessage,
    savingProduct,
    scanFood,
    createProduct,
    clearMessages,
  } = useFoodLog({ token: session?.token });

  // Start pulse animation
  useState(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  });

  const pulseStyle = {
    opacity: pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
    transform: [
      {
        scale: pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1.1],
        }),
      },
    ],
  };

  const placeholders = useMemo(() => getPlaceholders(type), [type]);
  const insights: IngredientInsights = useMemo(() => analyzeIngredients(ingredients), [ingredients]);

  const labelReady = Boolean(brand.trim() || productName.trim());
  const ingredientsReady = Boolean(ingredients.trim());
  const canSave = labelReady && ingredientsReady;

  const scoreValue = insights.score ?? 0;
  const scoreTone =
    insights.score == null
      ? palette.border
      : scoreValue >= 85
        ? Colors.brand.mint
        : scoreValue >= 70
          ? palette.tint
          : scoreValue >= 55
            ? Colors.brand.gold
            : palette.danger;
  const scoreWidth = insights.score == null ? '0%' : `${Math.max(0, Math.min(100, scoreValue))}%`;

  const handleScan = async (mode: 'LABEL' | 'INGREDIENTS') => {
    clearMessages();
    const result = await scanFood(mode, () =>
      captureWithFallback({ kind: 'photo', source: 'camera' }),
    );
    if (!result) return;

    const { scan, asset } = result;
    if (mode === 'LABEL') {
      setLabelAsset(asset);
      if (scan.brand) setBrand((prev) => prev.trim() || scan.brand || '');
      if (scan.productName) setProductName((prev) => prev.trim() || scan.productName || '');
      if (scan.ingredients) {
        setIngredients((prev) => prev.trim() || scan.ingredients || '');
      }
      // Mark that we attempted to scan ingredients (from label)
      setIngredientScanAttempted(true);
      const scanType = normalizeScanType(scan.type);
      if (scanType) setType(scanType);
    } else {
      // Mark that we attempted to scan ingredients
      setIngredientScanAttempted(true);
      if (scan.ingredients) {
        setIngredients((prev) => prev.trim() || scan.ingredients || '');
      }
    }
  };

  const handleSaveToInventory = async () => {
    const product = await createProduct({
      type,
      brand,
      productName,
      ingredients,
      labelAsset,
      announce: true,
    });
    if (product) {
      // Clear form after saving
      setBrand('');
      setProductName('');
      setIngredients('');
      setLabelAsset(null);
      setShowInsights(false);
    }
  };

  const handleClear = () => {
    setBrand('');
    setProductName('');
    setIngredients('');
    setLabelAsset(null);
    setShowInsights(false);
    setIngredientScanAttempted(false);
    clearMessages();
  };

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
          <Text style={styles.heroTitle}>Quick scan</Text>
          <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
            Scan a label to analyze ingredients and get a wellness score.
          </Text>
        </View>

        {/* Scan buttons */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.scanActions}>
            <Pressable
              style={[styles.scanButton, { backgroundColor: palette.tint }]}
              onPress={() => handleScan('LABEL')}
              disabled={scanLoading.label || foodScanLocked}
            >
              <FontAwesome name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.scanButtonLabel}>
                {scanLoading.label ? 'Scanning...' : 'Scan item'}
              </Text>
              <Text style={styles.scanButtonCaption}>Front of package</Text>
            </Pressable>
            <Pressable
              style={[styles.scanButton, { backgroundColor: palette.accent }]}
              onPress={() => handleScan('INGREDIENTS')}
              disabled={scanLoading.ingredients || foodScanLocked}
            >
              <FontAwesome name="list" size={24} color="#FFFFFF" />
              <Text style={styles.scanButtonLabel}>
                {scanLoading.ingredients ? 'Scanning...' : 'Scan ingredients'}
              </Text>
              <Text style={styles.scanButtonCaption}>Ingredient panel</Text>
            </Pressable>
          </View>

          {/* Scan status */}
          {access?.tier === 'FREE' && (
            <Text
              style={[
                styles.limitText,
                { color: foodScanLocked ? palette.danger : palette.muted },
              ]}
            >
              {foodScansRemaining ?? 0} scans remaining this month
            </Text>
          )}

          {(scanLoading.label || scanLoading.ingredients) && (
            <View style={styles.processingRow}>
              <Animated.View
                style={[styles.processingDot, pulseStyle, { backgroundColor: palette.tint }]}
              />
              <Text style={[styles.processingText, { color: palette.text }]}>
                {scanLoading.label ? 'Analyzing label...' : 'Reading ingredients...'}
              </Text>
            </View>
          )}

          {scanError?.label && (
            <Text style={[styles.errorText, { color: palette.danger }]}>{scanError.label}</Text>
          )}
          {scanError?.ingredients && (
            <Text style={[styles.errorText, { color: palette.danger }]}>{scanError.ingredients}</Text>
          )}

          {/* Status indicators */}
          {labelReady && (
            <View style={styles.statusRow}>
              <FontAwesome name="check-circle" size={14} color={Colors.brand.mint} />
              <Text style={[styles.statusText, { color: palette.muted }]}>
                Item: {brand || productName}
              </Text>
            </View>
          )}
          {ingredientsReady && (
            <View style={styles.statusRow}>
              <FontAwesome name="check-circle" size={14} color={Colors.brand.mint} />
              <Text style={[styles.statusText, { color: palette.muted }]}>
                Ingredients captured ({ingredients.split(',').length} items)
              </Text>
            </View>
          )}

          {(labelReady || ingredientsReady) && (
            <Pressable onPress={handleClear} style={styles.clearButton}>
              <Text style={[styles.clearText, { color: palette.tint }]}>Clear and start over</Text>
            </Pressable>
          )}
        </View>

        {/* Type selector */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.label, { color: palette.muted }]}>Type</Text>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={type === option.value}
                onPress={() => setType(option.value)}
              />
            ))}
          </View>
          <Text style={[styles.typeHint, { color: palette.muted }]}>
            {TYPE_OPTIONS.find((o) => o.value === type)?.examples}
          </Text>
        </View>

        {/* Manual entry */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Item details</Text>
          <Text style={[styles.helper, { color: palette.muted }]}>
            Edit or add details manually after scanning.
          </Text>

          <TextInput
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            placeholder={placeholders.brand}
            placeholderTextColor={palette.muted}
            value={brand}
            onChangeText={setBrand}
          />
          <TextInput
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            placeholder={placeholders.productName}
            placeholderTextColor={palette.muted}
            value={productName}
            onChangeText={setProductName}
          />
          <TextInput
            style={[styles.input, styles.textArea, { borderColor: palette.border, color: palette.text }]}
            placeholder="Paste ingredients here"
            placeholderTextColor={palette.muted}
            value={ingredients}
            onChangeText={setIngredients}
            multiline
          />
        </View>

        {/* Wellness score - N/A state when scan attempted but no ingredients found */}
        {ingredientScanAttempted && !ingredientsReady && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.scoreHeader}>
              <View style={styles.scoreMeta}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Wellness score</Text>
                <Text style={[styles.helper, { color: palette.muted }]}>
                  No ingredients detected from scan
                </Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: palette.muted }]}>
                <Text style={styles.scoreValue}>N/A</Text>
              </View>
            </View>
            <View style={styles.naHelpBox}>
              <FontAwesome name="info-circle" size={14} color={palette.muted} />
              <Text style={[styles.naHelpText, { color: palette.muted }]}>
                Try scanning the ingredient panel directly, or paste ingredients manually in the field above.
              </Text>
            </View>
          </View>
        )}

        {/* Wellness score */}
        {ingredientsReady && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: scoreTone }]}>
            <View style={styles.scoreHeader}>
              <View style={styles.scoreMeta}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Wellness score</Text>
                <Text style={[styles.helper, { color: palette.muted }]}>
                  {insights.scoreSummary}
                </Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: scoreTone }]}>
                <Text style={styles.scoreValue}>
                  {insights.score == null ? '--' : scoreValue}
                </Text>
              </View>
            </View>

            <View style={[styles.scoreTrack, { backgroundColor: palette.border }]}>
              <View style={[styles.scoreFill, { width: scoreWidth as any, backgroundColor: scoreTone }]} />
            </View>
            <Text style={[styles.scoreLabel, { color: palette.muted }]}>
              {insights.scoreLabel}
            </Text>

            {/* Alerts */}
            {insights.allergens.length > 0 && (
              <View style={[styles.alertBox, { backgroundColor: `${Colors.brand.gold}15`, borderColor: Colors.brand.gold }]}>
                <FontAwesome name="exclamation-triangle" size={14} color={Colors.brand.gold} />
                <Text style={[styles.alertTitle, { color: palette.text }]}>
                  Potential allergens: {insights.allergens.join(', ')}
                </Text>
              </View>
            )}

            {/* Expandable insights */}
            <Pressable onPress={() => setShowInsights(!showInsights)} style={styles.toggleRow}>
              <Text style={[styles.toggleText, { color: palette.tint }]}>
                {showInsights ? 'Hide details' : 'Show ingredient analysis'}
              </Text>
              <FontAwesome
                name={showInsights ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={palette.tint}
              />
            </Pressable>

            {showInsights && (
              <View style={styles.insightsContainer}>
                {/* Show concerns section */}
                {insights.concerns.length > 0 && (
                  <View style={styles.insightSection}>
                    <View style={styles.insightHeader}>
                      <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
                      <Text style={[styles.insightTitle, { color: palette.text }]}>
                        Ingredients to watch
                      </Text>
                    </View>
                    {insights.concerns.map((item) => {
                      const tone =
                        item.severity === 'high'
                          ? palette.danger
                          : item.severity === 'medium'
                            ? Colors.brand.gold
                            : palette.tint;
                      return (
                        <View key={item.label} style={styles.insightRow}>
                          <View style={[styles.insightDot, { backgroundColor: tone }]} />
                          <View style={styles.insightContent}>
                            <Text style={[styles.insightLabel, { color: palette.text }]}>
                              {item.label}
                            </Text>
                            <View style={[styles.tag, { borderColor: tone }]}>
                              <Text style={[styles.tagText, { color: tone }]}>{item.match}</Text>
                            </View>
                            <Text style={[styles.insightNote, { color: palette.muted }]}>
                              {item.note}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Show benefits section */}
                {insights.benefits.length > 0 && (
                  <View style={styles.insightSection}>
                    <View style={styles.insightHeader}>
                      <FontAwesome name="check-circle" size={14} color={Colors.brand.mint} />
                      <Text style={[styles.insightTitle, { color: palette.text }]}>Good signs</Text>
                    </View>
                    {insights.benefits.map((item) => (
                      <View key={item.label} style={styles.insightRow}>
                        <View style={[styles.insightDot, { backgroundColor: Colors.brand.mint }]} />
                        <View style={styles.insightContent}>
                          <Text style={[styles.insightLabel, { color: palette.text }]}>
                            {item.label}
                          </Text>
                          <View style={[styles.tag, { borderColor: Colors.brand.mint }]}>
                            <Text style={[styles.tagText, { color: Colors.brand.mint }]}>
                              {item.match}
                            </Text>
                          </View>
                          <Text style={[styles.insightNote, { color: palette.muted }]}>
                            {item.note}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* No insights found fallback */}
                {insights.concerns.length === 0 && insights.benefits.length === 0 && (
                  <View style={styles.noInsightsBox}>
                    <FontAwesome name="info-circle" size={16} color={palette.muted} />
                    <Text style={[styles.noInsightsText, { color: palette.muted }]}>
                      No specific ingredients matched our analysis rules. This could mean the
                      ingredients are uncommon or the format wasn't recognized.
                    </Text>
                  </View>
                )}

                {/* What we look for section */}
                <View style={[styles.whatWeLookFor, { backgroundColor: `${palette.tint}08` }]}>
                  <Text style={[styles.whatWeLookForTitle, { color: palette.text }]}>
                    What we analyze
                  </Text>
                  <View style={styles.whatWeLookForGrid}>
                    <View style={styles.whatWeLookForItem}>
                      <FontAwesome name="warning" size={12} color={palette.danger} />
                      <Text style={[styles.whatWeLookForLabel, { color: palette.muted }]}>
                        Preservatives & fillers
                      </Text>
                    </View>
                    <View style={styles.whatWeLookForItem}>
                      <FontAwesome name="warning" size={12} color={Colors.brand.gold} />
                      <Text style={[styles.whatWeLookForLabel, { color: palette.muted }]}>
                        By-products & sugars
                      </Text>
                    </View>
                    <View style={styles.whatWeLookForItem}>
                      <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                      <Text style={[styles.whatWeLookForLabel, { color: palette.muted }]}>
                        Prebiotics & probiotics
                      </Text>
                    </View>
                    <View style={styles.whatWeLookForItem}>
                      <FontAwesome name="check" size={12} color={Colors.brand.mint} />
                      <Text style={[styles.whatWeLookForLabel, { color: palette.muted }]}>
                        Omega-3s & joint support
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        {(labelReady || ingredientsReady) && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Button
              title={
                inventoryLocked
                  ? 'Upgrade to save'
                  : savingProduct
                    ? 'Saving...'
                    : 'Save to inventory'
              }
              onPress={handleSaveToInventory}
              disabled={!canSave || savingProduct || inventoryLocked}
            />
            {productMessage && (
              <Text style={[styles.messageText, { color: palette.muted }]}>{productMessage}</Text>
            )}
            {success && (
              <Text style={[styles.messageText, { color: Colors.brand.mint }]}>{success}</Text>
            )}

            <Pressable
              style={styles.logLink}
              onPress={() => router.push('/(app)/(customer)/food-pantry' as Href)}
            >
              <Text style={[styles.linkText, { color: palette.tint }]}>
                Go to pantry
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  scanActions: {
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  scanButtonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scanButtonCaption: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  limitText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  processingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  processingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  statusText: {
    fontSize: 13,
  },
  clearButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  clearText: {
    fontSize: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  helper: {
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  scoreMeta: {
    flex: 1,
    marginRight: 12,
  },
  scoreBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  scoreTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreLabel: {
    fontSize: 13,
    marginTop: 8,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
  },
  insightSection: {
    marginTop: 16,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  insightRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  insightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 10,
  },
  insightContent: {
    flex: 1,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
  },
  insightNote: {
    fontSize: 12,
  },
  insightsContainer: {
    marginTop: 16,
    gap: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  noInsightsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  noInsightsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  naHelpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
  },
  naHelpText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  whatWeLookFor: {
    borderRadius: 12,
    padding: 14,
  },
  whatWeLookForTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  whatWeLookForGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  whatWeLookForItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
  },
  whatWeLookForLabel: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  logLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
});
