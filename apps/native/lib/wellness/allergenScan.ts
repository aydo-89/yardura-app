export const COMMON_ALLERGENS = [
  'chicken',
  'beef',
  'dairy',
  'milk',
  'cheese',
  'egg',
  'soy',
  'wheat',
  'corn',
  'lamb',
  'pork',
  'turkey',
  'duck',
  'fish',
  'salmon',
  'tuna',
  'peanut',
  'pea protein',
];

export function detectAllergens(ingredients: string | null | undefined): string[] {
  if (!ingredients) return [];
  const normalized = ingredients.toLowerCase();
  const matches = new Set<string>();

  COMMON_ALLERGENS.forEach((allergen) => {
    if (normalized.includes(allergen)) {
      matches.add(allergen);
    }
  });

  return Array.from(matches);
}
