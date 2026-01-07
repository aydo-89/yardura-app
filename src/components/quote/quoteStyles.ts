import { cn } from "@/lib/utils";
import { brandColors, withAlpha } from "@/shared/brand";

/**
 * InsightScoop Quote Flow Styles
 * Aligned with landing page brand identity:
 * - Primary: Coral (#F3645B)
 * - Accents: Gold (#FFC24D), Mint (#19B4A3), Evergreen (#204B36)
 * - Background: Porcelain (#FAF7F1), Vanilla (#FFF1DA)
 * - Text: Graphite (#1B1E23)
 * - Fonts: Nunito (headings), Inter (body)
 */

// Brand-aligned colors for consistency
const coral = brandColors.coral;
const coralInk = brandColors.coralInk;
const evergreen = brandColors.evergreen;
const gold = brandColors.gold;
const mint = brandColors.mint;
const porcelain = brandColors.porcelain;
const graphite = brandColors.graphite;
const vanilla = brandColors.vanilla;

export const quoteShellClass =
  "quote-shell relative z-0 min-h-screen bg-transparent text-brand-ink transition-colors duration-300 dark:text-cream-vanilla";

// Heading typography - Serif font matching landing page hero
export const quoteHeadingClass =
  "font-serif font-normal text-brand-ink dark:text-cream-vanilla";

export const quoteHeadingLgClass =
  "font-serif text-lg font-normal text-brand-ink md:text-xl dark:text-cream-vanilla";

export const quoteHeadingXlClass =
  "font-serif text-xl font-normal text-brand-ink md:text-2xl lg:text-3xl dark:text-cream-vanilla";

// Card title typography - slightly smaller, semibold for cards
export const quoteCardTitleClass =
  "font-serif text-base font-normal text-brand-ink md:text-lg dark:text-cream-vanilla";

// Step indicator chips
export const quoteStepChipBase =
  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all backdrop-blur font-heading";

export const quoteStepChipActive = cn(
  "border-brand-coral/40 bg-cream-vanilla/95 text-brand-ink shadow-[0_8px_20px_rgba(243,100,91,0.18)]",
  "dark:border-brand-coral/60 dark:bg-brand-coral/15 dark:text-cream-vanilla dark:shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
);

export const quoteStepChipCompleted = cn(
  "border-brand-coral/30 bg-cream-vanilla/75 text-brand-ink",
  "dark:border-brand-coral/40 dark:bg-transparent dark:text-cream-vanilla/90"
);

export const quoteStepChipIdle = cn(
  "border-transparent bg-cream-vanilla/50 text-brand-muted",
  "dark:bg-transparent dark:text-cream-vanilla/70"
);

// Main panel styling - warm cream/porcelain with coral accents
export const quotePanelClass = cn(
  "rounded-3xl border text-brand-ink backdrop-blur",
  "border-brand-coral/15 bg-cream-porcelain/95 shadow-[0_32px_80px_rgba(243,100,91,0.08)]",
  "dark:border-brand-coral/22 dark:bg-evergreen-800/90 dark:text-cream-vanilla dark:shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
);

export const quotePanelDesktopReset = "";

export const quoteSubtleTextClass =
  "text-brand-muted dark:text-cream-vanilla/80";

// Surface styling for nested cards - slightly lighter than panel
export const quoteSurfaceClass = cn(
  "rounded-2xl border shadow-[0_16px_40px_rgba(27,30,35,0.06)]",
  "border-brand-coral/10 bg-cream-vanilla/70",
  "dark:border-brand-coral/18 dark:bg-evergreen-700/70 dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
);

// Primary action button - Coral with gold hover glow
export const quoteActionButtonClass = cn(
  "rounded-2xl border font-semibold transition-all duration-200",
  "border-brand-coral/24 bg-brand-coral text-white",
  "hover:bg-brand-coral-ink hover:shadow-[0_12px_28px_rgba(243,100,91,0.3)]",
  "dark:border-brand-coral/40 dark:bg-brand-coral dark:text-white dark:hover:bg-brand-coral-ink"
);

// Secondary/outline button
export const quoteSecondaryButtonClass = cn(
  "rounded-2xl border-2 font-semibold transition-all duration-200",
  "border-brand-coral/30 bg-transparent text-brand-coral",
  "hover:bg-brand-coral/8 hover:border-brand-coral/50",
  "dark:border-brand-coral/40 dark:text-brand-coral dark:hover:bg-brand-coral/15"
);

// Muted badge/chip
export const quoteMutedBadgeClass = cn(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
  `bg-[${withAlpha(coral, 0.12)}] text-brand-coral-ink`,
  "dark:bg-brand-coral/12 dark:text-cream-vanilla"
);

// Gradient accent
export const quoteHighlightGradient =
  "bg-gradient-to-r from-brand-coral to-gold text-white";

// Form field labels
export const quoteFieldLabelClass =
  "text-brand-ink font-medium dark:text-cream-vanilla";

export const quoteFieldMutedClass =
  "text-brand-muted dark:text-cream-vanilla/85";

// Input styling - warm borders with coral focus
export const quoteInputClass = cn(
  "w-full rounded-2xl border p-3 text-brand-ink transition-all duration-200",
  "border-brand-coral/20 bg-white/80 placeholder:text-brand-subtle",
  "focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20 focus-visible:outline-none",
  "dark:border-brand-coral/30 dark:bg-evergreen-800 dark:text-cream-vanilla",
  "dark:placeholder:text-cream-vanilla/55 dark:focus:border-brand-coral dark:focus:ring-brand-coral/30"
);

// Helper to compose panel classes
export const withQuotePanel = (...classes: Array<string | false | null | undefined>) =>
  cn(quotePanelClass, quotePanelDesktopReset, ...classes);

// Success page styles
export const quoteSuccessShellClass =
  "relative min-h-screen bg-slate-50 text-brand-ink dark:bg-evergreen-900 dark:text-cream-vanilla";

export const quoteSuccessPanelClass = cn(
  "rounded-3xl border bg-white shadow-[0_26px_70px_rgba(27,30,35,0.06)]",
  "border-slate-200",
  "dark:border-brand-coral/25 dark:bg-evergreen-800/85 dark:shadow-[0_26px_70px_rgba(0,0,0,0.5)]"
);

export const quoteSuccessAccentCardClass = cn(
  "rounded-3xl border bg-white shadow-[0_22px_60px_rgba(27,30,35,0.08)]",
  "border-slate-200",
  "dark:border-brand-coral/25 dark:bg-evergreen-700/80 dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
);

// Interactive card styles (for service type, property selection, etc.)
export const interactiveCardBase = cn(
  "group flex h-full w-full flex-col justify-between rounded-3xl border-2 p-5 text-left",
  "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/50"
);

export const interactiveCardSelected = cn(
  "border-brand-coral/55 bg-brand-coral/8 text-brand-ink",
  "shadow-[0_20px_45px_rgba(243,100,91,0.2)] ring-2 ring-brand-coral/50",
  "dark:border-brand-coral/70 dark:bg-brand-coral/15 dark:text-cream-vanilla dark:ring-brand-coral/40"
);

export const interactiveCardIdle = cn(
  "border-brand-coral/15 bg-cream-vanilla/60 text-brand-ink",
  "hover:border-brand-coral/35 hover:bg-cream-vanilla/80 hover:shadow-[0_12px_32px_rgba(243,100,91,0.1)]",
  "dark:border-brand-coral/25 dark:bg-evergreen-800/80 dark:text-cream-vanilla",
  "dark:hover:border-brand-coral/45"
);

// Progress bar styling
export const quoteProgressBarClass = cn(
  "h-1.5 rounded-full transition-all duration-500",
  "bg-gradient-to-r from-brand-coral to-gold"
);

export const quoteProgressTrackClass = cn(
  "h-1.5 rounded-full",
  "bg-brand-coral/15 dark:bg-brand-coral/20"
);

// Footer styling
export const quoteFooterClass = cn(
  "fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur",
  "border-brand-coral/15 bg-cream-porcelain/90 shadow-[0_-4px_12px_rgba(243,100,91,0.04)]",
  "dark:border-brand-coral/30 dark:bg-evergreen-900/90 dark:text-cream-vanilla"
);
