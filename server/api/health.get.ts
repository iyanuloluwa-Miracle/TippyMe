import { defineApiHandler } from '../lib/define-api';

/**
 * Process liveness only. Docker uses this path, so a database blip must not
 * make the container look dead and get restarted.
 */
export default defineApiHandler(() => {
  return {
    status: 'ok' as const,
    service: 'cheer-web',
    database: 'skipped' as const,
    timestamp: new Date().toISOString(),
  };
});
