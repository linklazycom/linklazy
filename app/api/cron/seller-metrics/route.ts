import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// This route loops sequentially over many items with external API/email
// calls per item, which can exceed Vercel's default serverless timeout
// and get killed mid-batch (silent partial completion). Requires a plan
// that supports extended function duration (Vercel Pro or higher).
export const maxDuration = 300;

const FINISHED_STATUSES = ["accepted", "disputed", "refunded"];

/**
 * Weekly job: recompute trust badges for every seller with at least one
 * finished order. Runs per-seller in a simple loop (not a giant SQL
 * aggregate) so a bug in one seller's data can't take down the whole run —
 * catalog size here doesn't call for anything fancier yet.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: sellers } = await supabase.from("profiles").select("id").eq("role", "seller");
  if (!sellers?.length) return NextResponse.json({ updated: 0 });

  let updated = 0;

  for (const seller of sellers) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!orders?.length) continue;

    const finished = orders.filter((o) => FINISHED_STATUSES.includes(o.status));
    const completed = finished.filter((o) => o.status === "accepted");
    const disputed = finished.filter((o) => o.status === "disputed");

    const completionRate = finished.length ? completed.length / finished.length : null;
    const disputeRate = finished.length ? disputed.length / finished.length : null;

    // Average hours to the seller's first message on each order.
    const responseTimes: number[] = [];
    for (const order of orders) {
      const { data: firstMsg } = await supabase
        .from("messages")
        .select("created_at")
        .eq("order_id", order.id)
        .eq("sender_id", seller.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstMsg) {
        const hours =
          (new Date(firstMsg.created_at).getTime() - new Date(order.created_at).getTime()) /
          3_600_000;
        if (hours >= 0) responseTimes.push(hours);
      }
    }
    const avgResponseHours = responseTimes.length
      ? responseTimes.reduce((sum, h) => sum + h, 0) / responseTimes.length
      : null;

    await supabase
      .from("profiles")
      .update({
        completion_rate: completionRate,
        avg_response_hours: avgResponseHours,
        dispute_rate: disputeRate,
        completed_order_count: completed.length,
        metrics_updated_at: new Date().toISOString(),
      })
      .eq("id", seller.id);

    updated++;
  }

  return NextResponse.json({ updated });
}
