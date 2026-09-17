import Decimal from 'decimal.js';
import { ApiError } from '../../lib/errors';

export type CurrencyTotal = { currency: string; sum: Decimal; count: number };

const rateCache = new Map<string, { rate: Decimal; expiresAt: number }>();
const RATE_TTL_MS = 60 * 60 * 1000;

async function readStoredRate(key: string): Promise<Decimal | null> {
  try {
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) return null;
    const { ExchangeRateModel } = await import('../../db/models');
    const row = await ExchangeRateModel.findById(key).lean<{ rate?: string } | null>();
    const rate = new Decimal(row?.rate ?? NaN);
    return rate.isFinite() && rate.isPositive() ? rate : null;
  } catch {
    return null;
  }
}

async function storeRate(key: string, rate: Decimal): Promise<void> {
  rateCache.set(key, { rate, expiresAt: Date.now() + RATE_TTL_MS });
  try {
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) return;
    const { ExchangeRateModel } = await import('../../db/models');
    await ExchangeRateModel.updateOne(
      { _id: key },
      { $set: { rate: rate.toString(), updatedAt: new Date() } },
      { upsert: true },
    );
  } catch {
    // The in-memory rate is still usable for this process.
  }
}

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
    await storeRate(key, rate);
    return rate;
  } catch {
    if (cached?.rate) return cached.rate;
    const inverse = rateCache.get(`${to}/${from}`);
    if (inverse?.rate.isPositive()) return new Decimal(1).div(inverse.rate);
    const stored = (await readStoredRate(key)) ?? await (async () => {
      const inverseStored = await readStoredRate(`${to}/${from}`);
      return inverseStored ? new Decimal(1).div(inverseStored) : null;
    })();
    if (stored) {
      rateCache.set(key, { rate: stored, expiresAt: Date.now() + RATE_TTL_MS });
      return stored;
    }
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
