/** Pure helpers for the PayPal backup webhook (PAYMENT.CAPTURE.COMPLETED). Tested in tests/paypal-events.test.ts. */
export interface CaptureCompleted {
  paypalOrderId: string;
  usd: number;
  currency: string;
}

/** Reads a PAYMENT.CAPTURE.COMPLETED event; returns null for any other or malformed event. */
export function parseCaptureCompleted(event: unknown): CaptureCompleted | null {
  const e = event as {
    event_type?: unknown;
    resource?: {
      status?: unknown;
      amount?: { value?: unknown; currency_code?: unknown };
      supplementary_data?: { related_ids?: { order_id?: unknown } };
    };
  } | null;
  if (!e || e.event_type !== "PAYMENT.CAPTURE.COMPLETED") return null;
  const r = e.resource;
  if (!r || r.status !== "COMPLETED") return null;
  const orderId = r.supplementary_data?.related_ids?.order_id;
  const value = Number(r.amount?.value);
  const currency = r.amount?.currency_code;
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{5,64}$/.test(orderId)) return null;
  if (!Number.isFinite(value) || value <= 0 || typeof currency !== "string") return null;
  return { paypalOrderId: orderId, usd: value, currency };
}

/** The captured money must be USD and at least the amount we asked for (same tolerance as the browser callback). */
export function captureCoversPayment(capture: CaptureCompleted, expectedUsd: number): boolean {
  return capture.currency === "USD" && capture.usd + 0.009 >= Number(expectedUsd);
}
