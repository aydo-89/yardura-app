import type { CustomerSetupPrefill } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

type SetupDetails = {
  setupRequired?: boolean;
  setup?: CustomerSetupPrefill;
};

export function extractCustomerSetup(error: unknown): CustomerSetupPrefill | null {
  if (!(error instanceof ApiError)) return null;
  if (!error.details || typeof error.details !== 'object') return null;
  const details = error.details as SetupDetails;
  if (!details.setupRequired) return null;
  return details.setup ?? null;
}

export function isCustomerSetupRequired(error: unknown): boolean {
  return extractCustomerSetup(error) !== null;
}
