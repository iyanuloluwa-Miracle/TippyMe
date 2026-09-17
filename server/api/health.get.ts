import { defineApiHandler } from '../lib/define-api';
import { useDb } from '../db';
import { ApiError } from '../lib/errors';

/**
 * Readiness check: only report healthy when the database can answer a ping.
 */
export default defineApiHandler(async () => {
  try {
    const connection = await useDb();
    await connection.connection.db?.admin().ping();
    if (!connection.connection.db) throw new Error('Database unavailable');
  } catch {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable.');
  }
  return {
    status: 'ok' as const,
    service: 'cheer-web',
    database: 'up' as const,
    timestamp: new Date().toISOString(),
  };
});
