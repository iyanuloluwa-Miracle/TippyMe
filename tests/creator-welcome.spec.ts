import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbSession } from '../server/db';
import type { LeanDoc } from '../server/db/lean';
import { CreatorsService } from '../server/services/creators/creators.service';
import { creatorWelcomeEmail } from '../server/services/notifications/email-templates';
import { ResendService } from '../server/services/notifications/resend.service';
import { TransactionalNotificationsService } from '../server/services/notifications/transactional-notifications.service';

const db = vi.hoisted(() => ({
  findProfile: vi.fn(),
  createProfile: vi.fn(),
  findUser: vi.fn(),
  findLinks: vi.fn(),
  insertLinks: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
  findNotification: vi.fn(),
  createNotification: vi.fn(),
  updateNotification: vi.fn(),
}));

vi.mock('../server/db', async (importOriginal) => ({
  ...await importOriginal<typeof import('../server/db')>(),
  useDb: vi.fn().mockResolvedValue(undefined),
  withTransaction: db.transaction,
  CreatorProfileModel: { findOne: db.findProfile, create: db.createProfile },
  UserModel: { findOne: db.findUser },
  SocialLinkModel: { find: db.findLinks, insertMany: db.insertLinks },
  AuditLogModel: { create: db.createAudit },
  NotificationModel: {
    findOne: db.findNotification,
    create: db.createNotification,
    updateOne: db.updateNotification,
  },
}));

vi.mock('../server/lib/env', () => ({
  getServerEnv: () => ({
    APP_URL: 'https://tippyme.example/',
    NODE_ENV: 'test',
    RESEND_API_KEY: 're_test_not_a_real_key',
    RESEND_FROM_EMAIL: 'TippyMe <noreply@tippyme.example>',
  }),
}));

function query(value: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
}

const onboarding = {
  username: 'ada_builder',
  displayName: 'Ada Builder',
  avatarUrl: '/api/avatars/ada?size=128',
  socialLinks: [{ platform: 'WEBSITE' as const, url: 'https://ada.example' }],
};
const welcome = {
  userId: 'user_1',
  email: 'ada@example.com',
  creatorId: 'creator_1',
  displayName: onboarding.displayName,
  username: onboarding.username,
};

describe('creator welcome email content', () => {
  it('includes the creator name, public page and dashboard in HTML and plain text', () => {
    const copy = creatorWelcomeEmail({ ...onboarding, appUrl: 'https://tippyme.example/' });
    expect(copy.subject).toBe('Welcome to TippyMe! Your page is ready');
    for (const body of [copy.html, copy.text]) {
      expect(body).toContain('Hi Ada Builder,');
      expect(body).toContain('https://tippyme.example/ada_builder');
      expect(body).toContain('https://tippyme.example/dashboard');
      expect(body).toContain('The TippyMe Team');
    }
    expect(copy.html).toContain('href="https://tippyme.example/dashboard"');
    expect(copy.html).not.toContain('localhost');
  });

  it('escapes creator-supplied markup while preserving their name in plain text', () => {
    const name = '<img src=x onerror="alert(1)"> & Ada';
    const copy = creatorWelcomeEmail({
      ...onboarding, displayName: name, appUrl: 'https://tippyme.example',
    });
    expect(copy.html).not.toContain('<img');
    expect(copy.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Ada');
    expect(copy.text).toContain(`Hi ${name},`);
  });

  it.each(['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com'])(
    'rejects unsafe email link configuration: %s', (appUrl) => {
      expect(() => creatorWelcomeEmail({ ...onboarding, appUrl })).toThrow('HTTP(S)');
    },
  );
});

describe('onboarding welcome delivery', () => {
  let savedProfile: LeanDoc | null;
  let notification: LeanDoc | null;
  let committed: boolean;

  beforeEach(() => {
    vi.resetAllMocks();
    savedProfile = null;
    notification = null;
    committed = false;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(ResendService.prototype, 'sendEmail').mockResolvedValue({
      id: 'email_1', provider: 'RESEND',
    });
    db.findProfile.mockImplementation(() => query(savedProfile));
    db.findLinks.mockImplementation(() => query([]));
    db.findUser.mockImplementation(() => query({ email: welcome.email }));
    db.createProfile.mockImplementation(async ([data]: LeanDoc[]) => {
      savedProfile = {
        ...data,
        _id: 'creator_1',
        isActive: true,
        createdAt: new Date('2026-09-19T12:00:00Z'),
        updatedAt: new Date('2026-09-19T12:00:00Z'),
      };
      return [savedProfile];
    });
    db.transaction.mockImplementation(async (work: (session: DbSession) => Promise<unknown>) => {
      const result = await work({} as DbSession);
      committed = true;
      return result;
    });
    db.findNotification.mockImplementation(() => query(notification));
    db.createNotification.mockImplementation(async ([data]: LeanDoc[]) => {
      notification = { ...data, _id: 'notification_1' };
      return [notification];
    });
    db.updateNotification.mockImplementation(async (_filter: unknown, update: { $set: LeanDoc }) => {
      notification = { ...notification, ...update.$set };
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('sends to the account email only after the profile and social links are committed', async () => {
    vi.mocked(ResendService.prototype.sendEmail).mockImplementation(async (mail) => {
      expect(committed).toBe(true);
      expect(db.insertLinks).toHaveBeenCalledOnce();
      expect(mail).toMatchObject({
        to: welcome.email,
        idempotencyKey: 'creator_welcome_user_1',
      });
      expect(mail.html).toContain('Hi Ada Builder,');
      return { id: 'email_1', provider: 'RESEND' };
    });
    const profile = await new CreatorsService().create('user_1', onboarding);
    expect(profile.publicPath).toBe('/ada_builder');
    expect(ResendService.prototype.sendEmail).toHaveBeenCalledOnce();
    expect(notification).toMatchObject({
      type: 'EMAIL_CREATOR_WELCOME',
      status: 'SENT',
      userId: 'user_1',
      providerMessageId: 'email_1',
      metadata: { creatorId: 'creator_1', idempotencyKey: 'creator_welcome_user_1' },
    });
  });

  it('does not send again when onboarding is submitted twice', async () => {
    const creators = new CreatorsService();
    await creators.create('user_1', onboarding);
    await expect(creators.create('user_1', onboarding)).rejects.toMatchObject({
      statusCode: 409, error: 'PROFILE_EXISTS',
    });
    expect(ResendService.prototype.sendEmail).toHaveBeenCalledOnce();
  });

  it('does not send if the profile transaction fails to commit', async () => {
    db.transaction.mockImplementationOnce(async (work: (session: DbSession) => Promise<unknown>) => {
      await work({} as DbSession);
      throw new Error('Commit failed');
    });
    await expect(new CreatorsService().create('user_1', onboarding)).rejects.toThrow('Commit failed');
    expect(ResendService.prototype.sendEmail).not.toHaveBeenCalled();
  });

  it('retries once with the same payload when delivery fails temporarily', async () => {
    vi.mocked(ResendService.prototype.sendEmail).mockRejectedValueOnce(new Error('Temporary outage'));
    await new CreatorsService().create('user_1', onboarding);
    const calls = vi.mocked(ResendService.prototype.sendEmail).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(notification).toMatchObject({ status: 'SENT' });
  });

  it('keeps onboarding successful and records failure if both delivery attempts fail', async () => {
    vi.mocked(ResendService.prototype.sendEmail).mockRejectedValue(new Error('Provider unavailable'));
    await expect(new CreatorsService().create('user_1', onboarding)).resolves.toMatchObject({
      id: 'creator_1', username: 'ada_builder',
    });
    expect(ResendService.prototype.sendEmail).toHaveBeenCalledTimes(2);
    expect(notification).toMatchObject({
      status: 'FAILED', metadata: { lastError: 'Provider unavailable' },
    });
  });

  it('keeps onboarding successful if the notification database lookup fails', async () => {
    db.findNotification.mockImplementation(() => { throw new Error('Notification storage unavailable'); });
    await expect(new CreatorsService().create('user_1', onboarding)).resolves.toMatchObject({
      id: 'creator_1',
    });
    expect(ResendService.prototype.sendEmail).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Creator welcome email failed'));
  });

  it.each(['SENT', 'DELIVERED'])('skips an already %s welcome notification', async (status) => {
    notification = { _id: 'notification_1', status };
    const result = await new TransactionalNotificationsService().notifyCreatorWelcome(welcome);
    expect(result.status).toBe('skipped');
    expect(ResendService.prototype.sendEmail).not.toHaveBeenCalled();
  });

  it('allows retrying a failed welcome without creating another notification record', async () => {
    notification = { _id: 'notification_1', status: 'FAILED' };
    const result = await new TransactionalNotificationsService().notifyCreatorWelcome(welcome);
    expect(result).toMatchObject({ status: 'sent', notificationId: 'notification_1' });
    expect(db.createNotification).not.toHaveBeenCalled();
    expect(notification).toMatchObject({ status: 'SENT' });
  });
});
