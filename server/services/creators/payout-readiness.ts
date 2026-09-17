import type { BachsConnectedAccountResponse } from '../payments/bachs/bachs-http.client';

const READY_STATUS = new Set(['active', 'enabled']);

function capabilityReady(key: string, status: string | undefined): boolean {
  if (!/transfer|payout/i.test(key)) return false;
  return READY_STATUS.has((status ?? '').toLowerCase());
}

/**
 * Destination charges are allowed only when Bachs has enabled transfers or
 * payouts. A stored account id, or a capability that was merely requested,
 * is not enough.
 */
export function accountCanReceiveDestinationCharges(
  account: Pick<
    BachsConnectedAccountResponse,
    'enabled_capabilities' | 'capabilities'
  >,
): boolean {
  const enabled = account.enabled_capabilities ?? [];
  if (enabled.some((item) => /transfer|payout/i.test(item))) return true;

  for (const [key, value] of Object.entries(account.capabilities ?? {})) {
    if (capabilityReady(key, value?.status)) return true;
  }
  return false;
}

export function isDestinationSettled(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return false;
  return (
    metadata.settledVia === 'destination_charge' ||
    metadata.settled_via === 'destination_charge'
  );
}
