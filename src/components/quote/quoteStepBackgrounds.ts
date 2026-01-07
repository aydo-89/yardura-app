export type QuoteStepBackground = {
  /** Stable identifier for animation keys */
  id: string;
  /** Image to use in light mode */
  lightSrc: string;
  /** Image to use in dark mode */
  darkSrc: string;
  /** Object position tuning per image (left/right balance) */
  objectPosition?: string;
  /** 'left' | 'right' | 'middle' (for planning / readability) */
  orientation: "left" | "right" | "middle";
  /** Freeform tags for debugging/planning */
  tags?: string[];
};

/**
 * Background rotation for the quote wizard.
 * Goals:
 * - Alternate left/right compositions
 * - Rotate color families and dog “types”
 * - Prefer light+dark pairs (or complementary variants)
 * - Keep *landing page* hero backgrounds distinct where possible
 */
export const QUOTE_WIZARD_BACKGROUNDS: QuoteStepBackground[] = [
  {
    id: "springer_left",
    lightSrc: "/hero_backgrounds/white_springer_left_light.jpeg",
    darkSrc: "/hero_backgrounds/red_springer_left_dark.jpeg",
    orientation: "left",
    objectPosition: "42% center",
    tags: ["springer", "white/red"],
  },
  {
    id: "shibainu_right",
    lightSrc: "/hero_backgrounds/coral_shibainu_right_light.jpeg",
    darkSrc: "/hero_backgrounds/burghandy_shibainu_right_dark.jpeg",
    orientation: "right",
    objectPosition: "58% center",
    tags: ["shiba-inu", "coral/burgundy"],
  },
  {
    id: "dane_left",
    lightSrc: "/hero_backgrounds/cream_dane_left_light.jpeg",
    darkSrc: "/hero_backgrounds/brown_dane_left_dark.jpeg",
    orientation: "left",
    objectPosition: "44% center",
    tags: ["great-dane", "cream/brown"],
  },
  {
    id: "bernese_right",
    lightSrc: "/hero_backgrounds/mint_bernese_rigth_light.jpeg",
    darkSrc: "/hero_backgrounds/darkgreen_bernese_right_dark.jpeg",
    orientation: "right",
    objectPosition: "60% center",
    tags: ["bernese", "mint/darkgreen"],
  },
  {
    id: "basset_left",
    lightSrc: "/hero_backgrounds/white_basset_left_light.jpeg",
    darkSrc: "/hero_backgrounds/black_basset_left_dark.jpeg",
    orientation: "left",
    objectPosition: "42% center",
    tags: ["basset", "white/black"],
  },
  {
    id: "rotweiler_right",
    lightSrc: "/hero_backgrounds/yellow_rotweiler_right_light.jpeg",
    darkSrc: "/hero_backgrounds/brown_rotweiler_right_dark.jpeg",
    orientation: "right",
    objectPosition: "60% center",
    tags: ["rottweiler", "yellow/brown"],
  },
  // Extra variety if the wizard expands (or to avoid repeats for long sessions)
  {
    id: "shihzu_right",
    lightSrc: "/hero_backgrounds/mint_shihzu_right_light.jpeg",
    darkSrc: "/hero_backgrounds/darkgreen_shihzu_right_dark.jpeg",
    orientation: "right",
    objectPosition: "60% center",
    tags: ["shih-tzu", "mint/darkgreen"],
  },
  {
    id: "semoyed_left",
    lightSrc: "/hero_backgrounds/white_semoyed_left_light.jpeg",
    darkSrc: "/hero_backgrounds/black_semoyed_left_dark.jpeg",
    orientation: "left",
    objectPosition: "42% center",
    tags: ["samoyed", "white/black"],
  },
  {
    id: "boxer_right",
    lightSrc: "/hero_backgrounds/boxer_teal_right_light.jpeg",
    darkSrc: "/hero_backgrounds/boxer_chocolate_right_dark.jpeg",
    orientation: "right",
    objectPosition: "58% center",
    tags: ["boxer", "teal/chocolate"],
  },
];


