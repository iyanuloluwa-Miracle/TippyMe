import { ApiError } from '../../lib/errors';
import { getServerEnv } from '../../lib/env';
import {
  AuditLogModel,
  CreatorProfileModel,
  UserModel,
  toPlain,
  useDb,
} from '../../db';
import type { LeanDoc } from '../../db/lean';
import type { CreatorProfile, User } from '../../db/types';
import { AuditAction } from '../../db/enums';
import {
  BachsProviderError,
  bachsPublicMessage,
} from '../payments/bachs/bachs.errors';
import { BachsHttpClient } from '../payments/bachs/bachs-http.client';
import { accountCanReceiveDestinationCharges } from './payout-readiness';
import {
  buildSettlementStatus,
  type CreatorSettlementStatusDto,
} from './settlement.types';

const PAYOUTS_CACHE_MS = 15 * 60 * 1000;

export interface ConnectOnboardResult {
  settlement: CreatorSettlementStatusDto;
  /** Hosted Bachs onboarding URL — null when already linked or stub mode. */
  onboardingUrl: string | null;
  /** True when TippyMe used a local stub Connect id (no live Bachs Connect). */
  stub: boolean;
}

/**
 * Bachs Connect onboarding + Friday payout schedule for creators.
 * Never invents a TippyMe wallet — only stores `bachsAccountId` and settlement flags.
 */
export class ConnectService {
  constructor(private readonly http = new BachsHttpClient()) {}

  async startOnboarding(userId: string): Promise<ConnectOnboardResult> {
    await useDb();
    const profile = await this.requireProfileWithUser(userId);
    const appUrl = (getServerEnv().APP_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const returnUrl = `${appUrl}/dashboard/connect/return`;
    const refreshUrl = `${appUrl}/dashboard/connect/refresh`;

    // Already linked — mint a fresh hosted link if live Bachs is configured.
    if (profile.bachsAccountId && !profile.bachsAccountId.startsWith('acct_stub_')) {
      const payoutsReady = await this.refreshPayoutReadiness(profile, { force: true });
      if (!this.http.isConfigured) {
        return {
          settlement: this.settlementFor(profile, payoutsReady),
          onboardingUrl: null,
          stub: false,
        };
      }

      try {
        const link = await this.http.createAccountLink(profile.bachsAccountId, {
          type: 'onboarding',
          return_url: returnUrl,
          refresh_url: refreshUrl,
        });
        return {
          settlement: this.settlementFor(profile, payoutsReady),
          onboardingUrl: this.requireHostedOnboardingUrl(link.url),
          stub: false,
        };
      } catch (err) {
        this.throwConnectError(err);
      }
    }

    // No Bachs key → honest local stub for demo / offline hackathon demos.
    if (!this.http.isConfigured) {
      const stubId = `acct_stub_${profile.id}`;
      await CreatorProfileModel.updateOne(
        { _id: profile.id },
        {
          $set: {
            bachsAccountId: stubId,
            bachsPayoutsReady: false,
            bachsPayoutsCheckedAt: new Date(),
            fridayPayoutEnabled: false,
            updatedAt: new Date(),
          },
        },
      );
      await this.audit(userId, profile.id, {
        event: 'connect_stub_linked',
        bachsAccountId: stubId,
      });
      return {
        settlement: buildSettlementStatus({
          bachsAccountId: stubId,
          fridayPayoutEnabled: false,
        }),
        onboardingUrl: null,
        stub: true,
      };
    }

    const payoutCountry = this.payoutCountry(profile);
    try {
      const account = await this.http.createConnectedAccount(
        {
          contact_email: profile.user.email,
          display_name: profile.displayName.slice(0, 120),
          country: payoutCountry,
          entity_type: 'individual',
          configuration: {
            recipient: {
              capabilities: {
                payouts: { requested: true },
                transfers: { requested: true },
              },
            },
          },
          responsibilities: { fees: { collector: 'bachs' } },
          metadata: {
            tippyme_creator_id: profile.id,
            tippyme_username: profile.username,
          },
        },
        `connect_${profile.id}`.slice(0, 255),
      );

      if (!account.id) {
        throw new BachsProviderError(
          'PROVIDER',
          'Incomplete Bachs Connect account response',
        );
      }

      await CreatorProfileModel.updateOne(
        { _id: profile.id },
        {
          $set: {
            bachsAccountId: account.id,
            bachsPayoutsReady: false,
            bachsPayoutsCheckedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );

      await this.audit(userId, profile.id, {
        event: 'connect_account_created',
        bachsAccountId: account.id,
      });

      const link = await this.http.createAccountLink(account.id, {
        type: 'onboarding',
        return_url: returnUrl,
        refresh_url: refreshUrl,
      });

      return {
        settlement: buildSettlementStatus({
          bachsAccountId: account.id,
          fridayPayoutEnabled: profile.fridayPayoutEnabled,
          payoutsReady: false,
        }),
        onboardingUrl: this.requireHostedOnboardingUrl(link.url),
        stub: false,
      };
    } catch (err) {
      this.throwConnectError(err);
    }
  }

  /** Reject missing / non-Bachs URLs so the client never navigates to TippyMe /api. */
  private requireHostedOnboardingUrl(url: string | undefined): string {
    const trimmed = url?.trim() ?? '';
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const onBachs =
        parsed.protocol === 'https:' &&
        (host === 'bachs.io' || host.endsWith('.bachs.io'));
      if (onBachs) return trimmed;
    } catch {
      // fall through
    }
    throw new BachsProviderError(
      'PROVIDER',
      'Bachs Connect did not return a usable hosted onboarding URL',
    );
  }

  private payoutCountry(profile: CreatorProfile): string {
    const country = profile.payoutCountry ?? null;
    if (!country) {
      throw new ApiError(400, 'PAYOUT_COUNTRY_REQUIRED', 'Choose your payout country in profile settings before connecting Bachs.');
    }
    return country;
  }

  /**
   * After hosted return/refresh — optionally enable Friday weekly payouts.
   */
  async enableFridayPayout(userId: string): Promise<CreatorSettlementStatusDto> {
    await useDb();
    const profile = await this.requireProfileWithUser(userId);
    const payoutsReady = await this.refreshPayoutReadiness(profile, { force: true });
    if (!profile.bachsAccountId || profile.bachsAccountId.startsWith('acct_stub_') || !payoutsReady) {
      throw new ApiError(
        400,
        'CONNECT_REQUIRED',
        'Finish Bachs onboarding so payouts are enabled before scheduling Friday payouts.',
      );
    }

    if (
      this.http.isConfigured &&
      !profile.bachsAccountId.startsWith('acct_stub_')
    ) {
      try {
        await this.http.updateBalanceSettings(profile.bachsAccountId, {
          payout_schedule: {
            interval: 'weekly',
            weekly_payout_days: ['friday'],
          },
        });
      } catch (err) {
        console.warn(
          `Friday payout schedule request failed for ${profile.bachsAccountId}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
        this.throwConnectError(err);
      }
    }

    await CreatorProfileModel.updateOne(
      { _id: profile.id },
      { $set: { fridayPayoutEnabled: true, updatedAt: new Date() } },
    );

    await this.audit(userId, profile.id, {
      event: 'friday_payout_enabled',
      bachsAccountId: profile.bachsAccountId,
    });

    return buildSettlementStatus({
      bachsAccountId: profile.bachsAccountId,
      fridayPayoutEnabled: true,
      payoutsReady: true,
    });
  }

  async getSettlement(userId: string): Promise<CreatorSettlementStatusDto> {
    await useDb();
    const profile = await this.requireProfileWithUser(userId);
    const payoutsReady = await this.refreshPayoutReadiness(profile);
    return this.settlementFor(profile, payoutsReady);
  }

  /**
   * Refresh Bachs capability status. A provider outage keeps the last known
   * ready flag so a blip does not look like the creator disconnected.
   */
  async refreshPayoutReadiness(
    profile: CreatorProfile,
    opts?: { force?: boolean },
  ): Promise<boolean> {
    const accountId = profile.bachsAccountId?.trim() || '';
    if (!accountId || accountId.startsWith('acct_stub_')) return false;

    const checkedAt = profile.bachsPayoutsCheckedAt
      ? new Date(profile.bachsPayoutsCheckedAt).getTime()
      : 0;
    const fresh = checkedAt > 0 && Date.now() - checkedAt < PAYOUTS_CACHE_MS;
    if (!opts?.force && fresh) return Boolean(profile.bachsPayoutsReady);
    if (!this.http.isConfigured) return Boolean(profile.bachsPayoutsReady);

    try {
      const account = await this.http.getConnectedAccount(accountId);
      const ready = accountCanReceiveDestinationCharges(account);
      await CreatorProfileModel.updateOne(
        { _id: profile.id },
        {
          $set: {
            bachsPayoutsReady: ready,
            bachsPayoutsCheckedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      return ready;
    } catch (err) {
      console.warn(
        `Bachs payout readiness check failed for ${accountId}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return Boolean(profile.bachsPayoutsReady);
    }
  }

  private settlementFor(
    profile: CreatorProfile,
    payoutsReady: boolean,
  ): CreatorSettlementStatusDto {
    return buildSettlementStatus({
      bachsAccountId: profile.bachsAccountId,
      fridayPayoutEnabled: profile.fridayPayoutEnabled,
      payoutsReady,
    });
  }

  private async requireProfileWithUser(
    userId: string,
  ): Promise<CreatorProfile & { user: Pick<User, 'email'> }> {
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({ userId }).lean<LeanDoc | null>(),
    );
    const user = profile
      ? toPlain<User>(
          await UserModel.findOne({ _id: profile.userId }).lean<
            LeanDoc | null
          >(),
        )
      : null;
    if (!profile || !user) {
      throw new ApiError(
        404,
        'PROFILE_NOT_FOUND',
        'Create a creator profile first.',
      );
    }
    return { ...profile, user: { email: user.email } };
  }

  private async audit(
    userId: string,
    profileId: string,
    metadata: Record<string, string | boolean | null>,
  ) {
    await AuditLogModel.create([
      {
        actorUserId: userId,
        action: AuditAction.PROFILE_UPDATED,
        entityType: 'CreatorProfile',
        entityId: profileId,
        metadata,
      },
    ]);
  }

  private throwConnectError(err: unknown): never {
    if (err instanceof BachsProviderError) {
      if (err.kind === 'FORBIDDEN') {
        throw new ApiError(
          403,
          'CONNECT_NOT_ENABLED',
          'Bachs Connect is not enabled for this platform account. Activate the connect capability and grant this API key connected_accounts:write access, then try again.',
        );
      }
      throw new ApiError(
        err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 500
          ? err.httpStatus
          : 503,
        'CONNECT_FAILED',
        bachsPublicMessage(err.kind),
      );
    }
    console.error(
      `Connect onboarding failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
    throw new ApiError(
      503,
      'CONNECT_FAILED',
      'Unable to start Bachs Connect right now. Please try again shortly.',
    );
  }
}

export function platformFeePercent(): number {
  const envPercent = Number(getServerEnv().BACHS_PLATFORM_FEE_PERCENT ?? '5');
  return Number.isFinite(envPercent) ? Math.max(0, envPercent) : 5;
}

/** Compute platform fee decimal string from tip amount (default 5%). */
export function computePlatformFee(
  amount: string,
  percent?: number,
): string {
  const pct = percent != null && Number.isFinite(percent) ? percent : platformFeePercent();
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  const fee = (n * Math.max(0, pct)) / 100;
  // Leave something for the seller; cap fee below amount.
  const capped = Math.min(fee, Math.max(n - 0.01, 0));
  return capped.toFixed(2);
}
