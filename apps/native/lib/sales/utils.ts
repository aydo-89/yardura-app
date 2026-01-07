import type { OutboundLead } from '@/lib/api/types';

export type DogPresenceValue = 'HAS_DOG' | 'NO_DOG' | 'UNKNOWN';

export const dogPresenceOptions: {
  value: DogPresenceValue;
  label: string;
  description?: string;
}[] = [
  {
    value: 'HAS_DOG',
    label: 'Dog on site',
    description: 'Saw or heard a dog',
  },
  { value: 'NO_DOG', label: 'No dog' },
  { value: 'UNKNOWN', label: 'Not sure' },
];

export const encounterOptions = [
  { value: 'NOT_HOME', label: 'Not home / no answer', color: '#f59e0b' },
  { value: 'NO_THANK_YOU', label: 'No thank you', color: '#f97316' },
  { value: 'RUDE', label: 'Rude / hostile', color: '#ef4444' },
  { value: 'NO_SOLICITING', label: 'No soliciting', color: '#6b7280' },
  { value: 'LEFT_FLYER', label: 'Left door hanger', color: '#14b8a6' },
  { value: 'INTERESTED', label: 'Interested / follow up', color: '#10b981' },
  { value: 'QUOTED', label: 'Quoted', color: '#6366f1' },
  { value: 'SUBSCRIBED', label: 'Subscribed', color: '#0ea5e9' },
];

export const objectionOptions = [
  { value: 'WALKS', label: 'Dog goes on walks' },
  { value: 'SCOOP_IMMEDIATELY', label: 'We scoop right away' },
  { value: 'DOESNT_BOTHER', label: "Doesn't bother us" },
  { value: 'BUSY', label: 'Busy / no time' },
  { value: 'COST', label: 'Cost concerns' },
];

export const activityTypes = [
  { value: 'DOOR_KNOCK', label: 'Door Knock' },
  { value: 'CALL', label: 'Call' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'NOTE', label: 'Note' },
];

export const pipelineStageOptions = [
  { value: 'all', label: 'All stages' },
  { value: 'cold', label: 'Cold' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const objectionValueByLabel = new Map(
  objectionOptions.map((option) => [option.label.toLowerCase(), option.value]),
);

export function normalizeResultValue(result?: string | null): string | null {
  if (!result) return null;
  const lower = result.toLowerCase();
  if (lower.includes('not home')) return 'NOT_HOME';
  if (lower.includes('no thank')) return 'NO_THANK_YOU';
  if (lower.includes('rude')) return 'RUDE';
  if (lower.includes('solicit')) return 'NO_SOLICITING';
  if (lower.includes('flyer') || lower.includes('door hanger')) return 'LEFT_FLYER';
  if (lower.includes('interested') || lower.includes('follow')) return 'INTERESTED';
  return result.toUpperCase().replace(/[^A-Z_]/g, '');
}

export function parseTagLine(notes?: string | null): Record<string, string> {
  if (!notes) return {};
  const tagLine = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith('tags:'));
  if (!tagLine) return {};
  const payload = tagLine.slice(5).trim();
  const entries = payload
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, value] = pair.split('=');
      return [key?.trim(), value?.trim()] as [string | undefined, string | undefined];
    })
    .filter((tuple): tuple is [string, string] => Boolean(tuple[0]) && Boolean(tuple[1]));
  return Object.fromEntries(entries);
}

type TagDetails = {
  dogPresence?: DogPresenceValue | null;
  dogCount?: number | null;
  encounterTags?: string[];
  objectionTags?: string[];
};

export function buildTagLine(details: TagDetails): string | null {
  const parts: string[] = [];
  if (details.dogPresence) {
    parts.push(`dog=${details.dogPresence}`);
  }
  if (
    typeof details.dogCount === 'number'
    && Number.isFinite(details.dogCount)
    && details.dogCount >= 0
  ) {
    parts.push(`dog_count=${details.dogCount}`);
  }
  if (details.encounterTags?.length) {
    parts.push(`encounter=${details.encounterTags[0]}`);
  }
  if (details.objectionTags?.length) {
    parts.push(`objections=${details.objectionTags.join('|')}`);
  }
  if (!parts.length) return null;
  return `Tags: ${parts.join(',')}`;
}

export function buildNotesWithTags(
  tagLine: string | null,
  notes?: string | null,
): string | null {
  const payload = [tagLine, notes]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment && segment.length > 0))
    .join('\n')
    .trim();
  return payload.length ? payload : null;
}

export function getLeadCoordinates(lead: {
  latitude?: number | null;
  longitude?: number | null;
  lastActivity?: { location?: { lat?: number; lng?: number } | null } | null;
}): { latitude: number; longitude: number } | null {
  if (
    typeof lead.latitude === 'number'
    && Number.isFinite(lead.latitude)
    && typeof lead.longitude === 'number'
    && Number.isFinite(lead.longitude)
  ) {
    return { latitude: lead.latitude, longitude: lead.longitude };
  }

  const fallback = lead.lastActivity?.location;
  if (
    fallback
    && typeof fallback.lat === 'number'
    && Number.isFinite(fallback.lat)
    && typeof fallback.lng === 'number'
    && Number.isFinite(fallback.lng)
  ) {
    return { latitude: fallback.lat, longitude: fallback.lng };
  }

  return null;
}

export type QuickVisitMeta = {
  tags: Record<string, string>;
  encounterToken: string | null;
  dogToken: DogPresenceValue | null;
  objectionTokens: string[];
};

export function getLeadQuickVisitMeta(lead: OutboundLead): QuickVisitMeta {
  const lastActivityNotes =
    lead.lastActivity && 'notes' in lead.lastActivity
      ? (lead.lastActivity as { notes?: string | null }).notes ?? null
      : null;
  const lastActivityResult =
    lead.lastActivity && 'result' in lead.lastActivity
      ? (lead.lastActivity as { result?: string | null }).result ?? null
      : null;

  const tags = parseTagLine(lastActivityNotes);
  const encounterToken = normalizeResultValue(tags.encounter || lastActivityResult);
  const resolvedDogToken = (() => {
    const tagValue = tags.dog ? tags.dog.toUpperCase() : null;
    if (tagValue === 'HAS_DOG') return 'HAS_DOG';
    if (tagValue === 'NO_DOG') return 'NO_DOG';
    if (tagValue === 'UNKNOWN') return 'UNKNOWN';
    if (typeof lead.dogs === 'number') {
      return lead.dogs > 0 ? 'HAS_DOG' : 'NO_DOG';
    }
    const normalizedNotes = lastActivityNotes?.toLowerCase() ?? '';
    if (/(dog on site|has dog|friendly dog|dog present|dog out)/i.test(normalizedNotes)) {
      return 'HAS_DOG';
    }
    if (/(no dog|without dog|dog not|dog gone)/i.test(normalizedNotes)) {
      return 'NO_DOG';
    }
    return null;
  })();

  const objectionTokensSet = new Set<string>();
  if (tags.objections) {
    tags.objections
      .split('|')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
      .forEach((token) => objectionTokensSet.add(token));
  }

  const humanObjectionLine = lastActivityNotes
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith('objections:'));

  if (humanObjectionLine) {
    const payload = humanObjectionLine.slice('Objections:'.length).trim();
    if (payload) {
      payload
        .split(/[,|]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((label) => {
          const normalized = label.toLowerCase();
          const matchedValue =
            objectionValueByLabel.get(normalized)
            || objectionOptions.find((option) =>
              option.label.toLowerCase().includes(normalized),
            )?.value
            || label.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
          if (matchedValue) {
            objectionTokensSet.add(matchedValue);
          }
        });
    }
  }

  return {
    tags,
    encounterToken,
    dogToken: resolvedDogToken,
    objectionTokens: Array.from(objectionTokensSet),
  };
}

export function formatLeadName(lead?: OutboundLead | null): string {
  if (!lead) return 'New lead';
  const first = lead.firstName?.trim() ?? '';
  const last = lead.lastName?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const addressLabel = lead.address?.split(',')[0]?.trim();
  if (addressLabel) return `Lead at ${addressLabel}`;
  const city = lead.city?.trim();
  if (city) return `Lead in ${city}`;
  const phone = lead.phone?.trim();
  if (phone) return `Lead • ${phone.slice(-4)}`;
  return 'New lead';
}

export function formatLeadAddress(lead?: OutboundLead | null): string {
  if (!lead) return '';
  const parts = [lead.address, lead.city, lead.state, lead.zipCode]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));
  return parts.join(', ');
}

export function stageColorToHex(stageColor?: string | null): string {
  switch (stageColor) {
    case 'cyan':
      return '#06b6d4';
    case 'blue':
      return '#3b82f6';
    case 'green':
    case 'emerald':
      return '#10b981';
    case 'amber':
      return '#f59e0b';
    case 'rose':
      return '#f43f5e';
    default:
      return '#64748b';
  }
}
