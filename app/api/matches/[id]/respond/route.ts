import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { counterTermsSchema } from "@/lib/validators/match";
import { checkResponder } from "@/lib/match-flow";

const respondSchema = z.object({
  action: z.enum(["accept", "reject", "counter"]),
  counter_terms: counterTermsSchema.optional(),
});

/**
 * SECURITY (Batch 7C): all reads/writes go through the server client after an
 * explicit ownership + state check. Earlier this used the browser-level client,
 * which (a) could not see the other party's site once `sites` was locked down
 * and (b) could no longer insert orders (SQL 025). Accepting is now claimed
 * with a status guard so a double click cannot create the orders twice.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const { data: match } = await service
    .from("exchange_matches")
    .select("id, status, initiated_by, proposed_terms, counter_terms, site_a_id, site_b_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sites } = await service
    .from("sites")
    .select("id, owner_id, status, accepts_exchange, turnaround_hours")
    .in("id", [match.site_a_id, match.site_b_id]);
  const siteA = sites?.find((s) => s.id === match.site_a_id);
  const siteB = sites?.find((s) => s.id === match.site_b_id);
  if (!siteA || !siteB) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const check = checkResponder(match, user.id, siteA.owner_id, siteB.owner_id);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json().catch(() => null);
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { action, counter_terms } = parsed.data;

  // Every transition below only applies if the status is still what we just read.
  const guarded = (patch: Record<string, unknown>) =>
    service.from("exchange_matches").update(patch).eq("id", matchId).eq("status", match.status).select("id");

  if (action === "reject") {
    const { data } = await guarded({ status: "rejected" });
    if (!data?.length) return NextResponse.json({ error: "This proposal just changed. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (action === "counter") {
    if (!counter_terms) return NextResponse.json({ error: "Counter terms required" }, { status: 400 });
    const { data } = await guarded({ status: "countered", counter_terms, initiated_by: user.id });
    if (!data?.length) return NextResponse.json({ error: "This proposal just changed. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  // action === "accept"
  if (siteA.status !== "approved" || siteB.status !== "approved" || !siteA.accepts_exchange || !siteB.accepts_exchange) {
    return NextResponse.json({ error: "One of the sites is no longer available for exchange" }, { status: 400 });
  }

  const terms = (match.counter_terms ?? match.proposed_terms) as {
    from_a: { target_url: string; anchor_text: string };
    from_b: { target_url: string; anchor_text: string };
    notes?: string;
  };

  // Claim first (prevents double orders), create orders second, undo the claim on failure.
  const { data: claimed } = await guarded({ status: "accepted" });
  if (!claimed?.length) {
    return NextResponse.json({ error: "This proposal just changed. Refresh and try again." }, { status: 409 });
  }

  const now = Date.now();
  const deadlineA = new Date(now + (siteA.turnaround_hours ?? 48) * 3600 * 1000);
  const deadlineB = new Date(now + (siteB.turnaround_hours ?? 48) * 3600 * 1000);

  // Order 1: site B owner delivers a link (on site B) pointing to site A's target.
  const { data: orderForA, error: err1 } = await service
    .from("orders")
    .insert({
      buyer_id: siteA.owner_id,
      seller_id: siteB.owner_id,
      site_id: siteB.id,
      buyer_site_id: siteA.id,
      order_type: "exchange",
      status: "in_progress",
      target_url: terms.from_a.target_url,
      anchor_text: terms.from_a.anchor_text,
      notes: terms.notes,
      deadline_at: deadlineB.toISOString(),
    })
    .select("id")
    .single();

  // Order 2: site A owner delivers a link (on site A) pointing to site B's target.
  const { data: orderForB, error: err2 } = await service
    .from("orders")
    .insert({
      buyer_id: siteB.owner_id,
      seller_id: siteA.owner_id,
      site_id: siteA.id,
      buyer_site_id: siteB.id,
      order_type: "exchange",
      status: "in_progress",
      target_url: terms.from_b.target_url,
      anchor_text: terms.from_b.anchor_text,
      notes: terms.notes,
      deadline_at: deadlineA.toISOString(),
    })
    .select("id")
    .single();

  if (err1 || err2 || !orderForA || !orderForB) {
    // Undo: remove whichever order did get created and re-open the proposal.
    const created = [orderForA?.id, orderForB?.id].filter(Boolean) as string[];
    if (created.length) await service.from("orders").delete().in("id", created);
    await service.from("exchange_matches").update({ status: match.status }).eq("id", matchId).eq("status", "accepted");
    return NextResponse.json({ error: "Could not create the exchange orders. Please try again." }, { status: 500 });
  }

  await service
    .from("exchange_matches")
    .update({
      resulting_order_a: orderForB.id, // order where site A delivers
      resulting_order_b: orderForA.id, // order where site B delivers
    })
    .eq("id", matchId);

  return NextResponse.json({ ok: true, orderIds: [orderForA.id, orderForB.id] });
}
