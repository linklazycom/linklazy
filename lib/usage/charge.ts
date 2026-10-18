import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { decideCharge, type UsagePricing } from "@/lib/usage/pricing";
import { money, type UsageActionId } from "@/lib/usage/actions";
import { getUsagePricing } from "@/lib/usage/server";

/**
 * Wallet charging for paid actions (Batch 14). All money movement happens inside the database
 * functions usage_charge_debit / usage_charge_refund (SQL 042), which call the existing atomic
 * adjust_wallet_balance. This file only decides WHAT to charge (server-side prices; a client-sent
 * price is never used to charge) and turns results into messages.
 *
 * Tested in tests/usage-charge.test.ts with a fake database.
 */
export interface UsageCtx {
  userId: string;
  isAdmin: boolean;
}

export interface ChargeOptions {
  /** One value per user action (e.g. a UUID made when the button is clicked). Re-sending it never charges twice. */
  requestId?: string | null;
  /** The price the user saw. If the real price is higher the request is refused so nobody pays more than they were shown. */
  expectedPrice?: number | null;
}

export type ChargeOk = {
  ok: true;
  /** null when nothing was recorded (charging off, price 0, or an admin). */
  chargeId: string | null;
  /** Wallet units taken (0 when free). */
  amount: number;
  free: boolean;
  /** The list price at the time. */
  price: number;
};

export type ChargeFail = {
  ok: false;
  status: 400 | 402 | 409 | 500;
  code: "insufficient" | "duplicate" | "price_changed" | "invalid_request" | "failed";
  error: string;
  price?: number;
};

export type RpcFn = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export interface ChargeDeps {
  rpc?: RpcFn;
  pricing?: () => Promise<UsagePricing>;
  newKey?: () => string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isRequestId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const defaultRpc: RpcFn = (fn, args) => createServiceClient().rpc(fn, args);

type DebitRow = { r_ok: boolean; r_code: string | null; r_message: string | null; r_charge_id: string | null; r_charged: number; r_is_free: boolean };

export async function chargeUsage(ctx: UsageCtx, action: UsageActionId, opts: ChargeOptions = {}, deps: ChargeDeps = {}): Promise<ChargeOk | ChargeFail> {
  const pricing = await (deps.pricing ?? getUsagePricing)();
  const d = decideCharge(pricing, action);

  // Admins, switched-off charging and price 0 never touch the wallet.
  if (ctx.isAdmin || !d.charge) return { ok: true, chargeId: null, amount: 0, free: true, price: d.price };

  if (opts.expectedPrice !== undefined && opts.expectedPrice !== null && opts.expectedPrice < d.price) {
    return { ok: false, status: 409, code: "price_changed", price: d.price, error: `The price changed to ${money(d.price)}. Please review it and try again.` };
  }
  if (opts.requestId !== undefined && opts.requestId !== null && !isRequestId(opts.requestId)) {
    return { ok: false, status: 400, code: "invalid_request", error: "Invalid request." };
  }
  const key = opts.requestId ?? (deps.newKey ?? randomUUID)();

  let res;
  try {
    res = await (deps.rpc ?? defaultRpc)("usage_charge_debit", { p_user_id: ctx.userId, p_action: action, p_amount: d.price, p_key: key, p_free_per_day: d.freePerDay });
  } catch {
    return { ok: false, status: 500, code: "failed", error: "Could not process the payment. You were not charged." };
  }
  const row = Array.isArray(res.data) ? (res.data[0] as DebitRow | undefined) : undefined;
  if (res.error || !row) {
    console.error("usage_charge_debit failed:", res.error?.message ?? "no result");
    return { ok: false, status: 500, code: "failed", error: "Could not process the payment. You were not charged." };
  }
  if (row.r_ok) return { ok: true, chargeId: row.r_charge_id, amount: row.r_charged, free: row.r_is_free, price: d.price };

  switch (row.r_code) {
    case "duplicate":
      return { ok: false, status: 409, code: "duplicate", error: "This request was already processed. You were not charged again." };
    case "insufficient":
      return { ok: false, status: 402, code: "insufficient", price: d.price, error: `Not enough wallet balance. This costs ${money(d.price)}.` };
    case "invalid":
      return { ok: false, status: 400, code: "invalid_request", error: "Invalid request." };
    default:
      console.error("usage_charge_debit refused:", row.r_message);
      return { ok: false, status: 500, code: "failed", error: "Could not process the payment. You were not charged." };
  }
}

/** Gives a charge back (money, or the free use). Safe to call twice. Returns false only if the refund itself failed. */
export async function refundUsage(chargeId: string | null, reason: string, deps: Pick<ChargeDeps, "rpc"> = {}): Promise<boolean> {
  if (!chargeId) return true;
  try {
    const res = await (deps.rpc ?? defaultRpc)("usage_charge_refund", { p_charge_id: chargeId, p_reason: reason.slice(0, 200) });
    const row = Array.isArray(res.data) ? (res.data[0] as { r_ok: boolean; r_message: string | null } | undefined) : undefined;
    if (res.error || !row?.r_ok) {
      // Never swallow silently: Admin > Usage pricing lists unrefunded charges so support can fix them.
      console.error("usage_charge_refund failed for", chargeId, res.error?.message ?? row?.r_message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("usage_charge_refund threw for", chargeId, err instanceof Error ? err.message : "unknown");
    return false;
  }
}
