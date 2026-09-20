import { NotificationModel, useDb } from '../../db';
import { insertedId, type LeanDoc } from '../../db/lean';
import type {
  NotificationStatus as NotificationStatusT,
  NotificationType,
} from '../../db/types';
import {
  NotificationProvider,
  NotificationStatus,
  NotificationType as NotificationTypeEnum,
} from '../../db/enums';
import { ResendService } from './resend.service';
import { getServerEnv } from '../../lib/env';
import {
  accountExistsEmail,
  accountVerifiedEmail,
  creatorWelcomeEmail,
  otpEmail,
  securityLoginEmail,
  supporterReceiptEmail,
  supporterReversalEmail,
  tipReceivedEmail,
  tipReversedEmail,
} from './email-templates';

export interface TransactionalSendResult {
  status: 'sent' | 'skipped' | 'failed';
  notificationId?: string;
  providerMessageId?: string;
}

/** Minimal projection used for idempotency decisions. */
type NotificationRef = { id: string; status: NotificationStatusT };

function toRef(doc: LeanDoc | null): NotificationRef | null {
  if (!doc) return null;
  return {
    id: String(doc._id),
    status: doc.status as NotificationStatusT,
  };
}

/**
 * Idempotent transactional emails on top of ResendService.
 * Never creates a second Resend client.
 *
 * Financial state and communication state stay separate: tip payment
 * success must not be reversed when email delivery fails.
 */
export class TransactionalNotificationsService {
  constructor(private readonly resend = new ResendService()) {}

  /**
   * Core send with Notification-row idempotency.
   * - SENT / DELIVERED → skip (no duplicate email)
   * - FAILED → safe retry
   * - missing → send and persist
   * - critical=true → rethrow after recording FAILED (OTP)
   * - critical=false → swallow after FAILED (tips / account / security)
   * - retryOnce → one immediate retry after first Resend failure
   */
  async send(params: {
    type: NotificationType;
    to: string;
    userId?: string | null;
    subject: string;
    html: string;
    text?: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    critical?: boolean;
    retryOnce?: boolean;
    /** Prefer this row when retrying a known FAILED notification. */
    existingId?: string;
  }): Promise<TransactionalSendResult> {
    await useDb();
    const metadata = {
      ...(params.metadata ?? {}),
      idempotencyKey: params.idempotencyKey,
    };

    let existing = params.existingId
      ? toRef(
          await NotificationModel.findOne({ _id: params.existingId })
            .select('_id status')
            .lean<LeanDoc | null>(),
        )
      : await this.findByIdempotencyKey(params.idempotencyKey);

    if (!existing) {
      existing = await this.findByIdempotencyKey(params.idempotencyKey);
    }

    if (existing?.status === NotificationStatus.SENT || existing?.status === NotificationStatus.DELIVERED) {
      return { status: 'skipped', notificationId: existing.id };
    }

    const attempt = async (): Promise<TransactionalSendResult> => {
      const result = await this.resend.sendEmail({
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        idempotencyKey: params.idempotencyKey,
      });

      const provider =
        result.provider === 'RESEND'
          ? NotificationProvider.RESEND
          : NotificationProvider.DEV_LOG;

      if (existing) {
        await NotificationModel.updateOne(
          { _id: existing.id },
          {
            $set: {
              status: NotificationStatus.SENT,
              provider,
              providerMessageId: result.id,
              metadata,
              updatedAt: new Date(),
            },
          },
        );
        return {
          status: 'sent',
          notificationId: existing.id,
          providerMessageId: result.id,
        };
      }

      const [created] = await NotificationModel.create([
        {
          userId: params.userId ?? null,
          email: params.to,
          type: params.type,
          provider,
          providerMessageId: result.id,
          status: NotificationStatus.SENT,
          metadata,
        },
      ]);
      return {
        status: 'sent',
        notificationId: insertedId(created),
        providerMessageId: result.id,
      };
    };

    try {
      return await attempt();
    } catch (firstErr) {
      console.error(
        `Resend failed key=${params.idempotencyKey}: ${firstErr instanceof Error ? firstErr.message : 'unknown'}`,
      );

      if (params.retryOnce) {
        try {
          return await attempt();
        } catch (retryErr) {
          console.error(
            `Resend retry failed key=${params.idempotencyKey}: ${retryErr instanceof Error ? retryErr.message : 'unknown'}`,
          );
          const failed = await this.persistFailed({
            existingId: existing?.id,
            to: params.to,
            userId: params.userId,
            type: params.type,
            metadata,
            error: retryErr,
          });
          if (params.critical) throw firstErr;
          return { status: 'failed', notificationId: failed.id };
        }
      }

      const failed = await this.persistFailed({
        existingId: existing?.id,
        to: params.to,
        userId: params.userId,
        type: params.type,
        metadata,
        error: firstErr,
      });
      if (params.critical) throw firstErr;
      return { status: 'failed', notificationId: failed.id };
    }
  }

  /** Tip paid — only call after authoritative PAID transition. */
  async notifyTipReceived(params: {
    tipId: string;
    userId: string;
    email: string;
    amount: string;
    currency: string;
    isAnonymous: boolean;
    supporterName: string | null;
  }): Promise<TransactionalSendResult> {
    await useDb();
    // Backward-compatible dedupe on tipId (Phase 7/8 rows may lack idempotencyKey).
    const byTip = toRef(
      await NotificationModel.findOne({
        type: NotificationTypeEnum.EMAIL_TIP_RECEIVED,
        'metadata.tipId': params.tipId,
      })
        .select('_id status')
        .lean<LeanDoc | null>(),
    );
    if (byTip?.status === NotificationStatus.SENT) {
      return { status: 'skipped', notificationId: byTip.id };
    }

    const copy = tipReceivedEmail({
      amount: params.amount,
      currency: params.currency,
      isAnonymous: params.isAnonymous,
      supporterName: params.supporterName,
    });
    return this.send({
      type: NotificationTypeEnum.EMAIL_TIP_RECEIVED,
      to: params.email,
      userId: params.userId,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `tip_paid_${params.tipId}`,
      metadata: { tipId: params.tipId },
      critical: false,
      retryOnce: true,
      existingId:
        byTip?.status === NotificationStatus.FAILED ? byTip.id : undefined,
    });
  }

  /** Refund or dispute — status already changed. Payouts are not clawed back here. */
  async notifyTipReversed(params: {
    tipId: string;
    userId: string;
    email: string;
    amount: string;
    currency: string;
    status: 'REFUNDED' | 'DISPUTED';
  }): Promise<TransactionalSendResult> {
    const copy = tipReversedEmail({
      amount: params.amount,
      currency: params.currency,
      status: params.status,
    });
    return this.send({
      type: NotificationTypeEnum.EMAIL_GENERIC,
      to: params.email,
      userId: params.userId,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `tip_reversed_${params.tipId}_${params.status}`,
      metadata: { tipId: params.tipId, status: params.status, payoutReversal: 'MANUAL_REQUIRED' },
      critical: false,
      retryOnce: true,
    });
  }

  async notifySupporterReceipt(params: {
    tipId: string;
    email: string;
    amount: string;
    currency: string;
    creatorName: string;
    thankYouMessage?: string | null;
  }): Promise<TransactionalSendResult> {
    const copy = supporterReceiptEmail({
      amount: params.amount,
      currency: params.currency,
      creatorName: params.creatorName,
      thankYouMessage: params.thankYouMessage,
    });
    return this.send({
      type: NotificationTypeEnum.EMAIL_TIP_RECEIPT,
      to: params.email,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `tip_receipt_${params.tipId}`,
      metadata: { tipId: params.tipId, audience: 'supporter' },
      critical: false,
      retryOnce: true,
    });
  }

  async notifySupporterReversed(params: {
    tipId: string;
    email: string;
    amount: string;
    currency: string;
    creatorName: string;
    status: 'REFUNDED' | 'DISPUTED';
  }): Promise<TransactionalSendResult> {
    const copy = supporterReversalEmail(params);
    return this.send({
      type: NotificationTypeEnum.EMAIL_TIP_REVERSED,
      to: params.email,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `tip_supporter_reversed_${params.tipId}_${params.status}`,
      metadata: { tipId: params.tipId, status: params.status, audience: 'supporter' },
      critical: false,
      retryOnce: true,
    });
  }

  async notifyAccountExists(params: {
    email: string;
  }): Promise<TransactionalSendResult> {
    const copy = accountExistsEmail();
    return this.send({
      type: NotificationTypeEnum.EMAIL_ACCOUNT_EXISTS,
      to: params.email,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `account_exists_${params.email}_${new Date().toISOString().slice(0, 13)}`,
      metadata: { kind: 'account_exists' },
      critical: false,
      retryOnce: false,
    });
  }

  async notifyAccountVerified(params: {
    userId: string;
    email: string;
  }): Promise<TransactionalSendResult> {
    const copy = accountVerifiedEmail();
    return this.send({
      type: NotificationTypeEnum.EMAIL_ACCOUNT_VERIFIED,
      to: params.email,
      userId: params.userId,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `account_verified_${params.userId}`,
      metadata: { kind: 'account_verified' },
      critical: false,
      retryOnce: true,
    });
  }

  /** Called only after a new creator profile has been committed. */
  async notifyCreatorWelcome(params: {
    userId: string;
    email: string;
    creatorId: string;
    displayName: string;
    username: string;
  }): Promise<TransactionalSendResult> {
    const copy = creatorWelcomeEmail({
      displayName: params.displayName,
      username: params.username,
      appUrl: getServerEnv().APP_URL,
    });
    return this.send({
      type: NotificationTypeEnum.EMAIL_CREATOR_WELCOME,
      to: params.email,
      userId: params.userId,
      ...copy,
      idempotencyKey: `creator_welcome_${params.userId}`,
      metadata: { kind: 'creator_welcome', creatorId: params.creatorId },
      critical: false,
      retryOnce: true,
    });
  }

  async notifySecurityLogin(params: {
    userId: string;
    email: string;
    method: string;
    auditLogId?: string;
  }): Promise<TransactionalSendResult> {
    const atIso = new Date().toISOString();
    const copy = securityLoginEmail({ method: params.method, atIso });
    const key =
      params.auditLogId != null
        ? `security_login_${params.auditLogId}`
        : `security_login_${params.userId}_${atIso.slice(0, 13)}`;
    return this.send({
      type: NotificationTypeEnum.EMAIL_SECURITY_ALERT,
      to: params.email,
      userId: params.userId,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: key,
      metadata: {
        kind: 'security_login',
        method: params.method,
        auditLogId: params.auditLogId,
      },
      critical: false,
      retryOnce: false,
    });
  }

  /** OTP — critical path; failure surfaces to the caller. */
  async notifyOtp(params: {
    userId: string;
    email: string;
    code: string;
    challengeId: string;
    purpose: string;
  }): Promise<TransactionalSendResult> {
    const copy = otpEmail(params.code, params.purpose);
    return this.send({
      type: NotificationTypeEnum.EMAIL_OTP,
      to: params.email,
      userId: params.userId,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `otp-${params.challengeId}`,
      metadata: {
        purpose: params.purpose,
        challengeId: params.challengeId,
      },
      critical: true,
      retryOnce: false,
    });
  }

  private async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<NotificationRef | null> {
    return toRef(
      await NotificationModel.findOne({
        'metadata.idempotencyKey': idempotencyKey,
      })
        .select('_id status')
        .lean<LeanDoc | null>(),
    );
  }

  private async persistFailed(params: {
    existingId?: string;
    to: string;
    userId?: string | null;
    type: NotificationType;
    metadata: Record<string, unknown>;
    error: unknown;
  }): Promise<{ id: string }> {
    const failureMeta = {
      ...params.metadata,
      lastError:
        params.error instanceof Error ? params.error.message : 'unknown',
      failedAt: new Date().toISOString(),
    };

    if (params.existingId) {
      await NotificationModel.updateOne(
        { _id: params.existingId },
        {
          $set: {
            status: NotificationStatus.FAILED,
            metadata: failureMeta,
            updatedAt: new Date(),
          },
        },
      );
      return { id: params.existingId };
    }

    const [created] = await NotificationModel.create([
      {
        userId: params.userId ?? null,
        email: params.to,
        type: params.type,
        provider: NotificationProvider.RESEND,
        status: NotificationStatus.FAILED,
        metadata: failureMeta,
      },
    ]);
    return { id: insertedId(created) };
  }
}
