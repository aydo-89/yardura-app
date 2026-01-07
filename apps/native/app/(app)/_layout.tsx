import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(scooper)" />
      <Stack.Screen name="(sales)" />
      <Stack.Screen name="(admin)" />
    </Stack>
  );
}
