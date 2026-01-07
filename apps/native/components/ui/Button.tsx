import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'cta' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  labelStyle,
}: ButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && {
          backgroundColor: palette.tint,
          borderColor: palette.tint,
        },
        variant === 'cta' && {
          backgroundColor: palette.cta ?? palette.tint,
          borderColor: palette.cta ?? palette.tint,
        },
        variant === 'secondary' && {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
        variant === 'danger' && {
          backgroundColor: palette.danger,
          borderColor: palette.danger,
        },
        variant === 'ghost' && {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        },
        disabled && {
          opacity: 0.6,
        },
        pressed && !disabled && {
          transform: [{ scale: 0.99 }],
        },
        variant === 'cta' && styles.cta,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' && { color: '#FFFFFF' },
          variant === 'cta' && { color: '#FFFFFF' },
          variant === 'danger' && { color: '#FFFFFF' },
          variant === 'secondary' && { color: palette.text },
          variant === 'ghost' && { color: palette.tint },
          labelStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  cta: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
