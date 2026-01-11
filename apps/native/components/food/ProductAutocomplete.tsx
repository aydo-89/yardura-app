import { useRef, useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { PetFoodProductSearch } from '@/lib/api/types';
import { useProductSearch } from '@/lib/food/useProductSearch';
import type { FoodType } from '@/lib/food/useFoodLog';

type ProductAutocompleteProps = {
  token: string | undefined;
  placeholder?: string;
  type?: FoodType;
  onSelect: (product: PetFoodProductSearch) => void;
  onManualEntry?: (text: string) => void;
  initialValue?: string;
  disabled?: boolean;
};

export default function ProductAutocomplete({
  token,
  placeholder = 'Search products or type name...',
  type,
  onSelect,
  onManualEntry,
  initialValue = '',
  disabled = false,
}: ProductAutocompleteProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [inputValue, setInputValue] = useState(initialValue);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { results, loading, error, search, clear } = useProductSearch({
    token,
    debounceMs: 300,
  });

  useEffect(() => {
    if (inputValue.length >= 2) {
      search(inputValue, type);
    } else {
      clear();
    }
  }, [inputValue, type, search, clear]);

  const handleChangeText = (text: string) => {
    setInputValue(text);
    setShowResults(true);
  };

  const handleSelectProduct = (product: PetFoodProductSearch) => {
    setInputValue(product.name);
    setShowResults(false);
    Keyboard.dismiss();
    onSelect(product);
  };

  const handleManualEntry = useCallback(() => {
    if (inputValue.trim() && onManualEntry) {
      setShowResults(false);
      Keyboard.dismiss();
      onManualEntry(inputValue.trim());
    }
  }, [inputValue, onManualEntry]);

  const handleBlur = () => {
    // Delay hiding results to allow tap to register
    setTimeout(() => setShowResults(false), 200);
  };

  const handleFocus = () => {
    if (inputValue.length >= 2) {
      setShowResults(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View
        style={[
          styles.inputWrapper,
          { backgroundColor: palette.background, borderColor: palette.border },
        ]}
      >
        <FontAwesome name="search" size={14} color={palette.muted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          value={inputValue}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text }]}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="done"
          onSubmitEditing={handleManualEntry}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color={palette.tint} style={styles.loadingIcon} />
        ) : inputValue.length > 0 ? (
          <Pressable
            onPress={() => {
              setInputValue('');
              clear();
            }}
            style={styles.clearButton}
          >
            <FontAwesome name="times-circle" size={16} color={palette.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Results Dropdown */}
      {showResults && (results.length > 0 || (inputValue.length >= 2 && !loading)) ? (
        <View
          style={[
            styles.resultsContainer,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <ScrollView
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {results.map((product) => (
              <Pressable
                key={product.id}
                onPress={() => handleSelectProduct(product)}
                style={({ pressed }) => [
                  styles.resultItem,
                  { borderBottomColor: palette.border },
                  pressed && { backgroundColor: `${palette.tint}10` },
                ]}
              >
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.resultImage} />
                ) : (
                  <View style={[styles.resultImagePlaceholder, { backgroundColor: palette.border }]}>
                    <FontAwesome name="cutlery" size={14} color={palette.muted} />
                  </View>
                )}
                <View style={styles.resultContent}>
                  <Text style={[styles.resultBrand, { color: palette.muted }]} numberOfLines={1}>
                    {product.brand}
                  </Text>
                  <Text style={[styles.resultName, { color: palette.text }]} numberOfLines={2}>
                    {product.name}
                  </Text>
                  {product.price ? (
                    <Text style={[styles.resultPrice, { color: Colors.brand.mint }]}>
                      ${product.price.toFixed(2)}
                      {product.autoshipPrice ? ` · $${product.autoshipPrice.toFixed(2)} autoship` : ''}
                    </Text>
                  ) : null}
                </View>
                <FontAwesome name="chevron-right" size={12} color={palette.muted} />
              </Pressable>
            ))}

            {/* Manual entry option */}
            {inputValue.length >= 2 && onManualEntry ? (
              <Pressable
                onPress={handleManualEntry}
                style={({ pressed }) => [
                  styles.manualEntryItem,
                  { borderTopColor: palette.border },
                  pressed && { backgroundColor: `${palette.tint}10` },
                ]}
              >
                <View style={[styles.manualEntryIcon, { backgroundColor: `${palette.tint}15` }]}>
                  <FontAwesome name="plus" size={14} color={palette.tint} />
                </View>
                <View style={styles.manualEntryContent}>
                  <Text style={[styles.manualEntryLabel, { color: palette.tint }]}>
                    Add "{inputValue}"
                  </Text>
                  <Text style={[styles.manualEntryHint, { color: palette.muted }]}>
                    Enter manually without searching
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {/* No results message */}
            {results.length === 0 && inputValue.length >= 2 && !loading ? (
              <View style={styles.noResults}>
                <FontAwesome name="search" size={20} color={palette.muted} />
                <Text style={[styles.noResultsText, { color: palette.muted }]}>
                  No matching products found
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {/* Error message */}
      {error ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  loadingIcon: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  resultsList: {
    maxHeight: 280,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  resultImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  resultImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
    gap: 2,
  },
  resultBrand: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  resultPrice: {
    fontSize: 12,
    fontWeight: '600',
  },
  manualEntryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  manualEntryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEntryContent: {
    flex: 1,
    gap: 2,
  },
  manualEntryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  manualEntryHint: {
    fontSize: 12,
  },
  noResults: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  noResultsText: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
