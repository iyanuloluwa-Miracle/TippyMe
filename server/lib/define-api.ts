import type { EventHandler, EventHandlerRequest, H3Event } from 'h3';
import {
  defineEventHandler,
  getHeader,
  getResponseStatus,
  setHeader,
  setResponseStatus,
} from 'h3';
import { ApiError } from './errors';
import { reportServerError } from './error-monitor';
import { logError, logInfo, logWarn, withRequestTrace } from './logger';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Wrap Nitro handlers so ApiError becomes Nest-compatible JSON
 * ({ statusCode, message, error, retryAfterSeconds? }) with correct status.
 */
export function defineApiHandler<T extends EventHandlerRequest, R>(
  handler: (event: H3Event<T>) => R | Promise<R>,
): EventHandler<T, R | Record<string, unknown>> {
  return defineEventHandler(async (event) => {
    const incomingRequestId = getHeader(event, 'x-request-id');
    const requestId =
      incomingRequestId && SAFE_REQUEST_ID.test(incomingRequestId)
        ? incomingRequestId
        : crypto.randomUUID();
    const method = event.method.toUpperCase();
    const path = event.path.split('?')[0] || '/';
    const startedAt = performance.now();
    setHeader(event, 'X-Request-Id', requestId);

    return withRequestTrace({ requestId, method, path }, async () => {
      let caughtError: unknown;
      let errorCode: string | undefined;
      try {
        return await handler(event);
      } catch (err) {
        caughtError = err;
        if (err instanceof ApiError) {
          errorCode = err.error;
          setResponseStatus(event, err.statusCode);
          if (err.retryAfterSeconds != null) {
            setHeader(event, 'Retry-After', err.retryAfterSeconds);
          }
          return {
            statusCode: err.statusCode,
            message: err.message,
            error: err.error,
            requestId,
            ...(err.retryAfterSeconds != null
              ? { retryAfterSeconds: err.retryAfterSeconds }
              : {}),
          };
        }
        setResponseStatus(event, 500);
        reportServerError(err, {
          path,
          method,
          requestId,
        });
        throw err;
      } finally {
        const statusCode = getResponseStatus(event);
        const fields = {
          statusCode,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          ...(errorCode ? { errorCode } : {}),
        };
        if (statusCode >= 500) {
          logError('api.request.completed', caughtError, fields);
        } else if (statusCode >= 400) {
          logWarn('api.request.completed', fields);
        } else {
          logInfo('api.request.completed', fields);
        }
      }
    });
  }) as EventHandler<T, R | Record<string, unknown>>;
}
