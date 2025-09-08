// Consistency classification utilities for pet wellness tracking
export const consistencyKeyFor = (raw: string | null | undefined): string => {
  const v = (raw || '').toLowerCase();
  if (!v) return 'normal';
  if (v.includes('firm') || v.includes('formed') || v.includes('normal') || v.includes('healthy')) return 'normal';
  // Treat "loose" as "soft" to avoid duplicate categories
  if (v.includes('soft') || v.includes('loose')) return 'soft';
  if (v.includes('dry') || v.includes('hard')) return 'dry';
  if (v.includes('mucous') || v.includes('mucus')) return 'mucous';
  if (v.includes('greasy') || v.includes('fatty')) return 'greasy';
  return 'normal';
};

export const CONS_HEX: Record<string, string> = {
  normal: '#10b981', // green for normal
  soft: '#fbbf24',
  dry: '#60a5fa',
  mucous: '#8b5cf6',
  greasy: '#3b82f6',
  other: '#64748b',
  unknown: '#94a3b8',
};
