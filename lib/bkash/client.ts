/**
 * Thin wrapper around bKash's Tokenized Checkout API.
 * Docs: https://developer.bka.sh/docs/tokenized-checkout-url-issuance
 *
 * Requires these env vars (set in Vercel, never commit real values):
 *   BKASH_BASE_URL      e.g. https://tokenized.pay.bka.sh/v1.2.0-beta (sandbox)
 *   BKASH_APP_KEY
 *   BKASH_APP_SECRET
 *   BKASH_USERNAME
 *   BKASH_PASSWORD
 */

interface GrantTokenResponse {
  id_token: string;
  refresh_token: string;
  expires_in: number;
}

interface CreatePaymentResponse {
  paymentID: string;
  bkashURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
}

interface ExecutePaymentResponse {
  paymentID: string;
  trxID: string;
  transactionStatus: string;
  amount: string;
  currency: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGrantToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const baseUrl = requireEnv("BKASH_BASE_URL");
  const res = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: requireEnv("BKASH_USERNAME"),
      password: requireEnv("BKASH_PASSWORD"),
    },
    body: JSON.stringify({
      app_key: requireEnv("BKASH_APP_KEY"),
      app_secret: requireEnv("BKASH_APP_SECRET"),
    }),
  });

  if (!res.ok) throw new Error(`bKash grant token failed: ${res.status}`);
  const data = (await res.json()) as GrantTokenResponse;

  cachedToken = {
    token: data.id_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.id_token;
}

async function authedFetch(path: string, body: unknown) {
  const baseUrl = requireEnv("BKASH_BASE_URL");
  const token = await getGrantToken();

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "X-App-Key": requireEnv("BKASH_APP_KEY"),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`bKash request to ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Starts a checkout session. Returns the bKash-hosted URL to redirect the buyer to. */
export async function createBkashPayment(params: {
  amount: number; // in BDT, decimal e.g. 1200.00
  orderId: string;
  callbackURL: string;
}): Promise<CreatePaymentResponse> {
  return authedFetch("/tokenized/checkout/create", {
    mode: "0011",
    payerReference: params.orderId,
    callbackURL: params.callbackURL,
    amount: params.amount.toFixed(2),
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: params.orderId,
  }) as Promise<CreatePaymentResponse>;
}

/** Finalizes payment after the buyer approves it on bKash's hosted page. */
export async function executeBkashPayment(paymentID: string): Promise<ExecutePaymentResponse> {
  return authedFetch("/tokenized/checkout/execute", { paymentID }) as Promise<ExecutePaymentResponse>;
}

/** Queries the current status of a payment (used for reconciliation/support). */
export async function queryBkashPayment(paymentID: string): Promise<ExecutePaymentResponse> {
  return authedFetch("/tokenized/checkout/payment/status", { paymentID }) as Promise<ExecutePaymentResponse>;
}
