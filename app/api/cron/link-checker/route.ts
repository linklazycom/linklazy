import { trackCron } from "@/lib/cron-track";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { requireCron } from "@/lib/cron-auth";
import { checkBacklink, orderVerdict } from "@/lib/backlinks/check";

// This route loops sequentially over many items with external API/email
// calls per item, which can exceed Vercel's default serverless timeout
// and get killed mid-batch (silent partial completion). Requires a plan
// that supports extended function duration (Vercel Pro or higher).
export const maxDuration = 300;

/**
 * Daily job: for every accepted order, re-fetch the seller's proof_url and
 * confirm the buyer's target_url is still linked from it, using the same
 * checker as the Backlink Monitor (lib/backlinks/check.ts). If a link
 * that was previously live disappears, we record it and email the buyer
 * so they have evidence for a dispute if they want one; we don't auto-open
 * a dispute since a temporary CMS hiccup shouldn't trigger one automatically.
 *
 * Only a page that loaded fine and really lacks the link counts as "down".
 * Timeouts, 404/5xx, bot-blocking and pages we could not read leave the
 * order's check state untouched (they used to be reported as a removed link).
 */
async function handle(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;

  const supabase = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data: orders } = await supabase
    .from("orders")
    .select("id, proof_url, target_url, buyer_id, last_link_check_ok")
    .eq("status", "accepted")
    .not("proof_url", "is", null)
    .limit(200); // batch size per run; re-runs daily so this catches up over time

  if (!orders?.length) return NextResponse.json({ checked: 0, stillLive: 0, wentDown: 0, skipped: 0, unverified: 0 });

  let stillLive = 0;
  let wentDown = 0;
  let skipped = 0;
  let unverified = 0;

  for (const order of orders) {
    const wasOk = order.last_link_check_ok;

    // SECURITY (audit R2): proof_url is supplied by the seller; the checker
    // fetches it with safeFetch (blocks internal / private / metadata targets,
    // caps time and size).
    const outcome = await checkBacklink({ sourceUrl: order.proof_url!, targetUrl: order.target_url });
    const verdict = orderVerdict(outcome);
    if (verdict === "skipped") {
      // A URL we refuse to fetch is not evidence the link is gone.
      skipped++;
      continue;
    }
    if (verdict === "unverified") {
      unverified++;
      continue;
    }
    const isOk = verdict === "ok";

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
          const escapeHtml = (s: string) =>
            s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          await sendEmail({
            to: email,
            subject: "A backlink you ordered may have been removed",
            html: `
              <p>We checked <a href="${encodeURI(order.proof_url)}">${escapeHtml(order.proof_url)}</a> and couldn't
              find your link to ${escapeHtml(order.target_url)} anymore.</p>
              <p>This could be a temporary issue on the seller's site, or the link may have
              been removed. You can view the order and open a dispute if needed:</p>
              <p><a href="${siteUrl}/dashboard/orders/${order.id}">View order</a></p>
            `,
          });
        }
      }
    }
  }

  return NextResponse.json({ checked: orders.length, stillLive, wentDown, skipped, unverified });
}

export async function GET(request: Request) {
  return trackCron("link-checker", () => handle(request));
}
