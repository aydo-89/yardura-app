import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type TabBarProps<T extends string> = {
  tabs: readonly T[];
  activeTab: T;
  onSelect: (tab: T) => void;
};

export default function TabBar<T extends string>({
  tabs,
  activeTab,
  onSelect,
}: TabBarProps<T>) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <Pressable
            key={tab}
            onPress={() => onSelect(tab)}
            style={({ pressed }) => [
              styles.tab,
              isActive && { backgroundColor: palette.tint },
              pressed && !isActive && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? '#FFFFFF' : palette.text },
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
