import { describe, expect, it } from 'vitest';
import { buildConnectedAccountBody, buildPayoutRequirementFields, enforceManualBachsPayoutSchedule, readPayoutRequirement } from '../server/services/creators/bachs-account.service';
import { buildBachsPayoutBody, payoutDestinationMatchesSavedBank, payoutDestinationVersionMatches, providerBackedWithdrawableBalance } from '../server/services/creators/payout.service';
import {
  bachsAccountIdFromMetadata,
  isDirectChargeSettled,
} from '../server/services/creators/payout-readiness';
import { BachsProviderError } from '../server/services/payments/bachs/bachs.errors';
import type { BachsHttpClient } from '../server/services/payments/bachs/bachs-http.client';
import { BachsPaymentProvider } from '../server/services/payments/providers/bachs-payment.provider';
import { resolveBachsBaseUrl } from '../server/services/payments/bachs/bachs.constants';
import { NGN_PAYOUT_FEE, ngnWithdrawalAmounts } from '../utils/ngn-payout';

class FakeBachs {
  checkoutBody: Record<string, unknown> | null = null;
  checkoutAccountId: string | undefined;
  verifiedAccountId: string | undefined;
  balanceSettingsAccountId: string | undefined;
  balanceSettingsBody: Record<string, unknown> | undefined;

  createCheckoutSession(
    body: Record<string, unknown>,
    _idempotencyKey: string,
    accountId?: string,
  ) {
    this.checkoutBody = body;
    this.checkoutAccountId = accountId;
    return Promise.resolve({
      checkout_id: 'chk_creator',
      checkout_url: 'https://checkout.bachs.test/c/creator',
      status: 'open',
    });
  }

  getCheckoutSession(_checkoutId: string, accountId?: string) {
    this.verifiedAccountId = accountId;
    return Promise.resolve({
      checkout_id: 'chk_creator',
      status: 'completed',
      payment_status: 'paid',
      amount: '1000.00',
      currency: 'NGN',
    });
  }

  updateBalanceSettings(accountId: string, body: Record<string, unknown>) {
    this.balanceSettingsAccountId = accountId;
    this.balanceSettingsBody = body;
    return Promise.resolve({});
  }
}

const checkoutInput = {
  tipId: 'tip_1',
  paymentTransactionId: 'pay_1',
  internalReference: 'tip_ref_1',
  amount: '1000.00',
  currency: 'NGN',
  creatorUsername: 'ada',
  successUrl: 'https://tippyme.test/support/confirm/tip_1',
  cancelUrl: 'https://tippyme.test/ada',
  customerEmail: 'fan@example.com',
  customerName: 'Fan',
  platformFee: '50.00',
  bachsConnectAccountId: 'acct_creator',
};

describe('direct-charge checkout', () => {
  it('charges the creator account and keeps the platform fee off the platform balance', async () => {
    const http = new FakeBachs();
    const provider = new BachsPaymentProvider(http as unknown as BachsHttpClient);
    await provider.initializePayment(checkoutInput);

    expect(http.checkoutAccountId).toBe('acct_creator');
    expect(http.checkoutBody).toMatchObject({
      platform_fee: '50.00',
      metadata: { bachs_account_id: 'acct_creator' },
    });
    expect(http.checkoutBody).not.toHaveProperty('transfer_data');
  });

  it('refuses a checkout with no creator account', async () => {
    const provider = new BachsPaymentProvider(new FakeBachs() as unknown as BachsHttpClient);
    await expect(
      provider.initializePayment({ ...checkoutInput, bachsConnectAccountId: '  ' }),
    ).rejects.toBeInstanceOf(BachsProviderError);
  });

  it('verifies the checkout on the stored creator account', async () => {
    const http = new FakeBachs();
    const provider = new BachsPaymentProvider(http as unknown as BachsHttpClient);
    const result = await provider.verifyPayment({
      providerReference: 'chk_creator',
      bachsConnectAccountId: 'acct_creator',
    });

    expect(http.verifiedAccountId).toBe('acct_creator');
    expect(result.status).toBe('succeeded');
  });
});

describe('Bachs API host', () => {
  it('follows the key so a live URL cannot be used with a sandbox account', () => {
    expect(
      resolveBachsBaseUrl('sk_sandbox_test', 'https://api.bachs.io'),
    ).toBe('https://sandbox-api.bachs.io');
    expect(
      resolveBachsBaseUrl('sk_live_test', 'https://sandbox-api.bachs.io'),
    ).toBe('https://api.bachs.io');
  });
});

describe('creator settlement helpers', () => {
  it('forces connected accounts to manual payouts', async () => {
    const http = new FakeBachs();
    await enforceManualBachsPayoutSchedule(
      'acct_creator',
      http as unknown as BachsHttpClient,
    );
    expect(http.balanceSettingsAccountId).toBe('acct_creator');
    expect(http.balanceSettingsBody).toEqual({
      payout_schedule: { interval: 'manual' },
    });
  });

  it('matches only the dashboard bank destination', () => {
    const saved = { bankCode: '305', accountNumberLast4: '0826' };
    expect(
      payoutDestinationMatchesSavedBank(
        { id: 'pd_saved', bank_code: '305', account_number: '1234560826' },
        saved,
        '1234560826',
      ),
    ).toBe(true);
    expect(
      payoutDestinationMatchesSavedBank(
        { id: 'pd_saved', bank_code: '305', account_number: '******0826' },
        saved,
        '1234560826',
      ),
    ).toBe(true);
    expect(
      payoutDestinationMatchesSavedBank(
        { id: 'pd_default', bank_code: '058', account_number: '******0826' },
        saved,
        '1234560826',
      ),
    ).toBe(false);
    expect(
      payoutDestinationMatchesSavedBank(
        { id: 'pd_default', account_number: '9876540826' },
        saved,
        '1234560826',
      ),
    ).toBe(false);
    expect(
      payoutDestinationMatchesSavedBank(
        { id: 'pd_unknown_bank', account_number: '1234560826' },
        saved,
        '1234560826',
      ),
    ).toBe(false);
  });

  it('rejects a payout confirmation after the saved bank changes', () => {
    const updatedAt = new Date('2026-10-23T08:15:00.000Z');
    expect(
      payoutDestinationVersionMatches(
        { updatedAt },
        '2026-10-23T08:15:00.000Z',
      ),
    ).toBe(true);
    expect(
      payoutDestinationVersionMatches(
        { updatedAt },
        '2026-10-23T08:14:59.000Z',
      ),
    ).toBe(false);
    expect(payoutDestinationVersionMatches({ updatedAt }, undefined)).toBe(false);
  });

  it('sends the dashboard destination in the final Bachs payout body', () => {
    expect(
      buildBachsPayoutBody({
        destinationId: 'pd_dashboard_bank',
        bankAmount: '4650.00',
        payoutRequestId: 'request_1',
        creatorId: 'creator_1',
      }),
    ).toEqual({
      destination: 'pd_dashboard_bank',
      amount: '4650.00',
      reference: 'payout_request_1',
      metadata: {
        tippyme_payout_request_id: 'request_1',
        tippyme_creator_id: 'creator_1',
      },
    });
  });

  it('uses the lower live Bachs balance instead of overstating withdrawals', () => {
    expect(
      providerBackedWithdrawableBalance(
        '9500.00',
        [{ currency: 'NGN', available_balance: '9350.00' }],
        'NGN',
      ),
    ).toBe('9350.00');
    expect(
      providerBackedWithdrawableBalance(
        '9000.00',
        [{ currency: 'NGN', available_balance: '9350.00' }],
        'NGN',
      ),
    ).toBe('9000.00');
    expect(providerBackedWithdrawableBalance('9500.00', [], 'NGN')).toBe('0.00');
    expect(
      providerBackedWithdrawableBalance(
        '9500.00',
        [{ currency: 'NGN', available_balance: 'not-money' }],
        'NGN',
      ),
    ).toBeNull();
  });

  it('requests collection and payout capabilities for a new connected account', () => {
    const body = buildConnectedAccountBody({
      email: 'ada@example.com',
      displayName: 'Ada',
      creatorId: 'creator_1',
    });
    expect(body.country).toBe('NG');
    expect(body.balance_currencies).toEqual({ NGN: true });
    expect(body.configuration?.merchant?.capabilities?.bank_transfer).toEqual({
      requested: true,
    });
    expect(body.configuration?.merchant?.capabilities?.ngn_card_collection).toEqual({
      requested: true,
    });
    expect(body.configuration?.recipient?.capabilities?.payouts).toEqual({
      requested: true,
    });
  });

  it('submits the holder name and bank together so payouts can activate', () => {
    const fields = buildPayoutRequirementFields({
      holderName: 'Ada Obi',
      accountNumber: '0123456789',
      accountName: 'ADA OBI',
      bankCode: '058',
    });
    expect(fields.persons?.[0]).toEqual({
      first_name: 'Ada',
      last_name: 'Obi',
      relationship: { representative: true },
    });
    expect(fields.payout_destination).toEqual({
      currency: 'NGN',
      type: 'bank_account',
      account_number: '0123456789',
      account_name: 'ADA OBI',
      bank_code: '058',
    });
  });

  it('treats an accepted payout destination separately from a rejected one', () => {
    expect(
      readPayoutRequirement({
        requirements: {
          currently_due: ['persons.name'],
          pending_verification: ['payout_destination'],
          errors: [],
        },
      }).state,
    ).toBe('accepted');
    expect(
      readPayoutRequirement({
        requirements: {
          currently_due: ['payout_destination'],
          errors: [],
        },
      }).state,
    ).toBe('due');
    expect(
      readPayoutRequirement({
        requirements: {
          currently_due: ['payout_destination'],
          errors: [{ field: 'payout_destination', reason: 'Unknown bank code.' }],
        },
      }),
    ).toEqual({ state: 'rejected', reason: 'Unknown bank code.' });
    expect(readPayoutRequirement({}).state).toBe('unknown');
  });

  it('counts only direct-charge payments toward a creator balance', () => {
    expect(isDirectChargeSettled({ settledVia: 'direct_charge' })).toBe(true);
    expect(isDirectChargeSettled({ settled_via: 'direct_charge' })).toBe(true);
    expect(isDirectChargeSettled({ settledVia: 'platform_balance' })).toBe(false);
    expect(bachsAccountIdFromMetadata({ bachsAccountId: ' acct_creator ' })).toBe(
      'acct_creator',
    );
    expect(bachsAccountIdFromMetadata({ settledVia: 'platform_balance' })).toBeUndefined();
  });

  it('shows the ₦50 fee before the amount sent to the bank', () => {
    expect(NGN_PAYOUT_FEE).toBe('50.00');
    expect(ngnWithdrawalAmounts('1000.00')).toEqual({
      fee: '50.00',
      toBank: '950.00',
      debit: '1000.00',
    });
    expect(Number(ngnWithdrawalAmounts('149.00').toBank)).toBeLessThan(100);
  });
});
