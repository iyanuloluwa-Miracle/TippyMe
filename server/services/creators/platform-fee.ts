import { getServerEnv } from '../../lib/env';

export function platformFeePercent(): number {
  const envPercent = Number(getServerEnv().BACHS_PLATFORM_FEE_PERCENT ?? '5');
  return Number.isFinite(envPercent) ? Math.max(0, envPercent) : 5;
}

/** Platform fee decimal string from tip amount (default 5%). */
export function computePlatformFee(
  amount: string,
  percent?: number,
): string {
  const pct =
    percent != null && Number.isFinite(percent) ? percent : platformFeePercent();
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  const fee = (n * Math.max(0, pct)) / 100;
  const capped = Math.min(fee, Math.max(n - 0.01, 0));
  return capped.toFixed(2);
}

/** Creator share after platform fee. */
export function computeCreatorNet(
  amount: string,
  percent?: number,
): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  const fee = Number(computePlatformFee(amount, percent));
  return Math.max(n - fee, 0).toFixed(2);
}
