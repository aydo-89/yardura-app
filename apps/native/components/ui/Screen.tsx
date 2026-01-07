import type { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
};

export default function Screen({ children, style, padded = true }: ScreenProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const backgroundColor = Colors[colorScheme].background;

  return (
    <View
      style={[
        styles.base,
        { backgroundColor },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
});
