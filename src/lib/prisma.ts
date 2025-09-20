import { getDb } from './database-access';

// Legacy export for backward compatibility
// This will automatically select the appropriate database based on feature flags
export const prisma = getDb();

// Also export the database access utilities for advanced usage
export { getDb, getDbForModel, dbUtils, DB_FEATURE_FLAGS } from './database-access';
