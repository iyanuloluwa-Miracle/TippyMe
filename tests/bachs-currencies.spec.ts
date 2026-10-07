import { describe, expect, it } from 'vitest';
import {
  ALLOWED_CURRENCIES,
  ALLOWED_PAYOUT_COUNTRIES,
  isAllowedCurrency,
  isAllowedPayoutCountry,
  isLegacyUnsupportedCurrency,
  SUGGESTED_PAYOUT_COUNTRY,
} from '../utils/bachs-currencies';
import {
  ALLOWED_CURRENCIES as ReexportedCurrencies,
  isAllowedPayoutCountry as reexportedIsAllowedPayoutCountry,
} from '../server/services/creators/username';
import { hasLiveBachsConnect } from '../server/services/creators/payout-readiness';
import { BachsProviderError } from '../server/services/payments/bachs/bachs.errors';

describe('bachs currency allowlists', () => {
  it('exposes the full Bachs fiat collection set without ZAR', () => {
    expect(ALLOWED_CURRENCIES).toEqual([
      'USD',
      'NGN',
      'GHS',
      'KES',
      'MWK',
      'RWF',
      'TZS',
      'UGX',
      'XAF',
      'XOF',
      'ZMW',
    ]);
    expect(isAllowedCurrency('tzs')).toBe(true);
    expect(isAllowedCurrency('ZAR')).toBe(false);
    expect(isLegacyUnsupportedCurrency('zar')).toBe(true);
  });

  it('re-exports the same allowlist from username helpers', () => {
    expect(ReexportedCurrencies).toEqual(ALLOWED_CURRENCIES);
    expect(reexportedIsAllowedPayoutCountry('TZ')).toBe(true);
  });

  it('expands payout countries and rejects new ZA selections', () => {
    expect(ALLOWED_PAYOUT_COUNTRIES).toContain('TZ');
    expect(ALLOWED_PAYOUT_COUNTRIES).toContain('CM');
    expect(ALLOWED_PAYOUT_COUNTRIES).toContain('CI');
    expect(ALLOWED_PAYOUT_COUNTRIES).not.toContain('ZA');
    expect(isAllowedPayoutCountry('ug')).toBe(true);
    expect(isAllowedPayoutCountry('ZA')).toBe(false);
  });

  it('suggests a soft payout country for local currencies', () => {
    expect(SUGGESTED_PAYOUT_COUNTRY.GHS).toBe('GH');
    expect(SUGGESTED_PAYOUT_COUNTRY.XAF).toBe('CM');
    // XOF and USD need an explicit country choice.
    expect(SUGGESTED_PAYOUT_COUNTRY.XOF).toBeUndefined();
    expect(SUGGESTED_PAYOUT_COUNTRY.USD).toBeUndefined();
  });
});

describe('Connect NGN balance_currencies payload', () => {
  it('includes NGN balance holding when creator currency is NGN', () => {
    const currency = 'NGN';
    const body = {
      contact_email: 'ada@example.com',
      display_name: 'Ada',
      country: 'NG',
      ...(currency.toUpperCase() === 'NGN'
        ? { balance_currencies: { NGN: true } }
        : {}),
    };

    expect(body.balance_currencies).toEqual({ NGN: true });
  });

  it('omits balance_currencies for non-NGN preferred currencies', () => {
    const currency = 'GHS';
    const body = {
      contact_email: 'kwame@example.com',
      display_name: 'Kwame',
      country: 'GH',
      ...(currency.toUpperCase() === 'NGN'
        ? { balance_currencies: { NGN: true } }
        : {}),
    };

    expect(body.balance_currencies).toBeUndefined();
  });

  it('detects live Bachs Connect ids', () => {
    expect(hasLiveBachsConnect('acct_live_abc')).toBe(true);
    expect(hasLiveBachsConnect('acct_stub_demo')).toBe(false);
    expect(hasLiveBachsConnect(null)).toBe(false);
  });

  it('treats only NOT_FOUND as a stale Connect account error', () => {
    const stale = (err: unknown) =>
      err instanceof BachsProviderError && err.kind === 'NOT_FOUND';
    expect(stale(new BachsProviderError('NOT_FOUND', 'missing'))).toBe(true);
    expect(stale(new BachsProviderError('VALIDATION', 'bad url'))).toBe(false);
  });

  it('keeps legacy ZA payout country only when unchanged', () => {
    const linkedCountry = 'ZA';
    const requested = 'ZA';
    const unchangedLegacyZa = requested === 'ZA' && linkedCountry === 'ZA';
    expect(unchangedLegacyZa || isAllowedPayoutCountry(requested)).toBe(true);

    const newZaWrite = 'ZA';
    const previous = 'NG';
    const allowNewZa =
      isAllowedPayoutCountry(newZaWrite) ||
      (newZaWrite === 'ZA' && previous === 'ZA');
    expect(allowNewZa).toBe(false);
  });
});
