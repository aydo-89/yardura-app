import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { US_STATES } from '@/constants/USStates';

type StatePickerProps = {
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
};

export default function StatePicker({ value, onSelect, placeholder = 'State' }: StatePickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selectedState = US_STATES.find((s) => s.value === value);
  const displayValue = selectedState?.value ?? '';

  const filteredStates = search.trim()
    ? US_STATES.filter(
        (s) =>
          s.label.toLowerCase().includes(search.toLowerCase()) ||
          s.value.toLowerCase().includes(search.toLowerCase()),
      )
    : US_STATES;

  const handleSelect = (stateValue: string) => {
    onSelect(stateValue);
    setVisible(false);
    setSearch('');
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[styles.trigger, { borderColor: palette.border, backgroundColor: palette.background }]}
      >
        <Text
          style={[
            styles.triggerText,
            { color: displayValue ? palette.text : palette.muted },
          ]}
        >
          {displayValue || placeholder}
        </Text>
        <FontAwesome name="chevron-down" size={12} color={palette.muted} />
      </Pressable>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: palette.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Select State</Text>
            <Pressable onPress={() => setVisible(false)} hitSlop={12}>
              <FontAwesome name="times" size={20} color={palette.muted} />
            </Pressable>
          </View>

          <View style={[styles.searchWrap, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <FontAwesome name="search" size={14} color={palette.muted} />
            <TextInput
              style={[styles.searchInput, { color: palette.text }]}
              placeholder="Search states..."
              placeholderTextColor={palette.muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <FontAwesome name="times-circle" size={16} color={palette.muted} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filteredStates}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item.value)}
                  style={[
                    styles.item,
                    {
                      backgroundColor: isSelected ? `${palette.tint}10` : 'transparent',
                      borderColor: isSelected ? palette.tint : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.itemLabel, { color: palette.text }]}>{item.label}</Text>
                  <Text style={[styles.itemValue, { color: palette.muted }]}>{item.value}</Text>
                  {isSelected && <FontAwesome name="check" size={14} color={palette.tint} />}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: palette.muted }]}>No states found</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: 80,
  },
  triggerText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modal: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 12,
    gap: 10,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  itemValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
