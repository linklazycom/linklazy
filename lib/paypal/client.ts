function env(key: string) { const value = process.env[key]; if (!value) throw new Error(`Missing required env var: ${key}`); return value; }
const base = () => process.env.PAYPAL_BASE_URL ?? "https://api-m.sandbox.paypal.com";
async function token() { const response = await fetch(`${base()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_CLIENT_SECRET")}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" }); if (!response.ok) throw new Error(`PayPal authentication failed: ${response.status}`); return (await response.json() as { access_token: string }).access_token; }
export async function createPaypalOrder({ amount, reference, returnUrl, cancelUrl }: { amount: number; reference: string; returnUrl: string; cancelUrl: string }) { const response = await fetch(`${base()}/v2/checkout/orders`, { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", "PayPal-Request-Id": reference }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: reference, amount: { currency_code: "USD", value: amount.toFixed(2) } }], application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: "PAY_NOW" } }) }); if (!response.ok) throw new Error(`PayPal order creation failed: ${response.status}`); const data = await response.json() as { id: string; links: { rel: string; href: string }[] }; const approvalUrl = data.links.find((link) => link.rel === "approve")?.href; if (!approvalUrl) throw new Error("PayPal did not return an approval link"); return { id: data.id, approvalUrl }; }
export async function capturePaypalOrder(id: string) { const response = await fetch(`${base()}/v2/checkout/orders/${id}/capture`, { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", "PayPal-Request-Id": id } }); if (!response.ok) throw new Error(`PayPal capture failed: ${response.status}`); return response.json() as Promise<PaypalCapture>; }

export type PaypalCapture = {
  status: string;
  purchase_units?: {
    payments?: { captures?: { status?: string; amount?: { value?: string; currency_code?: string } }[] };
  }[];
};

/** Sum of COMPLETED capture amounts (USD) in a PayPal capture response. */
export function paypalCapturedUsd(capture: PaypalCapture): number {
  let total = 0;
  for (const unit of capture.purchase_units ?? []) {
    for (const c of unit.payments?.captures ?? []) {
      if (c.status === "COMPLETED" && (c.amount?.currency_code ?? "USD") === "USD") {
        total += Number(c.amount?.value ?? 0);
      }
    }
  }
  return total;
}

export type PaypalWebhookHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

/** Asks PayPal whether a webhook call is genuine (needs PAYPAL_WEBHOOK_ID). Any error counts as "not verified". */
export async function verifyPaypalWebhook(headers: PaypalWebhookHeaders, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  try {
    const response = await fetch(`${base()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { verification_status?: string };
    return data.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
