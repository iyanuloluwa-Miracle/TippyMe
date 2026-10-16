import { getServerEnv } from '../../../lib/env';
import {
  BACHS_API_VERSION_PREFIX,
  BACHS_PRODUCTION_BASE_URL,
  BACHS_REQUEST_TIMEOUT_MS,
  BACHS_SANDBOX_BASE_URL,
} from './bachs.constants';
import { BachsProviderError, mapHttpStatusToKind } from './bachs.errors';

export interface BachsCreateCheckoutSessionBody {
  pricing: { currency: string; amount: string };
  customer: { email: string; name: string };
  success_url: string;
  cancel_url: string;
  reference: string;
  metadata?: Record<string, string>;
  /** Destination charge — seller Connect account receives sale minus platform_fee. */
  transfer_data?: { destination: string; amount?: string };
  /** Platform cut as decimal string (same currency precision as amount). */
  platform_fee?: string;
}

/** Documented create-checkout response fields we rely on. */
export interface BachsCreateCheckoutSessionResponse {
  checkout_id: string;
  checkout_url: string;
  status: string;
  expires_at?: string;
  created_at?: string;
  reference?: string | null;
  platform_fee?: string;
}

/** Subset of retrieve-checkout fields used for verification. */
export interface BachsCheckoutSessionResponse {
  checkout_id: string;
  status: string;
  payment_status?: string | null;
  amount?: string;
  currency?: string;
  reference?: string | null;
  charge?: {
    status?: string;
    amount?: string;
    currency?: string;
    payment_id?: string;
    charge_id?: string;
  } | null;
}

export interface BachsCreateConnectedAccountBody {
  contact_email: string;
  display_name: string;
  country: string;
  entity_type?: 'individual' | 'company';
  first_name?: string;
  last_name?: string;
  configuration?: {
    recipient?: {
      capabilities?: {
        payouts?: { requested: boolean };
        transfers?: { requested: boolean };
      };
    };
  };
  responsibilities?: {
    fees?: { collector: 'bachs' | 'platform' };
  };
  /** Currencies the Connect account holds as balances (USD is always held). */
  balance_currencies?: Record<string, boolean>;
  metadata?: Record<string, string>;
}

export interface BachsUpdateConnectedAccountBody {
  balance_currencies?: Record<string, boolean>;
  display_name?: string;
  contact_email?: string;
  configuration?: BachsCreateConnectedAccountBody['configuration'];
}

export interface BachsConnectedAccountResponse {
  id: string;
  name?: string;
  country?: string;
  enabled_capabilities?: string[];
  capabilities?: Record<
    string,
    { status?: string; requested?: boolean } | undefined
  >;
  is_active?: boolean;
}

export interface BachsCreateAccountLinkBody {
  type: 'onboarding' | 'update';
  refresh_url: string;
  return_url: string;
}

export interface BachsAccountLinkResponse {
  id: string;
  account: string;
  type: string;
  url: string;
  expires_at?: string;
  previous_link_superseded?: boolean;
}

export interface BachsBalanceSettingsBody {
  payout_schedule?: {
    interval: 'manual' | 'instant' | 'daily' | 'weekly' | 'monthly';
    weekly_payout_days?: string[];
  };
}

export interface BachsBank {
  code?: string;
  bank_code?: string;
  name?: string;
  bank_name?: string;
  currency?: string;
  country?: string;
}

export interface BachsBanksResponse {
  country?: string;
  data?: BachsBank[];
  banks?: BachsBank[];
}

export interface BachsResolveAccountResponse {
  resolved?: boolean;
  account_number?: string | null;
  account_name?: string | null;
  bank_code?: string;
  message?: string | null;
}

export interface BachsCreatePayoutDestinationBody {
  type: 'bank_account' | 'mobile_money' | 'crypto_wallet';
  currency: string;
  bank_code: string;
  account_number: string;
  name?: string;
  label?: string;
  account_name?: string;
}

export interface BachsPayoutDestinationResponse {
  id: string;
  type?: string;
  currency?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  is_usable?: boolean;
  status?: string;
}

export interface BachsCreatePayoutBody {
  destination: string;
  amount: string;
  reference?: string;
  metadata?: Record<string, string>;
}

export interface BachsPayoutResponse {
  id: string;
  status?: string;
  amount?: string;
  currency?: string;
  destination?: string;
  fee?: string;
  total_debited?: string;
  failure_reason?: string;
  metadata?: {
    tippyme_payout_request_id?: string;
    tippyme_creator_id?: string;
  };
  data?: BachsPayoutResponse;
}

interface BachsErrorBody {
  detail?: string;
  error_code?: string;
}

/**
 * Thin HTTP client for official Bachs REST.
 * Never log Authorization headers or API keys.
 */
export class BachsHttpClient {
  get isConfigured(): boolean {
    return Boolean(getServerEnv().BACHS_API_KEY?.trim());
  }

  private baseUrl(): string {
    const configured = getServerEnv().BACHS_API_BASE_URL?.replace(/\/$/, '');
    if (configured) return configured;
    const key = getServerEnv().BACHS_API_KEY?.trim() ?? '';
    if (key.startsWith('sk_live_')) return BACHS_PRODUCTION_BASE_URL;
    return BACHS_SANDBOX_BASE_URL;
  }

  /** Warn when key environment and base URL disagree (common Connect 401/404 cause). */
  private assertKeyMatchesBaseUrl(): void {
    const key = this.apiKey();
    const base = this.baseUrl().toLowerCase();
    const liveKey = key.startsWith('sk_live_');
    const sandboxKey = key.startsWith('sk_sandbox_');
    const liveBase = base.includes('sandbox') === false && base.includes('bachs.io');
    const sandboxBase = base.includes('sandbox');
    if ((liveKey && sandboxBase) || (sandboxKey && liveBase && !sandboxBase)) {
      console.error(
        `Bachs config mismatch: key_prefix=${key.slice(0, 10)}… base=${base}`,
      );
    }
  }

  private apiKey(): string {
    const key = getServerEnv().BACHS_API_KEY?.trim();
    if (!key) {
      throw new BachsProviderError('CONFIG', 'BACHS_API_KEY is not configured');
    }
    return key;
  }

  async createCheckoutSession(
    body: BachsCreateCheckoutSessionBody,
    idempotencyKey: string,
  ): Promise<BachsCreateCheckoutSessionResponse> {
    return this.request<BachsCreateCheckoutSessionResponse>(
      'POST',
      '/checkout-sessions',
      {
        body,
        idempotencyKey,
        expectedStatuses: [200, 201],
      },
    );
  }

  async getCheckoutSession(
    checkoutId: string,
  ): Promise<BachsCheckoutSessionResponse> {
    return this.request<BachsCheckoutSessionResponse>(
      'GET',
      `/checkout-sessions/${encodeURIComponent(checkoutId)}`,
      { expectedStatuses: [200] },
    );
  }

  async createConnectedAccount(
    body: BachsCreateConnectedAccountBody,
    idempotencyKey: string,
  ): Promise<BachsConnectedAccountResponse> {
    return this.request<BachsConnectedAccountResponse>('POST', '/accounts', {
      body,
      idempotencyKey,
      expectedStatuses: [200, 201],
    });
  }

  async getConnectedAccount(
    accountId: string,
  ): Promise<BachsConnectedAccountResponse> {
    return this.request<BachsConnectedAccountResponse>(
      'GET',
      `/accounts/${encodeURIComponent(accountId)}`,
      { expectedStatuses: [200] },
    );
  }

  /** Update Connect account fields (e.g. enable NGN balance holding). */
  async updateConnectedAccount(
    accountId: string,
    body: BachsUpdateConnectedAccountBody,
  ): Promise<BachsConnectedAccountResponse> {
    return this.request<BachsConnectedAccountResponse>(
      'POST',
      `/accounts/${encodeURIComponent(accountId)}`,
      {
        body,
        expectedStatuses: [200, 201],
      },
    );
  }

  async createAccountLink(
    accountId: string,
    body: BachsCreateAccountLinkBody,
  ): Promise<BachsAccountLinkResponse> {
    return this.request<BachsAccountLinkResponse>(
      'POST',
      `/accounts/${encodeURIComponent(accountId)}/account-links`,
      {
        body,
        expectedStatuses: [200, 201],
      },
    );
  }

  /** Set the Friday schedule on the connected Bachs balance. */
  async updateBalanceSettings(
    accountId: string,
    body: BachsBalanceSettingsBody,
  ): Promise<unknown> {
    return this.request('POST', '/balance_settings', {
      body,
      expectedStatuses: [200, 201],
      accountId,
    });
  }

  /**
   * List local banks for a payout country.
   * Docs: GET /v1/reference/banks?country=NG
   */
  async listBanks(params: {
    currency?: string;
    country?: string;
  }): Promise<BachsBank[]> {
    const query = new URLSearchParams();
    if (params.country) query.set('country', params.country);
    // Currency is not a documented query param on this endpoint.
    void params.currency;
    const qs = query.toString();
    const path = qs ? `/reference/banks?${qs}` : '/reference/banks';
    const raw = await this.request<BachsBanksResponse | BachsBank[]>(
      'GET',
      path,
      { expectedStatuses: [200] },
    );
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.banks)) return raw.banks;
    return [];
  }

  /**
   * Resolve account holder name before registering a destination.
   * Docs: POST /v1/misc/bank-accounts/resolve
   */
  async resolveBankAccount(input: {
    bank_code: string;
    account_number: string;
    currency?: string;
    country?: string;
  }): Promise<BachsResolveAccountResponse> {
    return this.request<BachsResolveAccountResponse>(
      'POST',
      '/misc/bank-accounts/resolve',
      {
        body: {
          bank_code: input.bank_code,
          account_number: input.account_number,
          country: input.country ?? 'NG',
        },
        expectedStatuses: [200, 201],
      },
    );
  }

  async createPayoutDestination(
    body: BachsCreatePayoutDestinationBody,
    idempotencyKey: string,
  ): Promise<BachsPayoutDestinationResponse> {
    return this.request<BachsPayoutDestinationResponse>(
      'POST',
      '/payouts/destinations',
      {
        body,
        idempotencyKey,
        expectedStatuses: [200, 201],
      },
    );
  }

  async createPayout(
    body: BachsCreatePayoutBody,
    idempotencyKey: string,
  ): Promise<BachsPayoutResponse> {
    return this.request<BachsPayoutResponse>('POST', '/payouts', {
      body,
      idempotencyKey,
      expectedStatuses: [200, 201],
    });
  }

  async getPayout(payoutId: string): Promise<BachsPayoutResponse> {
    return this.request<BachsPayoutResponse>(
      'GET',
      `/payouts/${encodeURIComponent(payoutId)}`,
      { expectedStatuses: [200] },
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: {
      body?: unknown;
      idempotencyKey?: string;
      expectedStatuses: number[];
      accountId?: string;
    },
  ): Promise<T> {
    this.assertKeyMatchesBaseUrl();
    const url = `${this.baseUrl()}${BACHS_API_VERSION_PREFIX}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey()}`,
      Accept: 'application/json',
    };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (opts.idempotencyKey) {
      headers['Idempotency-Key'] = opts.idempotencyKey;
    }
    if (opts.accountId) {
      headers['X-Account-Id'] = opts.accountId;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(BACHS_REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError');
      console.error(
        `Bachs ${method} ${path} ${isTimeout ? 'timeout' : 'network_error'}`,
      );
      throw new BachsProviderError(
        isTimeout ? 'TIMEOUT' : 'NETWORK',
        isTimeout ? 'Bachs request timed out' : 'Bachs network error',
        { cause: err },
      );
    }

    if (!opts.expectedStatuses.includes(response.status)) {
      let providerErrorCode: string | undefined;
      let providerDetail: string | undefined;
      try {
        const errBody = (await response.json()) as BachsErrorBody;
        providerErrorCode = errBody.error_code;
        providerDetail =
          typeof errBody.detail === 'string' ? errBody.detail.slice(0, 200) : undefined;
      } catch {
        // ignore parse errors
      }
      console.error(
        `Bachs ${method} ${path} status=${response.status} code=${providerErrorCode ?? 'none'} detail=${providerDetail ?? 'none'}`,
      );
      throw new BachsProviderError(
        mapHttpStatusToKind(response.status),
        `Bachs API error (${response.status})`,
        { httpStatus: response.status, providerErrorCode },
      );
    }

    return (await response.json()) as T;
  }
}
