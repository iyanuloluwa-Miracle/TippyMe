import { AsyncLocalStorage } from 'node:async_hooks';
import { getServerEnv } from './env';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

export interface RequestTraceContext {
  requestId: string;
  method: string;
  path: string;
}

const requestTrace = new AsyncLocalStorage<RequestTraceContext>();
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY =
  /(?:authorization|cookie|password|secret|token|api[_-]?key|account[_-]?number|email|requestbody|responsebody|body|payload|otp|one[_-]?time(?:[_-]?(?:password|code))?|verification[_-]?code|card(?:[_-]?(?:number|cvc|cvv|expiry))?|cvc|cvv|iban|routing[_-]?number)/i;

/** Run work with a trace context that is inherited by nested async calls. */
export function withRequestTrace<T>(
  context: RequestTraceContext,
  operation: () => T,
): T {
  return requestTrace.run(context, operation);
}

export function getRequestTrace(): RequestTraceContext | undefined {
  return requestTrace.getStore();
}

/** Safe reference for correlating records without logging a complete database/provider id. */
export function maskLogReference(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return '[present]';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function logInfo(event: string, fields: LogFields = {}): void {
  emit('info', event, fields);
}

export function logWarn(event: string, fields: LogFields = {}): void {
  emit('warn', event, fields);
}

export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {},
): void {
  emit('error', event, {
    ...fields,
    ...(error === undefined ? {} : { exception: serializeError(error) }),
  });
}

export function sanitizeLogText(value: string, maxLength = 1_000): string {
  return sanitizeText(value, maxLength);
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  try {
    const trace = requestTrace.getStore();
    const safeEvent = sanitizeText(event, 200);
    const safeRequestId = trace
      ? sanitizeText(trace.requestId, 128)
      : undefined;
    const record = {
      ...sanitizeObject(fields),
      timestamp: new Date().toISOString(),
      level,
      service: 'cheer-web',
      event: safeEvent,
      ...(trace
        ? {
            requestId: safeRequestId,
            method: sanitizeText(trace.method, 16),
            path: sanitizeText(trace.path, 500),
          }
        : {}),
    };
    const line = JSON.stringify(record);
    const output =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.info;

    if (logFormat() === 'json') {
      output(line);
      return;
    }

    const traceSuffix = safeRequestId ? ` requestId=${safeRequestId}` : '';
    output(`${record.timestamp} ${level.toUpperCase()} ${safeEvent}${traceSuffix} ${line}`);
  } catch {
    process.stderr.write('[logger] failed to write a log record\n');
  }
}

function logFormat(): 'json' | 'text' {
  try {
    const format = getServerEnv().LOG_FORMAT?.toLowerCase();
    if (format === 'json' || format === 'text') return format;
  } catch {
    // Environment validation errors must still be loggable.
  }
  return process.env.NODE_ENV === 'production' ? 'json' : 'text';
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { name: 'UnknownError', message: sanitizeText(String(error), 500) };
  }
  return {
    name: error.name,
    message: sanitizeText(error.message, 500),
    ...(error.stack ? { stack: sanitizeText(error.stack, 3_000) } : {}),
  };
}

function sanitizeObject(value: LogFields): LogFields {
  const result: LogFields = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(item, 0);
  }
  return result;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') return sanitizeText(value, 1_000);
  if (value instanceof Error) return serializeError(value);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const output: LogFields = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key)
        ? REDACTED
        : sanitizeValue(item, depth + 1);
    }
    return output;
  }
  return sanitizeText(String(value), 500);
}

function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, '$1[REDACTED]@')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(?:sk_(?:live|test)|whsec|pk_(?:live|test))_[A-Za-z0-9_-]+\b/g,
      REDACTED,
    )
    .replace(
      /([?&](?:api[_-]?key|token|secret|password|signature)=)[^&\s]+/gi,
      '$1[REDACTED]',
    )
    .replace(
      /\b(otp|one[- ]time(?: password| code)?|verification code)\s*([:=])\s*\d{4,8}\b/gi,
      '$1$2[REDACTED]',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b\d{8,19}\b/g, '[REDACTED_NUMBER]')
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, maxLength);
}
