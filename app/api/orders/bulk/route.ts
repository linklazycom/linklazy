import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bulkOrderSchema = z.object({
  site_ids: z.array(z.string().uuid()).min(1).max(10),
  target_url: z.string().url(),
  anchor_text: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Bulk order is paid-only (order_type fixed to "paid") — exchange orders
 * need a per-site buyer_site_id pick, which doesn't fit a single shared
 * form well. Same target_url/anchor_text/notes gets applied to every
 * selected site; each becomes its own order row so sellers see and manage
 * them individually, same as a normal single order.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = bulkOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { site_ids, target_url, anchor_text, notes } = parsed.data;

  const { data: sites } = await supabase
    .from("sites")
    .select("id, owner_id, status, price_amount, turnaround_hours, accepts_paid, domain")
    .in("id", site_ids);

  const { data: setting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "commission_rate_default")
    .single();
  const commissionRate = Number(setting?.value ?? 17.5);

  const created: { id: string; domain: string }[] = [];
  const skipped: { domain: string; reason: string }[] = [];

  for (const siteId of site_ids) {
    const site = sites?.find((s) => s.id === siteId);

    if (!site || site.status !== "approved") {
      skipped.push({ domain: site?.domain ?? siteId, reason: "Site not available" });
      continue;
    }
    if (site.owner_id === user.id) {
      skipped.push({ domain: site.domain, reason: "You own this site" });
      continue;
    }
    if (!site.accepts_paid) {
      skipped.push({ domain: site.domain, reason: "Doesn't accept paid orders" });
      continue;
    }

    const commissionAmount = site.price_amount
      ? Math.round((site.price_amount * commissionRate) / 100)
      : 0;
    const deadline = new Date(Date.now() + (site.turnaround_hours ?? 48) * 3600 * 1000);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: site.owner_id,
        site_id: site.id,
        order_type: "paid",
        status: "pending_payment",
        target_url,
        anchor_text,
        notes,
        price_amount: site.price_amount,
        commission_amount: commissionAmount,
        commission_rate: commissionRate,
        deadline_at: deadline.toISOString(),
      })
      .select("id")
      .single();

    if (error || !order) {
      skipped.push({ domain: site.domain, reason: error?.message ?? "Could not create order" });
      continue;
    }

    created.push({ id: order.id, domain: site.domain });
  }

  return NextResponse.json({ created, skipped });
}
