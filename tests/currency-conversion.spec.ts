import { afterEach, expect, it, vi } from 'vitest';
import Decimal from 'decimal.js';
import { convertAmount, convertCurrencyTotals, tryConvertCurrencyTotals } from '../server/services/creators/currency-conversion';

afterEach(() => vi.unstubAllGlobals());

it('converts each original currency before adding dashboard totals', async () => {
  const fetchRate = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ rate: 1500 }),
  });
  vi.stubGlobal('fetch', fetchRate);

  const total = await convertCurrencyTotals([
    { currency: 'USD', sum: new Decimal('10'), count: 1 },
    { currency: 'NGN', sum: new Decimal('2000'), count: 1 },
  ], 'NGN');

  expect(total.toFixed(2)).toBe('17000.00');
  expect(fetchRate).toHaveBeenCalledWith(
    'https://api.frankfurter.dev/v2/rate/USD/NGN',
    expect.any(Object),
  );
});

it('returns null instead of failing the dashboard when a rate is missing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  const total = await tryConvertCurrencyTotals([
    { currency: 'GHS', sum: new Decimal('10'), count: 1 },
  ], 'KES');
  expect(total).toBeNull();
});

it('still rejects a required conversion when rates are unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(convertCurrencyTotals([
    { currency: 'GHS', sum: new Decimal('10'), count: 1 },
  ], 'KES')).rejects.toMatchObject({ statusCode: 503 });
});

it('converts an existing goal target when the currency changes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rate: 0.01 }) }));
  expect(await convertAmount('50000.00', 'NGN', 'USD')).toBe('500.00');
});

it('uses the last known rate when the rate service is later unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ rate: 2 }),
  }));
  expect(await convertAmount('10.00', 'USD', 'EUR')).toBe('20.00');

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
  expect(await convertAmount('10.00', 'USD', 'EUR')).toBe('20.00');
});
