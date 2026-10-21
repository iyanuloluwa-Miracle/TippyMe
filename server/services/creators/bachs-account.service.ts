import { ApiError } from '../../lib/errors';
import {
  CreatorProfileModel,
  UserModel,
  isUniqueViolation,
  toPlain,
  useDb,
} from '../../db';
import type { LeanDoc } from '../../db/lean';
import type { CreatorProfile, User } from '../../db/types';
import {
  BachsHttpClient,
  type BachsConnectedAccountResponse,
  type BachsCreateConnectedAccountBody,
} from '../payments/bachs/bachs-http.client';
import { BachsProviderError } from '../payments/bachs/bachs.errors';

/**
 * Direct-charge merchant capabilities TippyMe already offers, plus payouts
 * so the creator can withdraw to the bank they enter.
 */
export function buildConnectedAccountBody(input: {
  email: string;
  displayName: string;
  creatorId: string;
}): BachsCreateConnectedAccountBody {
  return {
    contact_email: input.email,
    display_name: input.displayName.trim().slice(0, 80) || 'TippyMe creator',
    country: 'NG',
    entity_type: 'individual',
    configuration: {
      merchant: {
        capabilities: {
          bank_transfer: { requested: true },
          ngn_card_collection: { requested: true },
          card_collection: { requested: true },
          mobile_money: { requested: true },
        },
      },
      recipient: {
        capabilities: {
          payouts: { requested: true },
        },
      },
    },
    balance_currencies: { NGN: true },
    metadata: { tippyme_creator_id: input.creatorId },
  };
}

/**
 * One Bachs connected account per creator. Checkout and withdrawals act as
 * this account, so sales do not settle into the platform balance.
 */
export async function ensureCreatorBachsAccount(
  profile: CreatorProfile,
  http: BachsHttpClient = new BachsHttpClient(),
): Promise<string> {
  await useDb();
  const fresh = toPlain<CreatorProfile>(
    await CreatorProfileModel.findOne({ _id: profile.id }).lean<LeanDoc | null>(),
  );
  if (!fresh) {
    throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Creator profile not found.');
  }

  const stored = fresh.bachsAccountId?.trim() ?? '';
  if (stored && (!http.isConfigured || !stored.startsWith('acct_stub_'))) {
    return stored;
  }

  if (!http.isConfigured) {
    const stub = stored.startsWith('acct_stub_') ? stored : `acct_stub_${fresh.id}`;
    if (stored !== stub) {
      await CreatorProfileModel.updateOne(
        { _id: fresh.id },
        { $set: { bachsAccountId: stub, updatedAt: new Date() } },
      );
    }
    return stub;
  }

  const user = toPlain<User>(
    await UserModel.findOne({ _id: fresh.userId }).select('email').lean<LeanDoc | null>(),
  );
  const email = user?.email?.trim().toLowerCase();
  if (!email) {
    throw new ApiError(
      503,
      'CREATOR_PAYOUT_ACCOUNT_UNAVAILABLE',
      'This creator cannot accept payments right now.',
    );
  }

  const created = await http.createConnectedAccount(
    buildConnectedAccountBody({
      email,
      displayName: fresh.displayName,
      creatorId: fresh.id,
    }),
    `connect_${fresh.id}`.slice(0, 255),
  );
  const accountId = readAccountId(created);
  if (!accountId) {
    throw new BachsProviderError(
      'PROVIDER',
      'Bachs connected account response did not include an id',
    );
  }

  try {
    await http.updateConnectedAccount(accountId, {
      balance_currencies: { NGN: true },
    });
    await http.updateBalanceSettings(accountId, {
      payout_schedule: { interval: 'manual' },
    });
  } catch (err) {
    console.warn(
      `Bachs account setup incomplete account=${accountId}: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  try {
    await CreatorProfileModel.updateOne(
      { _id: fresh.id },
      { $set: { bachsAccountId: accountId, updatedAt: new Date() } },
    );
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const raced = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({ _id: fresh.id }).lean<LeanDoc | null>(),
    );
    const winner = raced?.bachsAccountId?.trim() ?? '';
    if (winner && !winner.startsWith('acct_stub_')) return winner;
    throw err;
  }

  return accountId;
}

function readAccountId(account: BachsConnectedAccountResponse): string {
  const nested = (account as BachsConnectedAccountResponse & {
    data?: { id?: string };
  }).data?.id;
  return (account.id || nested || '').trim();
}
