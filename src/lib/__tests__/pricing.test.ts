/// <reference types="vitest/globals" />

import {
  calcPerVisitEstimate,
  calcOneTimeEstimate,
  calcInstantQuote,
  BASE_RATES,
  YARD_SIZE_MULTIPLIERS,
  type Frequency,
} from '../pricing';

describe('Pricing Calculator', () => {
  describe('calcPerVisitEstimate', () => {
    describe('base pricing by dog count', () => {
      test('calculates correct base price for 1 dog weekly', () => {
        const result = calcPerVisitEstimate(1, 'weekly');
        expect(result).toBe(20); // base1 = $20
      });

      test('calculates correct base price for 2 dogs weekly', () => {
        const result = calcPerVisitEstimate(2, 'weekly');
        expect(result).toBe(24); // base2 = $24
      });

      test('calculates correct base price for 3 dogs weekly', () => {
        const result = calcPerVisitEstimate(3, 'weekly');
        expect(result).toBe(28); // base3 = $28
      });

      test('adds extra dog charge for 4+ dogs weekly', () => {
        const result = calcPerVisitEstimate(4, 'weekly');
        expect(result).toBe(32); // base3 + 1 extra dog = 28 + 4 = $32
      });

      test('scales correctly for many dogs', () => {
        const result = calcPerVisitEstimate(6, 'weekly');
        expect(result).toBe(40); // base3 + 3 extra dogs = 28 + (3 × 4) = $40
      });
    });

    describe('yard size multipliers', () => {
      test('applies small yard discount (0.8x)', () => {
        const result = calcPerVisitEstimate(1, 'weekly', 'small');
        expect(result).toBe(16); // 20 × 0.8 = $16
      });

      test('applies medium yard base (1.0x)', () => {
        const result = calcPerVisitEstimate(1, 'weekly', 'medium');
        expect(result).toBe(20); // 20 × 1.0 = $20
      });

      test('applies large yard premium (1.2x)', () => {
        const result = calcPerVisitEstimate(1, 'weekly', 'large');
        expect(result).toBe(24); // 20 × 1.2 = $24
      });

      test('applies extra-large yard premium (1.4x)', () => {
        const result = calcPerVisitEstimate(1, 'weekly', 'xlarge');
        expect(result).toBe(28); // 20 × 1.4 = $28
      });
    });

    describe('frequency pricing', () => {
      test('weekly pricing - one visit per week', () => {
        // tier is per visit
        const result = calcPerVisitEstimate(1, 'weekly');
        expect(result).toBe(20);
      });

      test('twice-weekly pricing - two visits per week', () => {
        // $32 weekly total / 2 visits = $16 per visit
        const result = calcPerVisitEstimate(1, 'twice-weekly');
        expect(result).toBe(16);
      });

      test('bi-weekly pricing - charged per visit', () => {
        // $28 per visit (higher per-visit rate)
        const result = calcPerVisitEstimate(1, 'bi-weekly');
        expect(result).toBe(28);
      });
    });

    describe('add-ons', () => {
      test('adds deodorizing charge', () => {
        const result = calcPerVisitEstimate(1, 'weekly', { deodorize: true, litter: false });
        expect(result).toBe(30); // 20 + 10 deodorize = $30
      });

      test('adds litter box charge', () => {
        const result = calcPerVisitEstimate(1, 'weekly', { deodorize: false, litter: true });
        expect(result).toBe(25); // 20 + 5 litter = $25
      });

      test('adds both deodorize and litter', () => {
        const result = calcPerVisitEstimate(1, 'weekly', { deodorize: true, litter: true });
        expect(result).toBe(35); // 20 + 10 + 5 = $35
      });

      test('add-ons combine with yard size', () => {
        const result = calcPerVisitEstimate(1, 'weekly', 'large', {
          deodorize: true,
          litter: false,
        });
        // 20 × 1.2 + 10 = 24 + 10 = $34
        expect(result).toBe(34);
      });
    });

    describe('backward compatibility', () => {
      test('works with no yard size or add-ons', () => {
        expect(calcPerVisitEstimate(2, 'weekly')).toBe(24);
      });

      test('works with add-ons object as third argument', () => {
        expect(calcPerVisitEstimate(2, 'weekly', { deodorize: true, litter: false })).toBe(34);
      });

      test('works with yard size and add-ons', () => {
        expect(calcPerVisitEstimate(2, 'weekly', 'large', { deodorize: true, litter: false })).toBe(
          38.8
        );
      });
    });
  });

  describe('calcOneTimeEstimate', () => {
    test('calculates base one-time price for 1 dog', () => {
      const result = calcOneTimeEstimate(1);
      expect(result).toBe(89); // one-time base1
    });

    test('calculates one-time price for 2 dogs', () => {
      const result = calcOneTimeEstimate(2);
      expect(result).toBe(104); // one-time base2
    });

    test('calculates one-time price for 3 dogs', () => {
      const result = calcOneTimeEstimate(3);
      expect(result).toBe(119); // one-time base3
    });

    test('adds extra dog charge for 4+ dogs', () => {
      const result = calcOneTimeEstimate(4);
      expect(result).toBe(134); // 119 + 15 = $134
    });

    test('applies yard size multiplier', () => {
      const result = calcOneTimeEstimate(1, 'large');
      expect(result).toBe(106.8); // 89 × 1.2 = $106.80
    });

    test('applies xlarge yard multiplier', () => {
      const result = calcOneTimeEstimate(1, 'xlarge');
      expect(result).toBe(124.6); // 89 × 1.4 = $124.60
    });

    test('adds deodorizing charge', () => {
      const result = calcOneTimeEstimate(1, { deodorize: true });
      expect(result).toBe(99); // 89 + 10 = $99
    });

    test('combines yard size and deodorize', () => {
      const result = calcOneTimeEstimate(1, 'large', { deodorize: true });
      expect(result).toBe(116.8); // 89 × 1.2 + 10 = $116.80
    });

    test('handles maximum configuration', () => {
      const result = calcOneTimeEstimate(5, 'xlarge', { deodorize: true });
      // (119 + 2×15) × 1.4 + 10 = 149 × 1.4 + 10 = 208.6 + 10 = $218.60
      expect(result).toBe(218.6);
    });
  });

  describe('calcInstantQuote', () => {
    test('delegates to calcPerVisitEstimate for recurring frequencies', () => {
      const frequencies: Frequency[] = ['weekly', 'twice-weekly', 'bi-weekly'];

      frequencies.forEach((freq) => {
        const result = calcInstantQuote(2, freq, 'medium', { deodorize: false, litter: false });
        const expected = calcPerVisitEstimate(2, freq, 'medium', {
          deodorize: false,
          litter: false,
        });
        expect(result).toBe(expected);
      });
    });

    test('delegates to calcOneTimeEstimate for one-time frequency', () => {
      const result = calcInstantQuote(2, 'one-time', 'large', { deodorize: true, litter: false });
      const expected = calcOneTimeEstimate(2, 'large', { deodorize: true });
      expect(result).toBe(expected);
    });

    test('ignores litter add-on for one-time service', () => {
      // Litter add-on doesn't apply to one-time (verified in calcOneTimeEstimate)
      const withLitter = calcInstantQuote(1, 'one-time', 'medium', {
        deodorize: false,
        litter: true,
      });
      const withoutLitter = calcInstantQuote(1, 'one-time', 'medium', {
        deodorize: false,
        litter: false,
      });
      expect(withLitter).toBe(withoutLitter);
    });
  });

  describe('constants validation', () => {
    test('BASE_RATES structure is correct', () => {
      expect(BASE_RATES.weekly).toBeDefined();
      expect(BASE_RATES['twice-weekly']).toBeDefined();
      expect(BASE_RATES['bi-weekly']).toBeDefined();
      expect(BASE_RATES['one-time']).toBeDefined();
    });

    test('YARD_SIZE_MULTIPLIERS are progressive', () => {
      expect(YARD_SIZE_MULTIPLIERS.small).toBeLessThan(YARD_SIZE_MULTIPLIERS.medium);
      expect(YARD_SIZE_MULTIPLIERS.medium).toBeLessThan(YARD_SIZE_MULTIPLIERS.large);
      expect(YARD_SIZE_MULTIPLIERS.large).toBeLessThan(YARD_SIZE_MULTIPLIERS.xlarge);
    });

    test('twice-weekly is cheaper per visit than weekly', () => {
      const weekly = calcPerVisitEstimate(1, 'weekly');
      const twiceWeekly = calcPerVisitEstimate(1, 'twice-weekly');
      expect(twiceWeekly).toBeLessThan(weekly);
    });

    test('bi-weekly is more expensive per visit than weekly', () => {
      const weekly = calcPerVisitEstimate(1, 'weekly');
      const biWeekly = calcPerVisitEstimate(1, 'bi-weekly');
      expect(biWeekly).toBeGreaterThan(weekly);
    });
  });

  describe('edge cases', () => {
    test('handles minimum configuration (1 dog, small yard)', () => {
      const result = calcPerVisitEstimate(1, 'weekly', 'small', {
        deodorize: false,
        litter: false,
      });
      expect(result).toBe(16); // Minimum possible price
    });

    test('handles maximum recurring configuration', () => {
      const result = calcPerVisitEstimate(6, 'bi-weekly', 'xlarge', {
        deodorize: true,
        litter: true,
      });
      // base3 + 3 extra = 36 + (3×4) = 48
      // × 1.4 (xlarge) = 67.2
      // + deodorize (10) + litter (5) = 82.2
      expect(result).toBe(82.2);
    });

    test('returns properly rounded cents', () => {
      // Verify no floating point errors
      const result = calcPerVisitEstimate(1, 'weekly', 'large');
      expect(Number.isInteger(result * 100)).toBe(true);
    });

    test('handles zero dogs gracefully', () => {
      // Edge case - should use base1 tier
      const result = calcPerVisitEstimate(0, 'weekly');
      expect(result).toBe(20);
    });
  });

  describe('real-world pricing scenarios', () => {
    test('typical household: 2 dogs, medium yard, weekly', () => {
      const perVisit = calcPerVisitEstimate(2, 'weekly', 'medium', {
        deodorize: false,
        litter: false,
      });
      expect(perVisit).toBe(24);
      // Monthly: ~$104 (4.33 visits)
    });

    test('cat owner combo: 1 dog, 1 cat, weekly with litter', () => {
      const perVisit = calcPerVisitEstimate(1, 'weekly', 'medium', {
        deodorize: false,
        litter: true,
      });
      expect(perVisit).toBe(25);
    });

    test('premium service: deodorize after each visit', () => {
      const perVisit = calcPerVisitEstimate(2, 'weekly', 'medium', {
        deodorize: true,
        litter: false,
      });
      expect(perVisit).toBe(34);
    });

    test('initial cleanup for new customer', () => {
      const oneTime = calcOneTimeEstimate(2, 'medium', { deodorize: true });
      expect(oneTime).toBe(114); // $104 base + $10 deodorize
    });
  });
});
