import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const respondSchema = z.object({
  action: z.enum(["accept", "reject", "counter"]),
  counter_terms: z
    .object({
      from_a: z.object({ target_url: z.string().url(), anchor_text: z.string().min(1) }),
      from_b: z.object({ target_url: z.string().url(), anchor_text: z.string().min(1) }),
      notes: z.string().optional(),
    })
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: match } = await supabase
    .from("exchange_matches")
    .select("*, site_a:site_a_id(id, owner_id, turnaround_hours), site_b:site_b_id(id, owner_id, turnaround_hours)")
    .eq("id", matchId)
    .single();

  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const siteA = match.site_a as unknown as { id: string; owner_id: string; turnaround_hours: number };
  const siteB = match.site_b as unknown as { id: string; owner_id: string; turnaround_hours: number };
  const isOwnerA = siteA.owner_id === user.id;
  const isOwnerB = siteB.owner_id === user.id;

  if (!isOwnerA && !isOwnerB) {
    return NextResponse.json({ error: "Not your proposal to respond to" }, { status: 403 });
  }
  // Only the receiving side (not the one who proposed/countered last) can act.
  if (match.initiated_by === user.id && match.status !== "countered") {
    return NextResponse.json({ error: "Waiting on the other party" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    await supabase.from("exchange_matches").update({ status: "rejected" }).eq("id", matchId);
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "counter") {
    if (!parsed.data.counter_terms) {
      return NextResponse.json({ error: "Counter terms required" }, { status: 400 });
    }
    await supabase
      .from("exchange_matches")
      .update({
        status: "countered",
        counter_terms: parsed.data.counter_terms,
        initiated_by: user.id,
      })
      .eq("id", matchId);
    return NextResponse.json({ ok: true });
  }

  // action === "accept"
  const terms = (match.counter_terms ?? match.proposed_terms) as {
    from_a: { target_url: string; anchor_text: string };
    from_b: { target_url: string; anchor_text: string };
    notes?: string;
  };

  const now = new Date();
  const deadlineA = new Date(now.getTime() + (siteA.turnaround_hours ?? 48) * 3600 * 1000);
  const deadlineB = new Date(now.getTime() + (siteB.turnaround_hours ?? 48) * 3600 * 1000);

  // Order 1: site B owner delivers a link (on site B) pointing to site A's target.
  const { data: orderForA, error: err1 } = await supabase
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
  const { data: orderForB, error: err2 } = await supabase
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
    return NextResponse.json(
      { error: err1?.message ?? err2?.message ?? "Could not create exchange orders" },
      { status: 500 }
    );
  }

  await supabase
    .from("exchange_matches")
    .update({
      status: "accepted",
      resulting_order_a: orderForB.id, // order where site A delivers
      resulting_order_b: orderForA.id, // order where site B delivers
    })
    .eq("id", matchId);

  return NextResponse.json({ ok: true, orderIds: [orderForA.id, orderForB.id] });
}
