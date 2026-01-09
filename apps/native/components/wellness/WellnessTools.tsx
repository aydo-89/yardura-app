import { router, type Href } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { API_BASE_URL } from '@/lib/config';
import type { WellnessAccess } from './useWellnessData';

type ToolItem = {
  id: string;
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  description: string;
  route?: Href;
  external?: string;
  locked?: boolean;
  badge?: string;
};

type WellnessToolsProps = {
  access: WellnessAccess;
  isPremium: boolean;
  hasService: boolean;
};

export default function WellnessTools({ access, isPremium, hasService }: WellnessToolsProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const scansRemaining = access
    ? Math.max(0, access.limits.scansPerMonth - access.usage.scansCount)
    : null;
  const chatsRemaining = access
    ? Math.max(0, access.limits.chatsPerMonth - access.usage.chatsCount)
    : null;
  const scanLocked = !isPremium && scansRemaining === 0;
  const chatLocked = !isPremium && chatsRemaining === 0;

  const tools: ToolItem[] = [
    {
      id: 'scan',
      icon: 'camera',
      label: 'Scan stool',
      description: 'AI-powered wellness analysis',
      route: '/(app)/(customer)/capture' as Href,
      locked: scanLocked,
      badge: isPremium ? undefined : `${scansRemaining} left`,
    },
    {
      id: 'chat',
      icon: 'comment',
      label: 'Ask AI',
      description: 'Get personalized wellness advice',
      route: '/(app)/(customer)/chat' as Href,
      locked: chatLocked,
      badge: isPremium ? undefined : `${chatsRemaining} left`,
    },
    {
      id: 'food-log',
      icon: 'cutlery',
      label: 'Food & meds',
      description: 'Pantry, scans & daily logs',
      route: '/(app)/(customer)/food-log' as Href,
    },
    {
      id: 'walks',
      icon: 'road',
      label: 'Walks',
      description: 'Log exercise and activity',
      route: '/(app)/(customer)/wellness-walks' as Href,
    },
    {
      id: 'reminders',
      icon: 'bell',
      label: 'Reminders',
      description: 'Set wellness reminders',
      route: '/(app)/(customer)/reminders' as Href,
    },
    {
      id: 'library',
      icon: 'book',
      label: 'Stool library',
      description: 'Learn about stool health',
      route: '/(app)/(customer)/wellness-stool-library' as Href,
    },
    {
      id: 'poop-map',
      icon: 'map-marker',
      label: 'Poop map',
      description: 'Track yard hotspots',
      route: '/(app)/(customer)/wellness-poop-map' as Href,
    },
    {
      id: 'weather',
      icon: 'cloud',
      label: 'Weather',
      description: 'Walk conditions & forecast',
      route: '/(app)/(customer)/wellness-weather' as Href,
    },
    {
      id: 'parasite-risk',
      icon: 'bug',
      label: 'Parasite risk',
      description: 'Seasonal flea, tick & heartworm',
      route: '/(app)/(customer)/wellness-parasite-risk' as Href,
    },
    {
      id: 'reports',
      icon: 'file-text-o',
      label: 'Reports',
      description: 'Share with your vet',
      route: '/(app)/(customer)/wellness-review' as Href,
    },
  ];

  const handleToolPress = (tool: ToolItem) => {
    if (tool.locked) {
      router.push('/(app)/(customer)/wellness-upgrade' as Href);
      return;
    }
    if (tool.external) {
      Linking.openURL(tool.external);
      return;
    }
    if (tool.route) {
      router.push(tool.route);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tools grid */}
      <View style={styles.grid}>
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={() => handleToolPress(tool)}
            style={({ pressed }) => [
              styles.toolCard,
              { backgroundColor: palette.card, borderColor: palette.border },
              pressed && { opacity: 0.7 },
              tool.locked && { opacity: 0.6 },
            ]}
          >
            <View style={styles.toolHeader}>
              <View style={[styles.toolIcon, { backgroundColor: `${palette.tint}15` }]}>
                <FontAwesome name={tool.icon} size={18} color={palette.tint} />
              </View>
              {tool.badge ? (
                <View style={[styles.toolBadge, { backgroundColor: palette.border }]}>
                  <Text style={[styles.toolBadgeText, { color: palette.text }]}>
                    {tool.badge}
                  </Text>
                </View>
              ) : null}
              {tool.locked ? (
                <FontAwesome name="lock" size={12} color={palette.muted} />
              ) : null}
            </View>
            <Text style={[styles.toolLabel, { color: palette.text }]}>{tool.label}</Text>
            <Text style={[styles.toolDescription, { color: palette.muted }]} numberOfLines={2}>
              {tool.description}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Upgrade section for free users */}
      {!isPremium && !hasService ? (
        <View style={[styles.upgradeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.upgradeContent}>
            <View style={[styles.upgradeIcon, { backgroundColor: `${palette.tint}15` }]}>
              <FontAwesome name="star" size={20} color={palette.tint} />
            </View>
            <View style={styles.upgradeText}>
              <Text style={[styles.upgradeTitle, { color: palette.text }]}>
                Unlock Premium
              </Text>
              <Text style={[styles.upgradeSubtitle, { color: palette.muted }]}>
                Unlimited scans, AI chat, and advanced insights
              </Text>
            </View>
          </View>
          <Button
            title="Upgrade now"
            onPress={() => router.push('/(app)/(customer)/wellness-upgrade' as Href)}
          />
        </View>
      ) : null}

      {/* Service upsell */}
      {!hasService ? (
        <Pressable
          onPress={() => Linking.openURL(`${API_BASE_URL}/quote`)}
          style={[styles.serviceCard, { borderColor: Colors.brand.mint }]}
        >
          <View style={styles.serviceContent}>
            <FontAwesome name="paw" size={18} color={Colors.brand.mint} />
            <View style={styles.serviceText}>
              <Text style={[styles.serviceTitle, { color: palette.text }]}>
                Get scooping service
              </Text>
              <Text style={[styles.serviceSubtitle, { color: palette.muted }]}>
                Pro-verified wellness capture with every visit
              </Text>
            </View>
          </View>
          <FontAwesome name="chevron-right" size={14} color={Colors.brand.mint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  toolBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  toolLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toolDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  upgradeCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  upgradeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  upgradeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeText: {
    flex: 1,
    gap: 4,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  upgradeSubtitle: {
    fontSize: 13,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
    padding: 14,
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serviceText: {
    flex: 1,
    gap: 4,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  serviceSubtitle: {
    fontSize: 12,
  },
});
