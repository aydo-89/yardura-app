import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type PointDetailCardProps = {
  sourceType: 'OWNER' | 'PRO';
  capturedAt: string;
  imageUrl?: string | null;
  onClose: () => void;
  onAdjustLocation?: () => void;
};

export default function PointDetailCard({
  sourceType,
  capturedAt,
  imageUrl,
  onClose,
  onAdjustLocation,
}: PointDetailCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [imageRevealed, setImageRevealed] = useState(false);

  const sourceLabel = sourceType === 'OWNER' ? 'Owner capture' : 'Scooper capture';
  const parsed = new Date(capturedAt);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? capturedAt
    : parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  const sourceColor = sourceType === 'OWNER' ? Colors.brand.mint : Colors.brand.coral;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerRow}>
            <View style={[styles.sourceDot, { backgroundColor: sourceColor }]} />
            <Text style={[styles.sourceLabel, { color: palette.text }]}>{sourceLabel}</Text>
          </View>
          <Text style={[styles.dateLabel, { color: palette.muted }]}>{dateLabel}</Text>
        </View>
        <Pressable style={[styles.closeButton, { backgroundColor: `${palette.muted}15` }]} onPress={onClose}>
          <FontAwesome name="times" size={14} color={palette.muted} />
        </Pressable>
      </View>

      {/* Image */}
      {imageUrl ? (
        <Pressable
          style={styles.imageContainer}
          onPress={() => setImageRevealed(!imageRevealed)}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
            blurRadius={imageRevealed ? 0 : 16}
          />
          {!imageRevealed ? (
            <View style={styles.blurOverlay}>
              <FontAwesome name="eye" size={16} color="#F8FAFC" />
              <Text style={styles.blurText}>Tap to reveal</Text>
            </View>
          ) : (
            <View style={styles.revealPill}>
              <FontAwesome name="eye-slash" size={12} color="#F8FAFC" />
              <Text style={styles.revealPillText}>Tap to blur</Text>
            </View>
          )}
        </Pressable>
      ) : (
        <View style={[styles.noImage, { backgroundColor: palette.background }]}>
          <FontAwesome name="image" size={20} color={palette.muted} />
          <Text style={[styles.noImageText, { color: palette.muted }]}>No photo available</Text>
        </View>
      )}

      {/* Actions */}
      {sourceType === 'OWNER' && onAdjustLocation && (
        <Button
          title="Adjust location"
          variant="secondary"
          onPress={onAdjustLocation}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sourceLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateLabel: {
    fontSize: 12,
    marginLeft: 18,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  blurText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  revealPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revealPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  noImage: {
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noImageText: {
    fontSize: 13,
  },
});
