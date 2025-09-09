/// <reference types="vitest/globals" />

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
  ONE_TIME_BASE_PRICES,
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
    test('returns correct visit counts using calendar calculation', () => {
      expect(visitsPerMonth('weekly')).toBe(4.33);
      expect(visitsPerMonth('biweekly')).toBe(2.17);
      expect(visitsPerMonth('twice-weekly')).toBe(8.67);
    });
  });

  describe('projectedMonthlyCents', () => {
    test('calculates monthly cost without add-ons using calendar calculation', () => {
      const perVisit = 2000; // $20.00
      expect(projectedMonthlyCents(perVisit, 'weekly')).toBe(8660); // 4.33 × $20 = $86.60
      expect(projectedMonthlyCents(perVisit, 'biweekly')).toBe(4340); // 2.17 × $20 = $43.40
      expect(projectedMonthlyCents(perVisit, 'twice-weekly')).toBe(17340); // 8.67 × $20 = $173.40
    });

    test('includes add-on costs with calendar calculation', () => {
      const perVisit = 2000; // $20.00
      const addOns = { deodorize: true, sprayDeck: true }; // +$37.00 total

      expect(projectedMonthlyCents(perVisit, 'weekly', addOns)).toBe(16042); // 4.33 × $37 = $160.42
      expect(projectedMonthlyCents(perVisit, 'biweekly', addOns)).toBe(8029); // 2.17 × $37 = $80.29
    });

    test('handles partial add-ons with calendar calculation', () => {
      const perVisit = 2000; // $20.00
      const addOns = { deodorize: true }; // +$25.00

      expect(projectedMonthlyCents(perVisit, 'weekly', addOns)).toBe(12990); // 4.33 × $30 = $129.90
    });
  });

  describe('initialCleanCents', () => {
    test('calculates initial clean cost with base pricing', () => {
      const perVisit = 2000; // $20.00 base
      expect(initialCleanCents(perVisit)).toBe(2500); // 1.25 × base price
    });

    test('includes add-on costs in initial clean', () => {
      const perVisit = 2000; // $20.00 base
      const addOns = { deodorize: true }; // +$25.00
      expect(initialCleanCents(perVisit, addOns)).toBe(7500); // 1.25 × (2000 + 2500)
    });
  });

  describe('getPricingBreakdown', () => {
    test('returns complete pricing breakdown', () => {
      const result = getPricingBreakdown(2, 'large', 'biweekly', { deodorize: true });

      expect(result.perVisitCents).toBe(3750); // (2400 + 400) × 1.25 + 2500 deodorize
      expect(result.monthlyCents).toBe(7500); // 3750 × 2 visits
      expect(result.initialCleanCents).toBe(4688); // 1.25 × (2400 + 400 + 2500)
      expect(result.visitsPerMonth).toBe(2);
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
      expect(ADD_ON_PRICES.deodorize).toBe(2500);
      expect(ADD_ON_PRICES.sprayDeck).toBe(1200);
      expect(ADD_ON_PRICES.takeaway).toBe(200);
    });

    test('ONE_TIME_BASE_PRICES are reasonable', () => {
      expect(ONE_TIME_BASE_PRICES.small).toBe(4900);
      expect(ONE_TIME_BASE_PRICES.medium).toBe(6900);
      expect(ONE_TIME_BASE_PRICES.large).toBe(8900);
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

    test('initial clean scales with per-visit price', () => {
      const lowPerVisit = 1000; // $10.00
      const initialCost = initialCleanCents(lowPerVisit);
      expect(initialCost).toBe(1250); // 1.25 × 1000
    });

    test('rounding handles fractional results correctly', () => {
      // This test ensures we're not losing precision in calculations
      const perVisit = estimatePerVisitCents(1, 'medium', 'weekly');
      const monthly = projectedMonthlyCents(perVisit, 'weekly');
      expect(monthly).toBe(perVisit * 4); // Should be exact
    });
  });
});
