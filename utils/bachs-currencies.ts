/**
 * Bachs fiat collection currencies TippyMe accepts as a creator’s preferred tip currency.
 * @see https://docs.bachs.io/for-you/supported-currencies
 */
export const ALLOWED_CURRENCIES = [
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
] as const;

export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

/**
 * ISO countries TippyMe offers for Bachs Connect onboarding.
 * Legacy `ZA` is not selectable for new writes (kept on existing profiles only).
 */
export const ALLOWED_PAYOUT_COUNTRIES = [
  'NG',
  'GH',
  'KE',
  'TZ',
  'UG',
  'MW',
  'RW',
  'ZM',
  'CM',
  'SN',
  'CI',
] as const;

export type AllowedPayoutCountry = (typeof ALLOWED_PAYOUT_COUNTRIES)[number];

export const PAYOUT_COUNTRY_OPTIONS: ReadonlyArray<{
  code: AllowedPayoutCountry;
  label: string;
}> = [
  { code: 'NG', label: 'Nigeria' },
  { code: 'GH', label: 'Ghana' },
  { code: 'KE', label: 'Kenya' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'UG', label: 'Uganda' },
  { code: 'MW', label: 'Malawi' },
  { code: 'RW', label: 'Rwanda' },
  { code: 'ZM', label: 'Zambia' },
  { code: 'CM', label: 'Cameroon' },
  { code: 'SN', label: 'Senegal' },
  { code: 'CI', label: 'Côte d’Ivoire' },
];

/** Soft default payout country for onboarding UX — never a hard lock. */
export const SUGGESTED_PAYOUT_COUNTRY: Partial<
  Record<AllowedCurrency, AllowedPayoutCountry>
> = {
  NGN: 'NG',
  GHS: 'GH',
  KES: 'KE',
  TZS: 'TZ',
  UGX: 'UG',
  MWK: 'MW',
  RWF: 'RW',
  ZMW: 'ZM',
  XAF: 'CM',
  // XOF spans multiple countries (e.g. SN, CI) — creator must choose explicitly.
};

export function isAllowedCurrency(raw: string): raw is AllowedCurrency {
  return (ALLOWED_CURRENCIES as readonly string[]).includes(
    raw.trim().toUpperCase(),
  );
}

export function isAllowedPayoutCountry(
  raw: string,
): raw is AllowedPayoutCountry {
  return (ALLOWED_PAYOUT_COUNTRIES as readonly string[]).includes(
    raw.trim().toUpperCase(),
  );
}

/** Legacy ZAR is no longer a Bachs collection currency. */
export function isLegacyUnsupportedCurrency(raw: string): boolean {
  return raw.trim().toUpperCase() === 'ZAR';
}
