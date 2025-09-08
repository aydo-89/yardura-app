// Color classification utilities for pet wellness tracking
export const colorKeyFor = (raw: string | null | undefined): string => {
  const c = (raw || '').toLowerCase();
  if (!c) return 'normal';
  if (c.includes('red')) return 'red';
  if (c.includes('black') || c.includes('tarry') || c.includes('melena')) return 'black';
  if (c.includes('yellow') || c.includes('gray') || c.includes('grey')) return 'yellow';
  if (c.includes('green')) return 'normal';
  // Treat common healthy hues as normal (collapsed category)
  if (c.includes('brown') || c.includes('tan') || c.includes('normal') || c.includes('healthy')) return 'normal';
  return 'normal';
};

export const COLOR_HEX: Record<string, string> = {
  normal: '#10b981', // green for normal (good)
  red: '#ef4444',
  black: '#111827',
  yellow: '#f59e0b',
  green: '#10b981',
  other: '#64748b',
  unknown: '#94a3b8',
};

// Status color mapping for consistent UI
export const TONE_GREEN = '#10b981';
export const TONE_AMBER = '#f59e0b';
export const TONE_RED = '#ef4444';
export const INK_MUTED = 'text-slate-600';

// Helper for status-based color selection
export const toneForStatus = (status: 'normal' | 'monitor' | 'action'): string => {
  switch (status) {
    case 'normal': return TONE_GREEN;
    case 'monitor': return TONE_AMBER;
    case 'action': return TONE_RED;
    default: return TONE_GREEN;
  }
};
