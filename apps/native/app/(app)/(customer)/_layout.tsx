import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function CustomerLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarStyle: {
          borderTopColor: palette.border,
          backgroundColor: palette.card,
        },
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Service',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness',
          tabBarIcon: ({ color }) => <TabBarIcon name="heart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      <Tabs.Screen
        name="check-in"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="setup"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="welcome"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="scooper-apply"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-dogs"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-poop-map"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-weather"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-parasite-risk"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-stool-library"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-walks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-review"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-sample"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wellness-upgrade"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="service-plan"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="address"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="food-pantry"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="food-scan"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="food-log"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="report-settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
