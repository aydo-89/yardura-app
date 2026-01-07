export type DisposalMode = 'standard' | 'haul-away' | 'compost';

const HAUL_AWAY_MODES = new Set(['takeaway', 'haul-away', 'haulaway']);
const COMPOST_MODES = new Set(['compost', 'compost-routing', 'zero-waste']);
const LEGACY_COMPOST_PATTERN = /^\d{1,3}%?$/;

export const resolveDisposalMode = (raw?: string | null): DisposalMode => {
  const normalized = raw?.toLowerCase().trim();
  if (!normalized) return 'standard';
  if (HAUL_AWAY_MODES.has(normalized)) return 'haul-away';
  if (COMPOST_MODES.has(normalized)) return 'compost';
  if (LEGACY_COMPOST_PATTERN.test(normalized)) return 'compost';
  if (normalized.startsWith('eco') && /\d/.test(normalized)) return 'compost';
  return 'standard';
};

export const isHaulAwayMode = (raw?: string | null): boolean =>
  resolveDisposalMode(raw) === 'haul-away';

export const isCompostMode = (raw?: string | null): boolean =>
  resolveDisposalMode(raw) === 'compost';

export const resolveDisposalTargetLabel = (
  mode: DisposalMode,
  fallbackLabel: string,
  overrideLabel?: string | null,
) => {
  if (mode === 'haul-away') {
    return overrideLabel ?? 'the portable haul-away container';
  }
  if (mode === 'compost') {
    return overrideLabel ?? 'the compost container';
  }
  return fallbackLabel;
};

export const buildDisposalCopy = (mode: DisposalMode, targetLabel: string) => {
  if (mode === 'haul-away') {
    return {
      stepLabel: 'Haul-away transfer',
      stepDescription: `Seal the bag and place it in ${targetLabel}. Capture a proof photo.`,
      title: 'Haul-away proof',
      subtitle: `Seal the bag and place it in ${targetLabel}. Snap a quick photo.`,
      cardTitle: 'Haul-away photo',
      cardBody: 'Show the sealed bag fully inside the container.',
      helperText: 'Capture a haul-away proof photo before continuing.',
    };
  }
  if (mode === 'compost') {
    return {
      stepLabel: 'Compost routing',
      stepDescription: `Seal the bag and place it in ${targetLabel}. Capture a proof photo.`,
      title: 'Compost routing proof',
      subtitle: `Place the sealed bag in ${targetLabel} and snap a quick photo.`,
      cardTitle: 'Compost proof photo',
      cardBody: 'Show the sealed bag inside the compost container.',
      helperText: 'Capture a compost routing photo before continuing.',
    };
  }
  return {
    stepLabel: 'Bag drop proof',
    stepDescription: `Leave the sealed bag at ${targetLabel} and snap a photo.`,
    title: 'Bag drop proof',
    subtitle: `Leave the sealed bag at ${targetLabel} and snap a quick photo.`,
    cardTitle: 'Bag drop photo',
    cardBody: 'Ensure the bag location is visible in the frame.',
    helperText: 'Capture a bag drop photo before continuing.',
  };
};
