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
} from '../payments/bachs/bachs.errors';
import { BachsHttpClient } from '../payments/bachs/bachs-http.client';
import {
  accountCanReceiveDestinationCharges,
  hasLiveBachsConnect,
} from './payout-readiness';
import {
  buildSettlementStatus,
  type CreatorSettlementStatusDto,
} from './settlement.types';
import {
  isAllowedPayoutCountry,
  isLegacyUnsupportedCurrency,
} from './username';

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
    if (isLegacyUnsupportedCurrency(profile.currency)) {
      throw new ApiError(
        400,
        'INVALID_CURRENCY',
        'Update your preferred currency in profile settings before connecting Bachs. ZAR is no longer supported.',
      );
    }
    const appUrl = (getServerEnv().APP_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const returnUrl = `${appUrl}/dashboard/connect/return`;
    const refreshUrl = `${appUrl}/dashboard/connect/refresh`;

    // Already linked — mint a fresh hosted link if live Bachs is configured.
    let recreateAfterStale = false;
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
        await this.ensureNgnBalanceCurrency(profile.bachsAccountId, profile.currency);
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
        // Stale / cross-environment account ids 404 on Bachs — clear and recreate.
        if (this.isStaleConnectAccountError(err)) {
          console.warn(
            `Connect: clearing stale bachsAccountId=${profile.bachsAccountId} kind=${err.kind} code=${err.providerErrorCode ?? 'none'}`,
          );
          await CreatorProfileModel.updateOne(
            { _id: profile.id },
            {
              $set: {
                bachsAccountId: null,
                bachsPayoutsReady: false,
                bachsPayoutsCheckedAt: null,
                fridayPayoutEnabled: false,
                updatedAt: new Date(),
              },
            },
          );
          profile.bachsAccountId = null;
          profile.bachsPayoutsReady = false;
          profile.fridayPayoutEnabled = false;
          recreateAfterStale = true;
        } else {
          this.throwConnectError(err);
        }
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
          ...(profile.currency.toUpperCase() === 'NGN'
            ? { balance_currencies: { NGN: true } }
            : {}),
          metadata: {
            tippyme_creator_id: profile.id,
            tippyme_username: profile.username,
          },
        },
        `connect_${profile.id}${recreateAfterStale ? `_r${Date.now()}` : ''}`.slice(0, 255),
      );

      if (!account.id) {
        throw new BachsProviderError(
          'PROVIDER',
          'Incomplete Bachs Connect account response',
        );
      }

      await this.ensureNgnBalanceCurrency(account.id, profile.currency);

      const linked = await CreatorProfileModel.findOneAndUpdate(
        {
          _id: profile.id,
          $or: [
            { bachsAccountId: null },
            { bachsAccountId: { $exists: false } },
            { bachsAccountId: { $regex: /^acct_stub_/ } },
          ],
        },
        {
          $set: {
            bachsAccountId: account.id,
            bachsPayoutsReady: false,
            bachsPayoutsCheckedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      let accountIdForLink = account.id;
      if (linked?.bachsAccountId) {
        accountIdForLink = linked.bachsAccountId;
      } else {
        const current = toPlain<CreatorProfile>(
          await CreatorProfileModel.findOne({ _id: profile.id }).lean<
            LeanDoc | null
          >(),
        );
        if (hasLiveBachsConnect(current?.bachsAccountId)) {
          accountIdForLink = current!.bachsAccountId!;
        } else {
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
        }
      }
      if (
        accountIdForLink !== account.id &&
        hasLiveBachsConnect(accountIdForLink)
      ) {
        await this.audit(userId, profile.id, {
          event: 'connect_account_raced',
          bachsAccountId: accountIdForLink,
          discardedAccountId: account.id,
        });
      } else {
        await this.audit(userId, profile.id, {
          event: 'connect_account_created',
          bachsAccountId: accountIdForLink,
        });
      }

      const link = await this.http.createAccountLink(accountIdForLink, {
        type: 'onboarding',
        return_url: returnUrl,
        refresh_url: refreshUrl,
      });

      return {
        settlement: buildSettlementStatus({
          bachsAccountId: accountIdForLink,
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
    if (country === 'ZA') {
      throw new ApiError(
        400,
        'INVALID_PAYOUT_COUNTRY',
        'South Africa is no longer supported for Bachs payout setup. Choose a supported payout country in profile settings.',
      );
    }
    if (!isAllowedPayoutCountry(country)) {
      throw new ApiError(
        400,
        'INVALID_PAYOUT_COUNTRY',
        'Choose a supported payout country in profile settings before connecting Bachs.',
      );
    }
    return country;
  }

  /** Only drop a stored Connect id when Bachs says the account does not exist. */
  private isStaleConnectAccountError(err: unknown): boolean {
    return err instanceof BachsProviderError && err.kind === 'NOT_FOUND';
  }

  /**
   * NGN tips can settle as NGN when the Connect account holds NGN.
   * Best-effort: onboarding must not fail if Bachs rejects the update.
   */
  private async ensureNgnBalanceCurrency(
    accountId: string,
    currency: string,
  ): Promise<void> {
    if (!this.http.isConfigured || currency.toUpperCase() !== 'NGN') return;
    try {
      await this.http.updateConnectedAccount(accountId, {
        balance_currencies: { NGN: true },
      });
    } catch (err) {
      console.warn(
        `Connect: failed to enable NGN balance currency account=${accountId}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
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
    if (err instanceof ApiError) throw err;
    if (err instanceof BachsProviderError) {
      if (err.kind === 'FORBIDDEN') {
        throw new ApiError(
          403,
          'CONNECT_NOT_ENABLED',
          'Bachs Connect is not fully active on your platform yet. Finish Bachs business verification, ensure the Connect capability is active, and give this API key connected_accounts:write.',
        );
      }
      if (err.kind === 'UNAUTHORIZED') {
        throw new ApiError(
          502,
          'CONNECT_UNAUTHORIZED',
          'Bachs rejected the API key. Use a key with connected_accounts:write, and match sandbox vs live (sk_sandbox_ → sandbox-api, sk_live_ → api.bachs.io).',
        );
      }
      if (err.kind === 'NOT_FOUND') {
        throw new ApiError(
          502,
          'CONNECT_NOT_FOUND',
          'Bachs could not find that Connect account or endpoint. Finish platform Connect setup, confirm the API base URL matches your key, then try again.',
        );
      }
      if (err.kind === 'VALIDATION') {
        throw new ApiError(
          400,
          'CONNECT_VALIDATION',
          'Bachs could not start Connect onboarding with the current profile details. Check payout country and try again.',
        );
      }
      // Never forward Bachs 404/4xx as TippyMe route status — browsers report it as "onboard 404".
      throw new ApiError(
        503,
        'CONNECT_FAILED',
        err.kind === 'RATE_LIMITED'
          ? 'Bachs is busy. Wait a moment and try Connect again.'
          : 'Unable to start Bachs Connect right now. Please try again shortly.',
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
