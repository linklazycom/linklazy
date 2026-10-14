import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { creditWalletRefund } from "@/lib/wallet-refund";
import { canTransition } from "@/lib/withdrawal-flow";

const updateSchema = z.object({
  status: z.enum(["approved", "rejected", "paid"]),
  admin_note: z.string().trim().max(500).optional(),
});

/**
 * Moves a withdrawal request forward. Rules (Batch 8):
 *  - only pending -> approved/rejected and approved -> paid/rejected are allowed
 *    ("paid" and "rejected" are final; a rejected request can never be approved later)
 *  - the status change is claimed atomically, so two clicks cannot run it twice
 *  - rejecting gives back the part that was taken out of the wallet when the
 *    request was made (wallet_reserved); the referral part frees itself
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });

  const service = createServiceClient();
  const { data: req } = await service
    .from("withdrawal_requests")
    .select("id, user_id, amount, status, wallet_reserved")
    .eq("id", id)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = parsed.data.status;
  if (!canTransition(req.status as string, target)) {
    return NextResponse.json(
      { error: `A ${req.status} request cannot be marked ${target}.` },
      { status: 409 }
    );
  }

  const { data: claimed, error } = await service
    .from("withdrawal_requests")
    .update({
      status: target,
      admin_note: parsed.data.admin_note,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", req.status)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "This request was just updated. Refresh and try again." }, { status: 409 });
  }

  if (target === "rejected") {
    const reserved = Number(req.wallet_reserved ?? 0);
    if (reserved > 0) {
      const { error: refundError } = await creditWalletRefund(service, {
        userId: req.user_id as string,
        amount: reserved,
        notes: "Withdrawal request rejected - reserved amount returned",
      });
      if (refundError) {
        // Nothing was returned, so put the request back and let the admin retry.
        await service
          .from("withdrawal_requests")
          .update({ status: req.status, processed_at: null })
          .eq("id", id)
          .eq("status", "rejected");
        return NextResponse.json({ error: "Could not return the reserved amount. Please try again." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, refunded: reserved });
    }
    if (req.wallet_reserved === null) {
      return NextResponse.json({
        ok: true,
        refunded: 0,
        warning:
          "This request was created before wallet reservations were recorded. Check the wallet ledger and adjust the user's wallet manually if money was reserved.",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
