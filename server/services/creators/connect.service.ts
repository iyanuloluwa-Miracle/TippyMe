/**
 * Legacy module path — Connect destination charges were removed.
 * Platform fee helpers live in platform-fee.ts; bank payouts in payout.service.ts.
 */
export {
  platformFeePercent,
  computePlatformFee,
  computeCreatorNet,
} from './platform-fee';
