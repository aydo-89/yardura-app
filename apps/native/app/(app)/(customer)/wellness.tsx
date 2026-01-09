import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Screen from '@/components/ui/Screen';
import TabBar from '@/components/ui/TabBar';
import WellnessOverview from '@/components/wellness/WellnessOverview';
import WellnessSamples from '@/components/wellness/WellnessSamples';
import WellnessTools from '@/components/wellness/WellnessTools';
import { useWellnessData } from '@/components/wellness/useWellnessData';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { WellnessReading } from '@/lib/api/types';

const TABS = ['Overview', 'Samples', 'Tools'] as const;
type TabType = (typeof TABS)[number];

export default function CustomerWellness() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const params = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>('Overview');

  // Handle tab parameter from navigation (e.g., returning from sample details)
  useEffect(() => {
    const tabParam = params.tab;
    if (typeof tabParam === 'string') {
      const normalizedTab = tabParam.charAt(0).toUpperCase() + tabParam.slice(1).toLowerCase();
      if (TABS.includes(normalizedTab as TabType)) {
        setActiveTab(normalizedTab as TabType);
      }
    }
  }, [params.tab]);

  const {
    reports,
    readings,
    weatherAlert,
    readingsLoading,
    checkInLoading,
    checkInError,
    loadAll,
    loadReadings,
    access,
    hasService,
    isPremium,
    checkInMeta,
    wellnessSummary,
    flaggedReadings,
  } = useWellnessData(session?.token);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const handleSamplePress = (reading: WellnessReading) => {
    router.push({
      pathname: '/(app)/(customer)/wellness-sample',
      params: { id: reading.id, source: reading.source ?? 'PRO' },
    } as Href);
  };

  const handleFlagPress = (reading: WellnessReading) => {
    setActiveTab('Samples');
    // Small delay to allow tab switch animation
    setTimeout(() => {
      handleSamplePress(reading);
    }, 100);
  };

  const heroBackground =
    colorScheme === 'light' ? Colors.brand.graphite : Colors.brand.slate950;

  // Hero component - reused as header in different contexts
  const heroHeader = useMemo(
    () => (
      <View style={[styles.hero, { backgroundColor: heroBackground }]}>
        <View
          style={[
            styles.heroGlow,
            { backgroundColor: palette.tint, opacity: colorScheme === 'light' ? 0.25 : 0.4 },
          ]}
        />
        <View
          style={[
            styles.heroGlowSecondary,
            { backgroundColor: palette.accent, opacity: colorScheme === 'light' ? 0.2 : 0.3 },
          ]}
        />
        <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.65)' }]}>Wellness</Text>
        <Text style={styles.heroTitleText}>Pet health insights</Text>
        <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
          Track stool health, log meals, and get AI-powered guidance.
        </Text>
      </View>
    ),
    [colorScheme, heroBackground, palette.accent, palette.tint],
  );

  // Samples tab uses FlatList internally - render without outer ScrollView to avoid nesting
  if (activeTab === 'Samples') {
    return (
      <Screen>
        <View style={styles.fixedHeader}>
          {heroHeader}
          <View style={styles.tabContainer}>
            <TabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />
          </View>
        </View>
        <View style={styles.samplesContainer}>
          <WellnessSamples
            readings={readings}
            loading={readingsLoading}
            error={null}
            hasService={hasService}
            onRefresh={loadReadings}
            onSamplePress={handleSamplePress}
          />
        </View>
      </Screen>
    );
  }

  // Overview and Tools tabs use ScrollView
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {heroHeader}

        <View style={styles.tabContainer}>
          <TabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'Overview' && (
            <WellnessOverview
              wellnessSummary={wellnessSummary}
              checkInMeta={checkInMeta}
              checkInLoading={checkInLoading}
              checkInError={checkInError}
              flaggedReadings={flaggedReadings}
              weatherAlert={weatherAlert}
              access={access}
              isPremium={isPremium}
              hasService={hasService}
              reportsCount={reports.length}
              onFlagPress={handleFlagPress}
            />
          )}

          {activeTab === 'Tools' && (
            <WellnessTools access={access} isPremium={isPremium} hasService={hasService} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    paddingBottom: 0,
  },
  samplesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 18,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -120,
    right: -80,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -80,
    left: -40,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitleText: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  tabContainer: {
    marginBottom: 20,
  },
  tabContent: {
    flex: 1,
  },
});
