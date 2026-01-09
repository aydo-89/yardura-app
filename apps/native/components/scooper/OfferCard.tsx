import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';

export type OfferData = {
  id: string;
  jobId: string | null;
  frequency: string;
  scheduledDate: string | null;
  expiresAt: string | null;
  isDirectOffer: boolean;
  isRecurring: boolean;
  handoffType: string | null;
  preferredTimeWindowLabel?: string | null;
  preferredTimeWindowSlug?: string | null;
  preferredTimeWindowRange?: string | null;
  distanceMiles?: number | null;
  tile: {
    id: string;
    slug: string;
    name: string;
  } | null;
  customer: {
    id: string | null;
    name: string | null;
    addressLine1: string | null;
    city: string | null;
    zip: string | null;
    dogs?: Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;
  } | null;
  estimatedPayout: {
    baseAmountCents: number;
    totalAmountCents: number;
  } | null;
};

type OfferCardProps = {
  offer: OfferData;
  palette: typeof Colors.light;
  colorScheme: 'light' | 'dark';
  now: number;
  hasConflict?: boolean;
  isAccepting?: boolean;
  isDeclining?: boolean;
  onAcceptVisit: (offerId: string) => Promise<boolean>;
  onAcceptRecurring?: (offerId: string, jobId: string) => Promise<boolean>;
  onDecline?: (offerId: string) => Promise<boolean>;
  onCompareCalendar?: (offer: OfferData) => void;
};

const VISITS_PER_MONTH: Record<string, number> = {
  DAILY: 21.67,
  TWICE_WEEKLY: 8.67,
  WEEKLY: 4.33,
  BI_WEEKLY: 2.17,
  MONTHLY: 1,
  ONE_TIME: 1,
};

function formatPayout(cents?: number | null): string {
  if (typeof cents !== 'number') return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRecurringEstimate(cents: number, frequency: string): string | null {
  const visitsPerMonth = VISITS_PER_MONTH[frequency] ?? 0;
  if (!visitsPerMonth) return null;
  const visitsPerWeek = visitsPerMonth / 4.33;
  const weekly = formatPayout(cents * visitsPerWeek);
  const monthly = formatPayout(cents * visitsPerMonth);
  if (visitsPerMonth <= 1.1) return `Est. ${monthly}/mo`;
  return `${weekly}/wk • ${monthly}/mo`;
}

function formatCadence(frequency: string): string {
  switch (frequency) {
    case 'TWICE_WEEKLY':
      return '2x/week';
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    case 'BI_WEEKLY':
      return 'Bi-weekly';
    case 'MONTHLY':
      return 'Monthly';
    case 'ONE_TIME':
      return 'One-time';
    default:
      return frequency.toLowerCase().replace(/_/g, ' ');
  }
}

function formatOfferDate(value?: string | null): string {
  if (!value) return 'Flexible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Flexible';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatWindow(
  offer: Pick<OfferData, 'preferredTimeWindowLabel' | 'preferredTimeWindowRange' | 'preferredTimeWindowSlug'>,
): string | null {
  if (offer.preferredTimeWindowLabel) return offer.preferredTimeWindowLabel;
  const slug = offer.preferredTimeWindowSlug?.toLowerCase() ?? '';
  if (slug.includes('morning')) return 'Morning';
  if (slug.includes('afternoon')) return 'Afternoon';
  if (slug.includes('evening')) return 'Evening';
  if (slug.includes('flex')) return 'Flexible';
  if (offer.preferredTimeWindowRange) return offer.preferredTimeWindowRange;
  return null;
}

function formatCountdown(expiresAt: string | null | undefined, now: number): string | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  const diffMs = expiry.getTime() - now;
  if (diffMs <= 0) return 'Expiring';
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function formatDistance(miles?: number | null): string | null {
  if (typeof miles !== 'number' || Number.isNaN(miles)) return null;
  return `${miles.toFixed(1)} mi`;
}

function formatDogCount(dogs?: Array<{ name: string }>): string | null {
  if (!dogs?.length) return null;
  return dogs.length === 1 ? '1 dog' : `${dogs.length} dogs`;
}

export default function OfferCard({
  offer,
  palette,
  colorScheme,
  now,
  hasConflict = false,
  isAccepting = false,
  isDeclining = false,
  onAcceptVisit,
  onAcceptRecurring,
  onDecline,
  onCompareCalendar,
}: OfferCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [acceptScope, setAcceptScope] = useState<'visit' | 'job' | null>(null);

  const cardBorder = colorScheme === 'dark' ? '#233045' : palette.border;
  const cardShadowStyle = colorScheme === 'dark' ? styles.cardShadowDark : styles.cardShadow;

  const payoutCents = offer.estimatedPayout?.totalAmountCents ?? null;
  const payoutLabel = formatPayout(payoutCents);
  const recurringEstimate = offer.isRecurring && payoutCents
    ? formatRecurringEstimate(payoutCents, offer.frequency)
    : null;
  const countdown = formatCountdown(offer.expiresAt, now);
  const dateLabel = formatOfferDate(offer.scheduledDate);
  const windowLabel = formatWindow(offer);
  const distanceLabel = formatDistance(offer.distanceMiles);
  const dogLabel = formatDogCount(offer.customer?.dogs);
  const isCoverage = Boolean(offer.jobId) && !offer.isRecurring && !offer.handoffType;
  const canAcceptRecurring = Boolean(offer.jobId && offer.isRecurring && onAcceptRecurring);

  const handleAcceptVisit = useCallback(async () => {
    setAcceptScope('visit');
    await onAcceptVisit(offer.id);
    setAcceptScope(null);
  }, [offer.id, onAcceptVisit]);

  const handleAcceptRecurring = useCallback(async () => {
    if (!offer.jobId || !onAcceptRecurring) return;
    setAcceptScope('job');
    await onAcceptRecurring(offer.id, offer.jobId);
    setAcceptScope(null);
  }, [offer.id, offer.jobId, onAcceptRecurring]);

  const handleDecline = useCallback(async () => {
    if (!onDecline) return;
    await onDecline(offer.id);
  }, [offer.id, onDecline]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const isActing = isAccepting || isDeclining || Boolean(acceptScope);

  return (
    <Pressable
      onPress={toggleExpanded}
      style={({ pressed }) => [
        styles.card,
        cardShadowStyle,
        { backgroundColor: palette.card, borderColor: cardBorder },
        pressed && !expanded && { opacity: 0.95 },
      ]}
    >
      {/* Collapsed Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.payout, { color: Colors.brand.mint }]}>
            {payoutLabel}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: palette.muted }]}>
              {dateLabel}
            </Text>
            {windowLabel ? (
              <>
                <View style={[styles.dot, { backgroundColor: palette.muted }]} />
                <Text style={[styles.metaText, { color: palette.muted }]}>
                  {windowLabel}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          {countdown ? (
            <View style={[styles.countdownBadge, { borderColor: cardBorder }]}>
              <FontAwesome name="clock-o" size={10} color={palette.muted} />
              <Text style={[styles.countdownText, { color: palette.muted }]}>
                {countdown}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: offer.isDirectOffer ? palette.accent : 'transparent',
                borderColor: offer.isDirectOffer ? palette.accent : cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: offer.isDirectOffer ? palette.card : palette.muted },
              ]}
            >
              {offer.isDirectOffer ? 'Direct' : 'Open'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tags Row */}
      <View style={styles.tagsRow}>
        {offer.tile?.name ? (
          <View style={[styles.tag, { borderColor: cardBorder }]}>
            <FontAwesome name="map-marker" size={10} color={palette.muted} />
            <Text style={[styles.tagText, { color: palette.muted }]}>
              {offer.tile.name}
            </Text>
          </View>
        ) : null}
        {distanceLabel ? (
          <View style={[styles.tag, { borderColor: cardBorder }]}>
            <FontAwesome name="home" size={10} color={palette.muted} />
            <Text style={[styles.tagText, { color: palette.muted }]}>
              {distanceLabel}
            </Text>
          </View>
        ) : null}
        {offer.isRecurring ? (
          <View style={[styles.tag, { borderColor: palette.tint }]}>
            <FontAwesome name="refresh" size={10} color={palette.tint} />
            <Text style={[styles.tagText, { color: palette.tint }]}>
              {formatCadence(offer.frequency)}
            </Text>
          </View>
        ) : isCoverage ? (
          <View style={[styles.tag, { borderColor: Colors.brand.gold }]}>
            <Text style={[styles.tagText, { color: Colors.brand.evergreen }]}>
              Coverage
            </Text>
          </View>
        ) : null}
        {hasConflict ? (
          <View style={[styles.tag, { borderColor: Colors.brand.gold, backgroundColor: 'rgba(255, 194, 77, 0.15)' }]}>
            <FontAwesome name="exclamation-triangle" size={10} color={Colors.brand.evergreen} />
            <Text style={[styles.tagText, { color: Colors.brand.evergreen }]}>
              Conflict
            </Text>
          </View>
        ) : null}
      </View>

      {/* Expand Indicator */}
      {!expanded ? (
        <View style={styles.expandHint}>
          <FontAwesome name="chevron-down" size={12} color={palette.muted} />
        </View>
      ) : null}

      {/* Expanded Details */}
      {expanded ? (
        <View style={styles.details}>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          {/* Customer Info */}
          <View style={styles.detailSection}>
            <Text style={[styles.sectionLabel, { color: palette.muted }]}>
              Customer
            </Text>
            <Text style={[styles.customerName, { color: palette.text }]}>
              {offer.customer?.name ?? 'Customer'}
            </Text>
            {offer.customer?.addressLine1 ? (
              <Text style={[styles.detailText, { color: palette.muted }]}>
                {offer.customer.addressLine1}
              </Text>
            ) : null}
            {offer.customer?.city ? (
              <Text style={[styles.detailText, { color: palette.muted }]}>
                {offer.customer.city}{offer.customer.zip ? `, ${offer.customer.zip}` : ''}
              </Text>
            ) : null}
            {dogLabel ? (
              <View style={styles.dogRow}>
                <FontAwesome name="paw" size={12} color={palette.muted} />
                <Text style={[styles.detailText, { color: palette.muted }]}>
                  {dogLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Recurring Estimate */}
          {recurringEstimate ? (
            <View style={styles.estimateRow}>
              <Text style={[styles.estimateLabel, { color: palette.muted }]}>
                Est. earnings:
              </Text>
              <Text style={[styles.estimateValue, { color: palette.text }]}>
                {recurringEstimate}
              </Text>
            </View>
          ) : null}

          {/* Compare Calendar Link */}
          {offer.isRecurring && onCompareCalendar ? (
            <Pressable
              onPress={() => onCompareCalendar(offer)}
              style={styles.compareLink}
            >
              <FontAwesome name="calendar" size={12} color={palette.tint} />
              <Text style={[styles.compareLinkText, { color: palette.tint }]}>
                Compare with my schedule
              </Text>
            </Pressable>
          ) : null}

          {/* Conflict Warning */}
          {hasConflict ? (
            <View style={[styles.warningCard, { borderColor: Colors.brand.gold }]}>
              <Text style={[styles.warningText, { color: Colors.brand.evergreen }]}>
                This offer may conflict with your availability.
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isActing ? (
              <View style={styles.actingRow}>
                <ActivityIndicator size="small" color={palette.tint} />
                <Text style={[styles.actingText, { color: palette.muted }]}>
                  {acceptScope === 'job' ? 'Accepting ongoing...' : acceptScope === 'visit' ? 'Accepting...' : 'Processing...'}
                </Text>
              </View>
            ) : (
              <>
                <Button
                  title="Accept visit"
                  onPress={handleAcceptVisit}
                  variant="primary"
                  style={styles.actionButton}
                />
                {canAcceptRecurring ? (
                  <Button
                    title="Accept ongoing"
                    onPress={handleAcceptRecurring}
                    variant="cta"
                    style={styles.actionButton}
                  />
                ) : null}
                {offer.isDirectOffer && onDecline ? (
                  <Button
                    title="Decline"
                    onPress={handleDecline}
                    variant="secondary"
                    style={styles.declineButton}
                  />
                ) : null}
              </>
            )}
          </View>

          {/* Collapse Button */}
          <Pressable onPress={toggleExpanded} style={styles.collapseButton}>
            <FontAwesome name="chevron-up" size={12} color={palette.muted} />
            <Text style={[styles.collapseText, { color: palette.muted }]}>
              Show less
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardShadowDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  payout: {
    fontSize: 22,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandHint: {
    alignItems: 'center',
    marginTop: 8,
  },
  details: {
    marginTop: 12,
    gap: 12,
  },
  divider: {
    height: 1,
    marginBottom: 4,
  },
  detailSection: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailText: {
    fontSize: 13,
  },
  dogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estimateLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  estimateValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  compareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  compareLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  warningCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 194, 77, 0.12)',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
  },
  declineButton: {
    flex: 0.6,
    minWidth: 80,
  },
  actingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  collapseText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
