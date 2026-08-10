import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";

/**
 * Daily job: for every accepted order, re-fetch the seller's proof_url and
 * confirm the buyer's target_url is still linked from it (a crude but
 * effective check — look for the URL string in the page HTML). If a link
 * that was previously live disappears, we record it and email the buyer
 * so they have evidence for a dispute if they want one; we don't auto-open
 * a dispute since a temporary CMS hiccup shouldn't trigger one automatically.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data: orders } = await supabase
    .from("orders")
    .select("id, proof_url, target_url, buyer_id, last_link_check_ok")
    .eq("status", "accepted")
    .not("proof_url", "is", null)
    .limit(200); // batch size per run; re-runs daily so this catches up over time

  if (!orders?.length) return NextResponse.json({ checked: 0, stillLive: 0, wentDown: 0 });

  let stillLive = 0;
  let wentDown = 0;

  for (const order of orders) {
    const wasOk = order.last_link_check_ok;
    let isOk = false;

    try {
      const res = await fetch(order.proof_url!, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const html = await res.text();
        isOk = html.includes(order.target_url);
      }
    } catch {
      isOk = false;
    }

    await supabase
      .from("orders")
      .update({ last_link_check_at: new Date().toISOString(), last_link_check_ok: isOk })
      .eq("id", order.id);

    if (isOk) {
      stillLive++;
    } else {
      wentDown++;
      // Only notify on the transition from "was fine" to "now missing" —
      // avoids repeat emails every day for a link the buyer already knows about.
      if (wasOk !== false) {
        const { data: authUser } = await supabase.auth.admin.getUserById(order.buyer_id);
        const email = authUser?.user?.email;
        if (email) {
          await sendEmail({
            to: email,
            subject: "A backlink you ordered may have been removed",
            html: `
              <p>We checked <a href="${order.proof_url}">${order.proof_url}</a> and couldn't
              find your link to ${order.target_url} anymore.</p>
              <p>This could be a temporary issue on the seller's site, or the link may have
              been removed. You can view the order and open a dispute if needed:</p>
              <p><a href="${siteUrl}/dashboard/orders/${order.id}">View order</a></p>
            `,
          });
        }
      }
    }
  }

  return NextResponse.json({ checked: orders.length, stillLive, wentDown });
}
