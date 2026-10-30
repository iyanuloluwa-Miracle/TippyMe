import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo, withRequestTrace } from '../server/lib/logger';

describe('production logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correlates nested logs and redacts credentials and personal data', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exposedKey = [
      'sk',
      'live',
      'exampleCredentialThatMustNotAppear',
    ].join('_');

    withRequestTrace(
      {
        requestId: 'req-production-123',
        method: 'POST',
        path: '/api/creators/me/payout/method',
      },
      () => {
        logError(
          'provider.request.failed',
          new Error(`Provider rejected ${exposedKey} for person@example.com`),
          {
            authorization: `Bearer ${exposedKey}`,
            accountNumber: '9016470826',
            providerStatusCode: 403,
          },
        );
      },
    );

    const line = String(output.mock.calls[0]?.[0]);
    expect(line).toContain('req-production-123');
    expect(line).toContain('provider.request.failed');
    expect(line).toContain('providerStatusCode');
    expect(line).toContain('[REDACTED]');
    expect(line).not.toContain(exposedKey);
    expect(line).not.toContain('person@example.com');
    expect(line).not.toContain('9016470826');
  });

  it('preserves trusted record metadata and async request context', async () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await withRequestTrace(
      {
        requestId: 'req-async-context',
        method: 'GET',
        path: '/api/status',
      },
      async () => {
        await Promise.resolve();
        logInfo('api.request.completed', {
          event: 'forged.event',
          level: 'error',
          service: 'untrusted',
          requestId: 'forged-request',
          otp: '123456',
          requestBody: { marker: 'body-must-not-be-logged' },
          providerDetail: 'One-time code: 654321',
        });
      },
    );

    const line = String(output.mock.calls[0]?.[0]);
    expect(line).toContain('"event":"api.request.completed"');
    expect(line).toContain('"level":"info"');
    expect(line).toContain('"service":"cheer-web"');
    expect(line).toContain('"requestId":"req-async-context"');
    expect(line).not.toContain('forged');
    expect(line).not.toContain('123456');
    expect(line).not.toContain('body-must-not-be-logged');
    expect(line).not.toContain('654321');
  });
});
