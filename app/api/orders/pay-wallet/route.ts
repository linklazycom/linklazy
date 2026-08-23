import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  site_id: z.string().uuid(),
  target_url: z.string().url(),
  anchor_text: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Single-site counterpart to /api/orders/bulk/pay-wallet — same atomic
 * place_bulk_order_with_wallet RPC underneath (it already accepts any
 * number of site_ids, including one), so a "Pay from wallet" checkout on
 * a single site detail page doesn't need its own RPC. The order is
 * charged and created in one step — no pending_payment / bKash-PayPal
 * redirect needed, since the wallet balance covers it immediately.
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
  const { site_id, target_url, anchor_text, notes } = parsed.data;

  const service = createServiceClient();
  const { data, error } = await service
    .rpc("place_bulk_order_with_wallet", {
      p_buyer_id: user.id,
      p_site_ids: [site_id],
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

  if (!result.ok || result.created_order_ids.length === 0) {
    const skipReason = result.skipped[0]?.reason;
    return NextResponse.json(
      { error: result.error ?? skipReason ?? "Could not place this order." },
      { status: 402 }
    );
  }

  // Without this, Next's client-side Router Cache can keep serving the
  // pre-order snapshot of /dashboard/orders (and the admin mirror of it)
  // for up to a few minutes after a soft navigation, so a just-placed
  // order can look like it "didn't go through" even though it did.
  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");

  return NextResponse.json({
    id: result.created_order_ids[0],
    newBalance: result.new_balance,
  });
}
