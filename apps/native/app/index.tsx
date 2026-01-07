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
