import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";

const BUYER_PLAN_VIEWS: Record<string, number> = {
  free: 0,
  starter: 10,
  growth: 20,
  pro: 50,
};

const schema = z.object({
  buyer_plan: z.enum(["free", "starter", "growth", "pro"]).optional(),
  seller_plan: z.enum(["commission", "monthly"]).nullable().optional(),
  // Admin override for a plan's remaining views this cycle — omit to just
  // reset to the new plan's full quota.
  buyer_views_used: z.number().int().min(0).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.buyer_plan) {
    updates.buyer_plan = parsed.data.buyer_plan;
    updates.buyer_views_quota = BUYER_PLAN_VIEWS[parsed.data.buyer_plan];
    updates.buyer_views_used = parsed.data.buyer_views_used ?? 0;
    // Admin-granted plans renew on a rolling monthly basis from today,
    // same as a fresh bKash subscription would.
    const renews = new Date();
    renews.setMonth(renews.getMonth() + 1);
    updates.buyer_plan_renews_at = renews.toISOString();
  }

  if (parsed.data.seller_plan !== undefined) {
    updates.seller_plan = parsed.data.seller_plan;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "user_subscription_changed",
    target_table: "profiles",
    target_id: targetId,
    metadata: updates,
  });

  return NextResponse.json({ ok: true });
}
