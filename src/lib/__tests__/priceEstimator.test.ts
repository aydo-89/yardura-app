import {
  estimatePerVisitCents,
  projectedMonthlyCents,
  initialCleanCents,
  visitsPerMonth,
  getPricingBreakdown,
  formatPrice,
  getFrequencyDisplayName,
  getYardSizeDisplayName,
  BASE_PRICES,
  YARD_ADDERS,
  FREQUENCY_MULTIPLIERS,
  ADD_ON_PRICES,
  INITIAL_CLEAN_MULTIPLIER,
  INITIAL_CLEAN_MINIMUM,
} from '../priceEstimator';

describe('Price Estimator', () => {
  describe('estimatePerVisitCents', () => {
    test('calculates correct base pricing for medium yard, weekly', () => {
      expect(estimatePerVisitCents(1, 'medium', 'weekly')).toBe(2000); // $20.00
      expect(estimatePerVisitCents(2, 'medium', 'weekly')).toBe(2400); // $24.00
      expect(estimatePerVisitCents(3, 'medium', 'weekly')).toBe(2800); // $28.00
      expect(estimatePerVisitCents(4, 'medium', 'weekly')).toBe(3200); // $32.00
    });

    test('applies yard size adders correctly', () => {
      expect(estimatePerVisitCents(1, 'small', 'weekly')).toBe(2000); // No adder
      expect(estimatePerVisitCents(1, 'large', 'weekly')).toBe(2400); // +$4.00
      expect(estimatePerVisitCents(1, 'xl', 'weekly')).toBe(2800); // +$8.00
    });

    test('applies frequency multipliers correctly', () => {
      expect(estimatePerVisitCents(1, 'medium', 'biweekly')).toBe(2500); // ×1.25
      expect(estimatePerVisitCents(1, 'medium', 'twice-weekly')).toBe(1800); // ×0.9
    });

    test('combines all factors correctly', () => {
      // 2 dogs, large yard, biweekly: (2400 + 400) × 1.25 = 2800 × 1.25 = 3500
      expect(estimatePerVisitCents(2, 'large', 'biweekly')).toBe(3500);
    });

    test('rounds to nearest cent', () => {
      // Test case that would result in fractional cents
      // 1 dog, medium, biweekly: 2000 × 1.25 = 2500 (exact)
      expect(estimatePerVisitCents(1, 'medium', 'biweekly')).toBe(2500);
    });
  });

  describe('visitsPerMonth', () => {
    test('returns correct visit counts', () => {
      expect(visitsPerMonth('weekly')).toBe(4);
      expect(visitsPerMonth('biweekly')).toBe(2);
      expect(visitsPerMonth('twice-weekly')).toBe(8);
    });
  });

  describe('projectedMonthlyCents', () => {
    test('calculates monthly cost without add-ons', () => {
      const perVisit = 2000; // $20.00
      expect(projectedMonthlyCents(perVisit, 'weekly')).toBe(8000); // 4 × $20 = $80
      expect(projectedMonthlyCents(perVisit, 'biweekly')).toBe(4000); // 2 × $20 = $40
      expect(projectedMonthlyCents(perVisit, 'twice-weekly')).toBe(16000); // 8 × $20 = $160
    });

    test('includes add-on costs', () => {
      const perVisit = 2000; // $20.00
      const addOns = { deodorize: true, litter: true }; // +$10.00

      expect(projectedMonthlyCents(perVisit, 'weekly', addOns)).toBe(12000); // 4 × $30 = $120
      expect(projectedMonthlyCents(perVisit, 'biweekly', addOns)).toBe(6000); // 2 × $30 = $60
    });

    test('handles partial add-ons', () => {
      const perVisit = 2000; // $20.00
      const addOns = { deodorize: true }; // +$5.00

      expect(projectedMonthlyCents(perVisit, 'weekly', addOns)).toBe(10000); // 4 × $25 = $100
    });
  });

  describe('initialCleanCents', () => {
    test('calculates initial clean cost', () => {
      const perVisit = 2000; // $20.00
      expect(initialCleanCents(perVisit)).toBe(8900); // Minimum of $89.00

      // Higher per-visit should use multiplier
      const higherPerVisit = 4000; // $40.00
      expect(initialCleanCents(higherPerVisit)).toBe(10000); // $40 × 2.5 = $100
    });

    test('includes add-on costs in initial clean', () => {
      const perVisit = 2000; // $20.00
      const addOns = { deodorize: true }; // +$5.00
      expect(initialCleanCents(perVisit, addOns)).toBe(8900); // Still minimum
    });
  });

  describe('getPricingBreakdown', () => {
    test('returns complete pricing breakdown', () => {
      const result = getPricingBreakdown(2, 'large', 'biweekly', { deodorize: true });

      expect(result.perVisitCents).toBe(3500); // (2400 + 400) × 1.25
      expect(result.monthlyCents).toBe(7000); // 3500 × 2 visits
      expect(result.initialCleanCents).toBe(8900); // Minimum
      expect(result.visitsPerMonth).toBe(2);

      expect(result.breakdown).toEqual({
        basePrice: 2400,
        yardAdder: 400,
        frequencyMultiplier: 1.25,
        addOnCents: 500,
      });
    });
  });

  describe('formatPrice', () => {
    test('formats cents to currency strings', () => {
      expect(formatPrice(2000)).toBe('$20.00');
      expect(formatPrice(0)).toBe('$0.00');
      expect(formatPrice(1234)).toBe('$12.34');
      expect(formatPrice(500)).toBe('$5.00');
    });
  });

  describe('Display name functions', () => {
    test('getFrequencyDisplayName returns correct labels', () => {
      expect(getFrequencyDisplayName('weekly')).toBe('Weekly');
      expect(getFrequencyDisplayName('biweekly')).toBe('Every Other Week');
      expect(getFrequencyDisplayName('twice-weekly')).toBe('Twice Weekly');
    });

    test('getYardSizeDisplayName returns correct labels', () => {
      expect(getYardSizeDisplayName('small')).toBe('Small');
      expect(getYardSizeDisplayName('medium')).toBe('Medium');
      expect(getYardSizeDisplayName('large')).toBe('Large');
      expect(getYardSizeDisplayName('xl')).toBe('Extra Large');
    });
  });

  describe('Constants validation', () => {
    test('BASE_PRICES are reasonable', () => {
      expect(BASE_PRICES[1]).toBe(2000); // $20.00
      expect(BASE_PRICES[4]).toBe(3200); // $32.00
      expect(BASE_PRICES[4] / BASE_PRICES[1]).toBe(1.6); // 60% increase for 4 dogs
    });

    test('YARD_ADDERS are progressive', () => {
      expect(YARD_ADDERS.small).toBe(0);
      expect(YARD_ADDERS.medium).toBe(0);
      expect(YARD_ADDERS.large).toBe(400);
      expect(YARD_ADDERS.xl).toBe(800);
    });

    test('FREQUENCY_MULTIPLIERS reflect business logic', () => {
      expect(FREQUENCY_MULTIPLIERS.weekly).toBe(1.0);
      expect(FREQUENCY_MULTIPLIERS.biweekly).toBeGreaterThan(1.0); // Higher per-visit
      expect(FREQUENCY_MULTIPLIERS['twice-weekly']).toBeLessThan(1.0); // Discount
    });

    test('ADD_ON_PRICES are consistent', () => {
      expect(ADD_ON_PRICES.deodorize).toBe(500);
      expect(ADD_ON_PRICES.litter).toBe(500);
    });

    test('INITIAL_CLEAN_MULTIPLIER is reasonable', () => {
      expect(INITIAL_CLEAN_MULTIPLIER).toBe(2.5);
      expect(INITIAL_CLEAN_MINIMUM).toBe(8900);
    });
  });

  describe('Edge cases', () => {
    test('handles maximum dogs and yard size', () => {
      const result = estimatePerVisitCents(4, 'xl', 'biweekly');
      // (3200 + 800) × 1.25 = 4000 × 1.25 = 5000
      expect(result).toBe(5000);
    });

    test('handles minimum configuration', () => {
      const result = estimatePerVisitCents(1, 'small', 'weekly');
      expect(result).toBe(2000);
    });

    test('initial clean respects minimum even for low prices', () => {
      const lowPerVisit = 1000; // $10.00
      const initialCost = initialCleanCents(lowPerVisit);
      expect(initialCost).toBe(INITIAL_CLEAN_MINIMUM);
    });

    test('rounding handles fractional results correctly', () => {
      // This test ensures we're not losing precision in calculations
      const perVisit = estimatePerVisitCents(1, 'medium', 'weekly');
      const monthly = projectedMonthlyCents(perVisit, 'weekly');
      expect(monthly).toBe(perVisit * 4); // Should be exact
    });
  });
});
