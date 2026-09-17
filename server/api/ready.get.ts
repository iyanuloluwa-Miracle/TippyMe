import { defineApiHandler } from '../lib/define-api';
import { useDb } from '../db';
import { ApiError } from '../lib/errors';

/** Readiness: ping the app database, not the admin database. */
export default defineApiHandler(async () => {
  try {
    const connection = await useDb();
    const db = connection.connection.db;
    if (!db) throw new Error('Database unavailable');
    await db.command({ ping: 1 });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable.');
  }
  return {
    status: 'ok' as const,
    service: 'cheer-web',
    database: 'up' as const,
    timestamp: new Date().toISOString(),
  };
});
