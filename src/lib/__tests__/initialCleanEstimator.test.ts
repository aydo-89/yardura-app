import { describe, it, expect } from 'vitest';
import {
  calculateInitialClean,
  mapDateToBucket,
  formatInitialCleanPrice,
  getBucketLabel,
  isValidBucket,
  getDefaultConfig,
  type CleanupBucket,
} from '../initialCleanEstimator';

describe('Initial Clean Estimator', () => {
  const config = getDefaultConfig();

  describe('calculateInitialClean', () => {
    it('should calculate initial clean for well maintained yard (7 days)', async () => {
      const result = await calculateInitialClean(2000, '7', 1, 'medium', {}, 'yardura');

      expect(result.initialCleanCents).toBe(4900); // Floor price for well maintained
      expect(result.bucket).toBe('7');
      expect(result.breakdown.bucketMultiplier).toBe(1.0);
    });

    it('should calculate initial clean for moderate accumulation (30 days)', async () => {
      const result = await calculateInitialClean(2000, '30', 1, 'medium', {}, 'yardura');

      expect(result.initialCleanCents).toBe(6900); // 2000 * 1.75 = 3500, but floored at 6900
      expect(result.breakdown.bucketMultiplier).toBe(1.75);
    });

    it('should handle yard size variations', async () => {
      const smallResult = await calculateInitialClean(2000, '30', 1, 'small', {}, 'yardura');
      const largeResult = await calculateInitialClean(2000, '30', 1, 'large', {}, 'yardura');
      const xlResult = await calculateInitialClean(2000, '30', 1, 'xl', {}, 'yardura');

      expect(smallResult.initialCleanCents).toBe(6900); // Floor price applies
      expect(largeResult.initialCleanCents).toBe(6900); // Floor price applies
      expect(xlResult.initialCleanCents).toBe(6900); // Floor price applies
    });

    it('should handle dog count variations', async () => {
      const oneDog = await calculateInitialClean(2000, '30', 1, 'medium', {}, 'yardura');
      const threeDogs = await calculateInitialClean(2000, '30', 3, 'medium', {}, 'yardura');
      const fourDogs = await calculateInitialClean(2000, '30', 4, 'medium', {}, 'yardura');

      expect(oneDog.initialCleanCents).toBe(6900); // Floor price applies
      expect(threeDogs.initialCleanCents).toBe(6900); // Floor price applies
      expect(fourDogs.initialCleanCents).toBe(6900); // Floor price applies
    });

    it('should respect floor prices', async () => {
      // Test with a very low per-visit price that would result in amount below floor
      const result = await calculateInitialClean(500, '60', 1, 'medium', {}, 'yardura');

      expect(result.initialCleanCents).toBe(6900); // Should be floor price
    });

    it('should handle maximum backlog bucket', async () => {
      const result = await calculateInitialClean(2000, '999', 1, 'medium', {}, 'yardura');

      expect(result.initialCleanCents).toBe(8900); // Floor price applies
      expect(result.breakdown.bucketMultiplier).toBe(2.5);
    });
  });

  describe('mapDateToBucket', () => {
    const today = new Date();

    it('should map recent dates to well maintained bucket', () => {
      const recentDate = new Date(today);
      recentDate.setDate(today.getDate() - 5); // 5 days ago

      expect(mapDateToBucket(recentDate)).toBe('7');
    });

    it('should map 2-week old dates to light accumulation', () => {
      const date = new Date(today);
      date.setDate(today.getDate() - 10); // 10 days ago

      expect(mapDateToBucket(date)).toBe('14');
    });

    it('should map month-old dates to moderate accumulation', () => {
      const date = new Date(today);
      date.setDate(today.getDate() - 25); // 25 days ago

      expect(mapDateToBucket(date)).toBe('30');
    });

    it('should map old dates to maximum backlog', () => {
      const date = new Date(today);
      date.setFullYear(today.getFullYear() - 1); // 1 year ago

      expect(mapDateToBucket(date)).toBe('999');
    });
  });

  describe('formatInitialCleanPrice', () => {
    it('should format zero as Free', () => {
      expect(formatInitialCleanPrice(0)).toBe('Free');
    });

    it('should format cents to dollars with two decimal places', () => {
      expect(formatInitialCleanPrice(5000)).toBe('$50.00');
      expect(formatInitialCleanPrice(1234)).toBe('$12.34');
      expect(formatInitialCleanPrice(100)).toBe('$1.00');
    });
  });

  describe('getBucketLabel', () => {
    it('should return correct labels for each bucket', () => {
      expect(getBucketLabel('7', config)).toBe('Today / ≤ 7 days (Well maintained)');
      expect(getBucketLabel('30', config)).toBe('15–30 days (Moderate accumulation)');
      expect(getBucketLabel('999', config)).toBe('90+ days / Not sure (Deep clean recommended)');
    });
  });

  describe('isValidBucket', () => {
    it('should validate correct bucket values', () => {
      expect(isValidBucket('7')).toBe(true);
      expect(isValidBucket('30')).toBe(true);
      expect(isValidBucket('999')).toBe(true);
    });

    it('should reject invalid bucket values', () => {
      expect(isValidBucket('5')).toBe(false);
      expect(isValidBucket('100')).toBe(false);
      expect(isValidBucket('abc')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle minimum values', async () => {
      const result = await calculateInitialClean(1000, '7', 1, 'small', {}, 'yardura');
      expect(result.initialCleanCents).toBe(4900); // Floor price applies
    });

    it('should handle maximum values', async () => {
      const result = await calculateInitialClean(5000, '999', 4, 'xl', {}, 'yardura');
      expect(result.initialCleanCents).toBe(8900); // Floor price applies
    });

    it('should handle leap year dates correctly', () => {
      // Test with Feb 29, 2024
      const leapYearDate = new Date('2024-02-29');
      const bucket = mapDateToBucket(leapYearDate);
      expect(['7', '14', '30', '60', '90', '999']).toContain(bucket);
    });
  });
});
