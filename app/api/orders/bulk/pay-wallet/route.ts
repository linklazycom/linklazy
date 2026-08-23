import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  site_ids: z.array(z.string().uuid()).min(1).max(10),
  target_url: z.string().url(),
  anchor_text: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Wallet-funded counterpart to /api/orders/bulk. Instead of creating
 * pending_payment orders that each need a separate bKash/PayPal redirect,
 * this charges the buyer's wallet_balance and places every order in one
 * atomic step via place_bulk_order_with_wallet (see sql/2026-08-*.sql).
 *
 * Used by:
 *  - the manual bulk-order review page, when the buyer picks "Pay with wallet"
 *  - the site-scan auto-order flow (called server-to-server, see /api/buyer-scan)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before paying for an order." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { site_ids, target_url, anchor_text, notes } = parsed.data;

  // Service client needed because the RPC is security definer and writes
  // across profiles/orders/payments/wallet_ledger in one transaction.
  const service = createServiceClient();
  const { data, error } = await service
    .rpc("place_bulk_order_with_wallet", {
      p_buyer_id: user.id,
      p_site_ids: site_ids,
      p_target_url: target_url,
      p_anchor_text: anchor_text,
      p_notes: notes ?? null,
    })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as {
    ok: boolean;
    error: string | null;
    created_order_ids: string[];
    skipped: { domain: string; reason: string }[];
    new_balance: number;
  };

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not place order." }, { status: 402 });
  }

  // Fetch domains for the created orders so the client can render the
  // same "created / skipped" summary shape as /api/orders/bulk.
  const { data: createdSites } = await supabase
    .from("orders")
    .select("id, site_id, sites!orders_site_id_fkey(domain)")
    .in("id", result.created_order_ids);

  const created = (createdSites ?? []).map((o) => ({
    id: o.id,
    domain: (o.sites as unknown as { domain: string } | null)?.domain ?? o.site_id,
  }));

  if (created.length > 0) {
    revalidatePath("/dashboard/orders");
    revalidatePath("/admin/orders");
  }

  return NextResponse.json({
    created,
    skipped: result.skipped,
    newBalance: result.new_balance,
  });
}
