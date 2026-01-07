export const brandColors = {
  coral: "#F3645B",
  coralInk: "#C43D37",
  porcelain: "#FAF7F1",
  evergreen: "#204B36",
  graphite: "#1B1E23",
  gold: "#FFC24D",
  mint: "#19B4A3",
  sunset: "#FF7A45",
  vanilla: "#FFF1DA",
  cocoa: "#3B2F2A",
} as const;

const parseHex = (hex: string) => {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

export const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const brandGradients = {
  coralToGold: `linear-gradient(135deg, ${brandColors.coral} 0%, ${brandColors.gold} 100%)`,
  mintToCoral: `linear-gradient(135deg, ${brandColors.coral} 0%, ${brandColors.gold} 100%)`,
  evergreenDepth: `linear-gradient(140deg, ${brandColors.evergreen} 0%, ${withAlpha(brandColors.evergreen, 0.82)} 100%)`,
  mintGlass: (startAlpha = 0.45, endAlpha = 0.25) =>
    `linear-gradient(135deg, ${withAlpha(brandColors.coral, startAlpha)}, ${withAlpha(brandColors.gold, endAlpha)})`,
  porcelainGlow: (alpha = 0.18) =>
    `linear-gradient(135deg, ${withAlpha(brandColors.vanilla, alpha)}, ${withAlpha(brandColors.gold, alpha * 0.8)})`,
  heroBackdrop: `linear-gradient(135deg, ${withAlpha(brandColors.porcelain, 0.95)} 0%, ${withAlpha(brandColors.vanilla, 0.98)} 45%, ${withAlpha(brandColors.sunset, 0.08)} 100%)`,
} as const;

export const brandShadows = {
  soft: `0 4px 12px ${withAlpha(brandColors.evergreen, 0.12)}`,
  medium: `0 16px 32px ${withAlpha(brandColors.graphite, 0.15)}`,
  strong: `0 32px 48px ${withAlpha(brandColors.graphite, 0.18)}`,
} as const;

export const brandRadii = {
  card: 12,
  pill: 999,
  base: 12,
} as const;

export const brandSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;
