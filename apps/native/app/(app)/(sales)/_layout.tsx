import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { SalesProvider } from '@/lib/sales/SalesProvider';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function SalesLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <SalesProvider>
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
            title: 'Leads',
            tabBarIcon: ({ color }) => <TabBarIcon name="address-book" color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Map',
            tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} />,
          }}
        />
        <Tabs.Screen
          name="tools"
          options={{
            title: 'Tools',
            tabBarIcon: ({ color }) => <TabBarIcon name="sliders" color={color} />,
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
          name="lead/[leadId]"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="lead/new"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="record"
          options={{ href: null }}
        />
      </Tabs>
    </SalesProvider>
  );
}
