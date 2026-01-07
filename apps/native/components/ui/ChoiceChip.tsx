import { Pressable, StyleSheet, Text } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type ChoiceChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export default function ChoiceChip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: ChoiceChipProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: selected ? palette.tint : palette.border,
          backgroundColor: selected ? palette.tint : palette.card,
        },
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <Text
        style={{
          color: selected ? '#FFFFFF' : palette.text,
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
