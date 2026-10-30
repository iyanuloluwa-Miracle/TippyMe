import { Resend } from 'resend';
import { ApiError } from '../../lib/errors';
import { getServerEnv } from '../../lib/env';
import { logError, logInfo, logWarn } from '../../lib/logger';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  id: string;
  provider: 'RESEND' | 'DEV_LOG';
}

export interface ResendServiceOptions {
  apiKey?: string | null;
  fromEmail?: string;
  nodeEnv?: string;
}

/**
 * Isolated Resend provider. Auth and other modules must call this —
 * never the Resend SDK directly.
 */
export class ResendService {
  private readonly client: Resend | null;
  private readonly fromEmail: string;
  private readonly nodeEnv: string;

  constructor(options?: ResendServiceOptions) {
    const env = getServerEnv();
    const apiKey = (options?.apiKey ?? env.RESEND_API_KEY)?.trim();
    this.fromEmail =
      options?.fromEmail ??
      env.RESEND_FROM_EMAIL ??
      'TippyMe <noreply@example.com>';
    this.nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? 'development';

    if (apiKey) {
      this.client = new Resend(apiKey);
    } else if (this.nodeEnv === 'production') {
      throw new Error('RESEND_API_KEY is required in production');
    } else {
      this.client = null;
      logWarn('email.provider.not_configured', {
        provider: 'resend',
        transport: 'DEV_LOG',
      });
    }
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.client) {
      if (this.nodeEnv === 'production') {
        throw new ApiError(
          503,
          'SERVICE_UNAVAILABLE',
          'Email delivery is temporarily unavailable',
        );
      }
      // Never include OTP or message body in logs.
      logInfo('email.dev_transport.queued', { provider: 'resend' });
      return {
        id: `dev_${Date.now()}`,
        provider: 'DEV_LOG',
      };
    }

    try {
      const payload: {
        from: string;
        to: string;
        subject: string;
        html: string;
        text?: string;
      } = {
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      };

      if (params.text) {
        payload.text = params.text;
      }

      const { data, error } = await this.client.emails.send(
        payload,
        params.idempotencyKey
          ? { idempotencyKey: params.idempotencyKey }
          : undefined,
      );

      if (error) {
        logError('email.send.failed', error, {
          provider: 'resend',
          providerErrorName: error.name,
          providerErrorMessage: error.message,
        });
        throw new ApiError(
          503,
          'SERVICE_UNAVAILABLE',
          'Unable to send email. Please try again shortly.',
        );
      }

      const id = data?.id;
      if (!id) {
        logError('email.send.missing_message_id', undefined, {
          provider: 'resend',
        });
        throw new ApiError(
          503,
          'SERVICE_UNAVAILABLE',
          'Unable to send email. Please try again shortly.',
        );
      }

      return { id, provider: 'RESEND' };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logError('email.send.failed', err, { provider: 'resend' });
      throw new ApiError(
        503,
        'SERVICE_UNAVAILABLE',
        'Unable to send email. Please try again shortly.',
      );
    }
  }
}
