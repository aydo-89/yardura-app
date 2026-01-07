import { useEffect } from 'react';
import { router } from 'expo-router';

import type { VisitStep } from '@/lib/scooper/visitFlow';
import { useVisitFlow } from '@/lib/scooper/visitFlow';

export function useStepGuard(stepId: VisitStep) {
  const { canAccessStep, nextRequiredStep, visitId, isScheduledToday, loading, visit } = useVisitFlow();

  useEffect(() => {
    if (loading || !visit) return;
    if (!isScheduledToday) {
      router.replace(`/(app)/(scooper)/visits/${visitId}`);
      return;
    }
    if (canAccessStep(stepId)) return;
    if (!nextRequiredStep) {
      router.replace(`/(app)/(scooper)/visits/${visitId}`);
      return;
    }
    router.replace(`/(app)/(scooper)/visits/${visitId}/${nextRequiredStep}`);
  }, [canAccessStep, nextRequiredStep, visitId, stepId, isScheduledToday, loading, visit]);
}
