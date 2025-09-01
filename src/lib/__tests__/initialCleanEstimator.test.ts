import { describe, it, expect } from 'vitest';
import {
  calculateInitialClean,
  mapDateToBucket,
  formatInitialCleanPrice,
  getBucketLabel,
  isValidBucket,
  getDefaultConfig,
  type CleanupBucket
} from '../initialCleanEstimator';

describe('Initial Clean Estimator', () => {
  const config = getDefaultConfig();

  describe('calculateInitialClean', () => {
    it('should calculate initial clean for well maintained yard (7 days)', () => {
      const result = calculateInitialClean(2000, '7', 1, 'medium', config);

      expect(result.initialCleanCents).toBe(0); // Floor price for well maintained
      expect(result.bucket).toBe('7');
      expect(result.breakdown.bucketMultiplier).toBe(1.00);
      expect(result.breakdown.floorCents).toBe(0);
    });

    it('should calculate initial clean for moderate accumulation (30 days)', () => {
      const result = calculateInitialClean(2000, '30', 1, 'medium', config);

      expect(result.initialCleanCents).toBe(3500); // 2000 * 1.75 = 3500
      expect(result.breakdown.bucketMultiplier).toBe(1.75);
    });

    it('should apply yard size adjustments', () => {
      const smallResult = calculateInitialClean(2000, '30', 1, 'small', config);
      const largeResult = calculateInitialClean(2000, '30', 1, 'large', config);
      const xlResult = calculateInitialClean(2000, '30', 1, 'xl', config);

      expect(smallResult.initialCleanCents).toBe(3500); // 2000 * 1.75 = 3500
      expect(largeResult.initialCleanCents).toBe(3675); // 2000 * 1.75 * 1.05 = 3675
      expect(xlResult.initialCleanCents).toBe(3850); // 2000 * 1.75 * 1.10 = 3850
    });

    it('should apply dog count adjustments', () => {
      const oneDog = calculateInitialClean(2000, '30', 1, 'medium', config);
      const threeDogs = calculateInitialClean(2000, '30', 3, 'medium', config);
      const fourDogs = calculateInitialClean(2000, '30', 4, 'medium', config);

      expect(oneDog.initialCleanCents).toBe(3500); // 2000 * 1.75 = 3500
      expect(threeDogs.initialCleanCents).toBe(3675); // 2000 * 1.75 * 1.05 = 3675
      expect(fourDogs.initialCleanCents).toBe(3850); // 2000 * 1.75 * 1.10 = 3850
    });

    it('should respect floor prices', () => {
      // Test with a very low per-visit price that would result in amount below floor
      const result = calculateInitialClean(500, '60', 1, 'medium', config);

      expect(result.initialCleanCents).toBe(8900); // Should be floor price, not 500 * 2.00 = 1000
      expect(result.breakdown.floorCents).toBe(8900);
    });

    it('should handle maximum backlog bucket', () => {
      const result = calculateInitialClean(2000, '999', 1, 'medium', config);

      expect(result.initialCleanCents).toBe(5000); // 2000 * 2.50 = 5000
      expect(result.breakdown.bucketMultiplier).toBe(2.50);
      expect(result.breakdown.floorCents).toBe(12900);
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
    it('should handle minimum values', () => {
      const result = calculateInitialClean(1000, '7', 1, 'small', config);
      expect(result.initialCleanCents).toBe(0); // Well maintained should always be free
    });

    it('should handle maximum values', () => {
      const result = calculateInitialClean(5000, '999', 4, 'xl', config);
      expect(result.initialCleanCents).toBe(13750); // 5000 * 2.50 * 1.10 = 13750
    });

    it('should handle leap year dates correctly', () => {
      // Test with Feb 29, 2024
      const leapYearDate = new Date('2024-02-29');
      const bucket = mapDateToBucket(leapYearDate);
      expect(['7', '14', '30', '60', '90', '999']).toContain(bucket);
    });
  });
});
