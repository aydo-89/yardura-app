// Central export for all wellness utilities
export * from './color';
export * from './consistency';
export * from './date';
export * from './types';
export * from './thresholds';

// Wellness theme tokens for friendly, calm UI
export const wellnessTheme = {
  // Core palette (friendly + reassuring)
  green:   '#10B981', // success
  teal:    '#14B8A6', // calm accent
  blue:    '#3B82F6', // info
  yellow:  '#F59E0B', // monitor
  orange:  '#FB923C', // warm pet accent
  red:     '#EF4444', // critical
  slate50: '#F8FAFC',
  slate100:'#F1F5F9',
  slate200:'#E2E8F0',
  slate600:'#475569',
  slate700:'#334155',
  slate800:'#1F2937',
  // Content-specific semantic colors
  stool: {
    normal: '#8B5E34', // subtle brown accent; use sparingly
    yellow: '#F59E0B',
    red:    '#EF4444',
    black:  '#111827',
  },
  // Layout
  radiusLg: '16px',
  cardShadow: '0 6px 20px rgba(2, 6, 23, 0.06)',
};
