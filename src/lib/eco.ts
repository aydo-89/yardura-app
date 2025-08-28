// Eco impact calculator
// Constants can be tuned from research later

export type EcoStats = {
  wasteDiverted_kg: number
  methaneAvoided_kgCO2e: number
  compostCreated_kg: number
  deposits: number
  weight_kg: number
}

const GRAMS_PER_DEPOSIT = 250 // avg mass per deposit, adjustable
const KGCO2E_PER_KG_WASTE_LANDFILLED = 2.7 // placeholder coefficient
const COMPOST_YIELD_FACTOR = 0.6 // fraction of waste mass converted to compost

export function computeEcoStats({ totalDeposits, totalWeightGrams }: { totalDeposits: number; totalWeightGrams?: number }): EcoStats {
  const deposits = Math.max(0, totalDeposits || 0)
  const weight_g = totalWeightGrams && totalWeightGrams > 0 ? totalWeightGrams : deposits * GRAMS_PER_DEPOSIT
  const weight_kg = weight_g / 1000

  const wasteDiverted_kg = weight_kg
  const methaneAvoided_kgCO2e = weight_kg * KGCO2E_PER_KG_WASTE_LANDFILLED
  const compostCreated_kg = weight_kg * COMPOST_YIELD_FACTOR

  return {
    wasteDiverted_kg: round(wasteDiverted_kg),
    methaneAvoided_kgCO2e: round(methaneAvoided_kgCO2e),
    compostCreated_kg: round(compostCreated_kg),
    deposits,
    weight_kg: round(weight_kg),
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}


