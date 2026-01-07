import { COMMON_ALLERGENS, detectAllergens } from '@/lib/wellness/allergenScan';

type InsightRule = {
  label: string;
  tokens: string[];
  note: string;
  scoreDelta: number;
  severity: 'high' | 'medium' | 'low';
};

export type IngredientHighlight = {
  label: string;
  match: string;
  note: string;
  severity: 'high' | 'medium' | 'low';
};

export type IngredientInsights = {
  allergens: string[];
  concerns: IngredientHighlight[];
  benefits: IngredientHighlight[];
  score: number | null;
  scoreLabel: string;
  scoreSummary: string;
  knownAllergens: string[];
};

const normalizeText = (value: string) => value.toLowerCase();

const CONCERN_RULES: InsightRule[] = [
  {
    label: 'Artificial preservatives',
    tokens: [
      'bha',
      'bht',
      'ethoxyquin',
      'propyl gallate',
      'tbhq',
      'sodium benzoate',
      'potassium sorbate',
      'sodium nitrate',
      'sodium nitrite',
      'calcium propionate',
      'sodium propionate',
      'propionic acid',
      'sorbic acid',
    ],
    note: 'Synthetic preservatives can be harder on sensitive stomachs.',
    scoreDelta: -12,
    severity: 'high',
  },
  {
    label: 'Meat by-products or meal',
    tokens: [
      'by-product',
      'byproduct',
      'meat meal',
      'meat and bone',
      'animal digest',
      'poultry by-product',
      'animal by-product',
      'animal meal',
    ],
    note: 'Look for named protein sources instead of generic meals.',
    scoreDelta: -10,
    severity: 'high',
  },
  {
    label: 'Fillers and cheap starches',
    tokens: [
      'corn',
      'corn meal',
      'corn starch',
      'corn gluten',
      'wheat',
      'wheat flour',
      'wheat middlings',
      'wheat gluten',
      'soy',
      'soybean',
      'soy flour',
      'barley',
      'white rice',
      'brewers rice',
      'rice bran',
      'rice flour',
      'oat hull',
      'oat flour',
      'potato starch',
      'pea starch',
      'cellulose',
      'powdered cellulose',
    ],
    note: 'Fillers can crowd out higher quality protein and nutrients.',
    scoreDelta: -7,
    severity: 'medium',
  },
  {
    label: 'Added sugar',
    tokens: ['corn syrup', 'sugar', 'molasses', 'dextrose', 'fructose', 'sucrose', 'cane sugar'],
    note: 'Added sugar is generally unnecessary in pet food.',
    scoreDelta: -8,
    severity: 'medium',
  },
  {
    label: 'Artificial colors',
    tokens: [
      'red 40',
      'yellow 5',
      'yellow 6',
      'blue 2',
      'caramel color',
      'fd&c',
      'color added',
      'titanium dioxide',
    ],
    note: 'Colors do not add nutrition and can be irritating for some dogs.',
    scoreDelta: -5,
    severity: 'low',
  },
];

const BENEFIT_RULES: InsightRule[] = [
  {
    label: 'Organ meats',
    tokens: ['liver', 'heart', 'kidney', 'tripe', 'gizzard', 'spleen'],
    note: 'Organ meats are nutrient-dense and rich in vitamins.',
    scoreDelta: 10,
    severity: 'high',
  },
  {
    label: 'Omega-3 fats',
    tokens: [
      'fish oil',
      'salmon oil',
      'sardine',
      'anchovy',
      'mackerel',
      'menhaden',
      'krill',
      'cod liver',
      'flaxseed',
      'chia',
      'omega 3',
      'omega-3',
      'epa',
      'dha',
      'algae oil',
    ],
    note: 'Omega-3s support skin, coat, and brain health.',
    scoreDelta: 8,
    severity: 'medium',
  },
  {
    label: 'Prebiotic fiber',
    tokens: [
      'chicory root',
      'inulin',
      'fructooligosaccharide',
      'fos',
      'mos',
      'pumpkin',
      'sweet potato',
      'carrot',
      'beet pulp',
      'psyllium',
      'dandelion',
      'jerusalem artichoke',
      'acacia',
    ],
    note: 'Prebiotics help feed healthy gut bacteria.',
    scoreDelta: 6,
    severity: 'medium',
  },
  {
    label: 'Probiotics',
    tokens: ['probiotic', 'lactobacillus', 'bifidobacterium', 'enterococcus', 'bacillus coagulans'],
    note: 'Probiotics help support digestion and stool quality.',
    scoreDelta: 8,
    severity: 'medium',
  },
  {
    label: 'Joint support',
    tokens: ['glucosamine', 'chondroitin', 'green-lipped mussel', 'green lipped mussel', 'msm'],
    note: 'Joint support ingredients can help with mobility.',
    scoreDelta: 5,
    severity: 'low',
  },
  {
    label: 'Antioxidant produce',
    tokens: ['blueberry', 'cranberry', 'spinach', 'kale', 'broccoli', 'pomegranate'],
    note: 'Fruits and greens add antioxidants for immune support.',
    scoreDelta: 4,
    severity: 'low',
  },
  {
    label: 'Named animal protein',
    tokens: [
      'chicken',
      'beef',
      'turkey',
      'lamb',
      'salmon',
      'duck',
      'venison',
      'rabbit',
      'bison',
      'pork',
      'whitefish',
    ],
    note: 'Named proteins are easier to identify and track.',
    scoreDelta: 4,
    severity: 'low',
  },
];

const resolveHighlights = (normalized: string, rules: InsightRule[]) => {
  const results: IngredientHighlight[] = [];
  const seen = new Set<string>();

  rules.forEach((rule) => {
    const match = rule.tokens.find((token) => normalized.includes(token));
    if (!match || seen.has(rule.label)) return;
    seen.add(rule.label);
    results.push({
      label: rule.label,
      match,
      note: rule.note,
      severity: rule.severity,
    });
  });

  return results;
};

const resolveScoreLabel = (score: number) => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Okay';
  return 'Needs improvement';
};

export function analyzeIngredients(ingredients: string | null | undefined): IngredientInsights {
  const raw = ingredients?.trim() ?? '';
  const allergens = detectAllergens(raw);
  if (!raw) {
    return {
      allergens: [],
      concerns: [],
      benefits: [],
      score: null,
      scoreLabel: 'Add ingredients',
      scoreSummary: 'Scan or paste ingredients to generate a wellness score.',
      knownAllergens: COMMON_ALLERGENS,
    };
  }

  const normalized = normalizeText(raw);
  const concerns = resolveHighlights(normalized, CONCERN_RULES);
  const benefits = resolveHighlights(normalized, BENEFIT_RULES);

  let score = 70;
  concerns.forEach((item) => {
    const rule = CONCERN_RULES.find((entry) => entry.label === item.label);
    if (rule) score += rule.scoreDelta;
  });
  benefits.forEach((item) => {
    const rule = BENEFIT_RULES.find((entry) => entry.label === item.label);
    if (rule) score += rule.scoreDelta;
  });
  score = Math.max(0, Math.min(100, score));

  const scoreLabel = resolveScoreLabel(score);
  const scoreSummary =
    benefits.length > concerns.length
      ? 'Overall ingredients lean positive.'
      : benefits.length === concerns.length
        ? 'Mixed signals. Review the ingredient list.'
        : 'Several ingredients are worth a second look.';

  return {
    allergens,
    concerns,
    benefits,
    score,
    scoreLabel,
    scoreSummary,
    knownAllergens: COMMON_ALLERGENS,
  };
}
