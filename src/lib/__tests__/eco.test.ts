/// <reference types="vitest/globals" />

import { computeEcoStats } from '../eco';

describe('Eco Impact Calculator', () => {
  describe('computeEcoStats', () => {
    test('calculates eco stats from deposit count using default weight', () => {
      const result = computeEcoStats({ totalDeposits: 100 });

      // 100 deposits × 250g = 25,000g = 25kg
      expect(result.deposits).toBe(100);
      expect(result.weight_kg).toBe(25);
      expect(result.wasteDiverted_kg).toBe(25);
      expect(result.methaneAvoided_kgCO2e).toBe(67.5); // 25 × 2.7
      expect(result.compostCreated_kg).toBe(15); // 25 × 0.6
    });

    test('uses provided weight when available', () => {
      const result = computeEcoStats({
        totalDeposits: 100,
        totalWeightGrams: 50000, // 50kg explicitly provided
      });

      expect(result.deposits).toBe(100);
      expect(result.weight_kg).toBe(50);
      expect(result.wasteDiverted_kg).toBe(50);
      expect(result.methaneAvoided_kgCO2e).toBe(135); // 50 × 2.7
      expect(result.compostCreated_kg).toBe(30); // 50 × 0.6
    });

    test('falls back to calculated weight when totalWeightGrams is zero', () => {
      const result = computeEcoStats({
        totalDeposits: 10,
        totalWeightGrams: 0,
      });

      // Should use default calculation: 10 × 250g = 2.5kg
      expect(result.weight_kg).toBe(2.5);
    });

    test('falls back to calculated weight when totalWeightGrams is negative', () => {
      const result = computeEcoStats({
        totalDeposits: 10,
        totalWeightGrams: -1000,
      });

      expect(result.weight_kg).toBe(2.5);
    });

    test('handles zero deposits', () => {
      const result = computeEcoStats({ totalDeposits: 0 });

      expect(result.deposits).toBe(0);
      expect(result.weight_kg).toBe(0);
      expect(result.wasteDiverted_kg).toBe(0);
      expect(result.methaneAvoided_kgCO2e).toBe(0);
      expect(result.compostCreated_kg).toBe(0);
    });

    test('handles negative deposits by treating as zero', () => {
      const result = computeEcoStats({ totalDeposits: -5 });

      expect(result.deposits).toBe(0);
      expect(result.weight_kg).toBe(0);
    });

    test('handles undefined/null deposits gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = computeEcoStats({ totalDeposits: undefined as unknown as number });

      expect(result.deposits).toBe(0);
      expect(result.weight_kg).toBe(0);
    });

    test('rounds values to two decimal places', () => {
      // 7 deposits × 250g = 1750g = 1.75kg
      // methane: 1.75 × 2.7 = 4.725 → should round to 4.73
      // compost: 1.75 × 0.6 = 1.05
      const result = computeEcoStats({ totalDeposits: 7 });

      expect(result.weight_kg).toBe(1.75);
      expect(result.methaneAvoided_kgCO2e).toBe(4.73);
      expect(result.compostCreated_kg).toBe(1.05);
    });

    test('returns all required EcoStats fields', () => {
      const result = computeEcoStats({ totalDeposits: 1 });

      expect(result).toHaveProperty('wasteDiverted_kg');
      expect(result).toHaveProperty('methaneAvoided_kgCO2e');
      expect(result).toHaveProperty('compostCreated_kg');
      expect(result).toHaveProperty('deposits');
      expect(result).toHaveProperty('weight_kg');
    });
  });

  describe('edge cases and real-world scenarios', () => {
    test('calculates yearly impact for average household (2 dogs, daily)', () => {
      // 2 dogs × 365 days = 730 deposits/year
      const result = computeEcoStats({ totalDeposits: 730 });

      expect(result.deposits).toBe(730);
      expect(result.weight_kg).toBe(182.5); // 730 × 0.25kg
      expect(result.methaneAvoided_kgCO2e).toBe(492.75); // Almost half a ton CO2e
      expect(result.compostCreated_kg).toBe(109.5); // ~110kg compost
    });

    test('calculates monthly impact for single dog', () => {
      // 1 dog × 30 days = 30 deposits
      const result = computeEcoStats({ totalDeposits: 30 });

      expect(result.weight_kg).toBe(7.5);
      expect(result.methaneAvoided_kgCO2e).toBe(20.25);
    });

    test('handles large deposit counts (service business scale)', () => {
      // 100 customers × 2 dogs × 4 weeks × 7 days = 5600 deposits
      const result = computeEcoStats({ totalDeposits: 5600 });

      expect(result.deposits).toBe(5600);
      expect(result.weight_kg).toBe(1400); // 1.4 metric tons
      expect(result.methaneAvoided_kgCO2e).toBe(3780); // 3.78 tons CO2e
      expect(result.compostCreated_kg).toBe(840);
    });

    test('actual weight differs from calculated (real sensor data)', () => {
      // Smaller dogs might have less waste
      const result = computeEcoStats({
        totalDeposits: 100,
        totalWeightGrams: 15000, // 150g avg instead of 250g
      });

      expect(result.deposits).toBe(100);
      expect(result.weight_kg).toBe(15);
      expect(result.wasteDiverted_kg).toBe(15);
    });
  });

  describe('calculation constants validation', () => {
    test('methane coefficient is scientifically reasonable', () => {
      // EPA estimates ~2.5-3.0 kg CO2e per kg of organic waste in landfill
      // Our coefficient of 2.7 is within this range
      const result = computeEcoStats({ totalDeposits: 4 });
      const ratio = result.methaneAvoided_kgCO2e / result.weight_kg;
      expect(ratio).toBe(2.7);
    });

    test('compost yield factor is realistic', () => {
      // Composting typically yields 40-60% of input mass
      // Our factor of 0.6 is reasonable for aerobic composting
      const result = computeEcoStats({ totalDeposits: 4 });
      const ratio = result.compostCreated_kg / result.weight_kg;
      expect(ratio).toBe(0.6);
    });

    test('default deposit weight is reasonable for medium-sized dogs', () => {
      // 250g per deposit is reasonable for medium dogs (150-350g range)
      const result = computeEcoStats({ totalDeposits: 4 });
      const gramsPerDeposit = (result.weight_kg * 1000) / result.deposits;
      expect(gramsPerDeposit).toBe(250);
    });
  });
});
