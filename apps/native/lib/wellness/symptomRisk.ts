export type SymptomRiskLevel = 'watch' | 'monitor' | 'vet_now';

const SEVERE_SYMPTOMS = new Set([
  'VOMITING',
  'LETHARGY',
  'APPETITE_LOSS',
  'THIRST_DECREASE',
  'WEIGHT_LOSS',
]);

const MODERATE_SYMPTOMS = new Set([
  'THIRST_INCREASE',
  'APPETITE_INCREASE',
  'ACCIDENTS',
  'BEHAVIOR_CHANGE',
  'COUGHING',
  'SNEEZING',
  'ITCHING',
  'SKIN_IRRITATION',
  'WEIGHT_GAIN',
  'OTHER',
]);

export function assessSymptomRisk(symptoms: string[] | null | undefined) {
  const list = (symptoms ?? []).filter(Boolean);
  let score = 0;
  let severeCount = 0;

  list.forEach((symptom) => {
    if (SEVERE_SYMPTOMS.has(symptom)) {
      score += 3;
      severeCount += 1;
      return;
    }
    if (MODERATE_SYMPTOMS.has(symptom)) {
      score += 1;
      return;
    }
    score += 1;
  });

  const count = list.length;

  if (severeCount >= 2 || (severeCount >= 1 && count >= 3) || score >= 7) {
    return { level: 'vet_now' as const, score, count, severeCount };
  }
  if (severeCount >= 1 || count >= 3 || score >= 4) {
    return { level: 'monitor' as const, score, count, severeCount };
  }
  return { level: 'watch' as const, score, count, severeCount };
}

export function labelForSymptomRisk(level: SymptomRiskLevel) {
  if (level === 'vet_now') return 'Consider vet';
  if (level === 'monitor') return 'Monitor closely';
  return 'Keep monitoring';
}

export function guidanceForSymptomRisk(level: SymptomRiskLevel) {
  if (level === 'vet_now') {
    return 'Multiple symptoms together can be urgent. Consider contacting your vet or an emergency clinic.';
  }
  if (level === 'monitor') {
    return 'Monitor closely today. If symptoms persist or worsen, consider calling your vet.';
  }
  return 'Keep monitoring and note any changes over the next 24 hours.';
}
