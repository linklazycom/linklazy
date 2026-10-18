import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { createClient } from "@/lib/supabase/server";
import { isUsageAction } from "@/lib/usage/actions";
import { buildQuote } from "@/lib/usage/pricing";
import { getUsagePricing } from "@/lib/usage/server";

/** What the next use of an action costs this user, so the price is shown BEFORE they pay. Read-only. */
export async function GET(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;

  const action = new URL(request.url).searchParams.get("action");
  if (!isUsageAction(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const pricing = await getUsagePricing();
  if (gate.ctx.isAdmin) {
    return NextResponse.json({ quote: { charging: false, price: pricing.actions[action].price, freePerDay: 0, freeLeftToday: 0, nextUseCosts: false, balance: null } });
  }

  const supabase = await createClient();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [{ count }, { data: profile }] = await Promise.all([
    supabase
      .from("usage_charges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", gate.ctx.userId)
      .eq("action", action)
      .in("status", ["charged", "free"])
      .gte("created_at", dayStart.toISOString()),
    supabase.from("profiles").select("wallet_balance").eq("id", gate.ctx.userId).single(),
  ]);
  return NextResponse.json({ quote: buildQuote(pricing, action, count ?? 0, typeof profile?.wallet_balance === "number" ? profile.wallet_balance : null) });
}
