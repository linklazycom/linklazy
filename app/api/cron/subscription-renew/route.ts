import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";

// This route loops sequentially over many items with external API/email
// calls per item, which can exceed Vercel's default serverless timeout
// and get killed mid-batch (silent partial completion). Requires a plan
// that supports extended function duration (Vercel Pro or higher).
export const maxDuration = 300;

/**
 * Daily job covering the subscription lifecycle:
 *  - 3 days before expiry: send a renewal reminder email
 *  - on/after expiry: mark the subscription "expired" and downgrade the
 *    account (buyer -> free plan with 0 quota; seller -> commission plan)
 *
 * NOTE: this does NOT auto-charge for renewal. bKash's Tokenized Checkout
 * API used elsewhere in this app is a one-time-payment flow; recurring
 * auto-billing would require bKash's separate Agreement/Tokenization API,
 * which needs its own merchant approval and isn't wired up yet. Until
 * that's added, renewal is manual — the person re-subscribes from
 * /dashboard/billing, same as a first-time purchase.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();
  const reminderWindow = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

  // --- Renewal reminders (3 days out, active subscriptions only) ---
  const { data: expiringSoon } = await supabase
    .from("subscriptions")
    .select("id, user_id, type, current_period_end")
    .eq("status", "active")
    .eq("auto_renew", false) // auto_renew=true would be handled by real billing once that exists
    .lte("current_period_end", reminderWindow.toISOString())
    .gt("current_period_end", now.toISOString());

  let reminded = 0;
  for (const sub of expiringSoon ?? []) {
    const { data: authUser } = await supabase.auth.admin.getUserById(sub.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;

    const result = await sendEmail({
      to: email,
      subject: "Your LinkLazy plan renews soon",
      html: `
        <p>Your ${sub.type.replace("_", " ")} plan ends on
        ${new Date(sub.current_period_end).toLocaleDateString()}.</p>
        <p><a href="${siteUrl}/dashboard/billing">Renew your plan</a> to avoid losing access.</p>
      `,
    });
    if (result.ok) reminded++;
  }

  // --- Expiry handling ---
  const { data: expired } = await supabase
    .from("subscriptions")
    .select("id, user_id, type")
    .eq("status", "active")
    .lte("current_period_end", now.toISOString());

  let downgraded = 0;
  for (const sub of expired ?? []) {
    await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);

    if (sub.type.startsWith("buyer_")) {
      await supabase
        .from("profiles")
        .update({ buyer_plan: "free", buyer_views_quota: 0, buyer_views_used: 0 })
        .eq("id", sub.user_id);
    } else if (sub.type === "seller_monthly") {
      await supabase.from("profiles").update({ seller_plan: "commission" }).eq("id", sub.user_id);
    }
    downgraded++;
  }

  return NextResponse.json({ reminded, downgraded });
}
