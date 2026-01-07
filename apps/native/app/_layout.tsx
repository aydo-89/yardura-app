import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { getJson } from '@/lib/storage';
import { ThemePreferenceProvider } from '@/lib/theme/ThemePreferenceProvider';
import { syncPassiveWalkDetection } from '@/lib/wellness/passiveWalk';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {});

const DAILY_ROUTE_SNAPSHOT_KEY = 'insightscoop_scooper_daily_route';

type DailyRouteSnapshot = {
  dayKey: string;
  hasVisits: boolean;
};

const localDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const content = notification.request.content;
      const data = content.data ?? {};
      const title = typeof content.title === 'string' ? content.title.toLowerCase() : '';
      const kind = typeof (data as { kind?: unknown }).kind === 'string'
        ? (data as { kind: string }).kind
        : null;
      const isDailyCheck =
        kind === 'scooper-daily-checkin' || title.includes('daily check-in');

      if (isDailyCheck) {
        const snapshot = await getJson<DailyRouteSnapshot>(DAILY_ROUTE_SNAPSHOT_KEY);
        if (
          snapshot &&
          snapshot.dayKey === localDayKey() &&
          snapshot.hasVisits === false
        ) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }
      }

      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemePreferenceProvider>
      <RootLayoutNav />
    </ThemePreferenceProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const palette = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (Platform.OS === 'web') return;
    syncPassiveWalkDetection().catch(() => null);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;

    const handleResponse = (response: Notifications.NotificationResponse) => {
      if (!mounted) return;
      const data = response.notification.request.content.data ?? {};
      const href = typeof data.href === 'string' ? (data.href as Href) : null;
      if (href) {
        router.push(href);
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleResponse(response);
        }
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleResponse,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar
        style={colorScheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={palette.background}
      />
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
