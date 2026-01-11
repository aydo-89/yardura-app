import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth/AuthProvider';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function Index() {
  const { session, loading } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors[colorScheme].background,
        }}
      >
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Check if this is a new user (no customer record and no scooper profile)
  const isNewUser = !session.user.customerId && !session.user.scooperProfileId;

  if (isNewUser) {
    // New user - let them choose their path
    return <Redirect href={'/(auth)/role-choice' as any} />;
  }

  if (session.activeRole === 'TECH') {
    return <Redirect href="/(app)/(scooper)" />;
  }

  if (session.activeRole === 'SALES_REP') {
    return <Redirect href="/(app)/(sales)" />;
  }

  if (session.activeRole === 'ADMIN' || session.activeRole === 'OWNER') {
    return <Redirect href="/(app)/(admin)" />;
  }

  return <Redirect href="/(app)/(customer)" />;
}
