import Decimal from 'decimal.js';
import { ApiError } from '../../lib/errors';

export type CurrencyTotal = { currency: string; sum: Decimal; count: number };

const rateCache = new Map<string, { rate: Decimal; expiresAt: number }>();
const RATE_TTL_MS = 60 * 60 * 1000;

async function exchangeRate(from: string, to: string): Promise<Decimal> {
  if (from === to) return new Decimal(1);
  const key = `${from}/${to}`;
  const cached = rateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error(`Rate request returned ${response.status}`);
    const data = (await response.json()) as { rate?: number };
    const rate = new Decimal(data.rate ?? NaN);
    if (!rate.isFinite() || !rate.isPositive()) throw new Error('Invalid exchange rate');
    rateCache.set(key, { rate, expiresAt: Date.now() + RATE_TTL_MS });
    return rate;
  } catch {
    throw new ApiError(503, 'EXCHANGE_RATE_UNAVAILABLE', 'Currency conversion is temporarily unavailable. Please try again.');
  }
}

export async function convertCurrencyTotals(
  totals: CurrencyTotal[],
  targetCurrency: string,
): Promise<Decimal> {
  const values = await Promise.all(totals.map(async ({ currency, sum }) =>
    sum.mul(await exchangeRate(currency, targetCurrency)),
  ));
  return values.reduce((total, value) => total.plus(value), new Decimal(0));
}

export async function convertAmount(
  amount: string,
  from: string,
  to: string,
): Promise<string> {
  return new Decimal(amount).mul(await exchangeRate(from, to)).toFixed(2);
}
