import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { VisitFlowProvider } from '@/lib/scooper/visitFlow';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function VisitFlowLayout() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const resolvedVisitId = Array.isArray(visitId) ? visitId[0] : visitId;
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  if (!resolvedVisitId) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="small" color={palette.tint} />
      </View>
    );
  }

  return (
    <VisitFlowProvider visitId={resolvedVisitId}>
      <Stack screenOptions={{ headerShown: false }} />
    </VisitFlowProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
