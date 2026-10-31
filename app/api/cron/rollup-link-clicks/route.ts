import { trackCron } from "@/lib/cron-track";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCron } from "@/lib/cron-auth";
import { getLinkLimits } from "@/lib/links/server";

/**
 * Daily job: summarises click logs older than the retention window
 * (admin setting "link_click_retention_days", default 90) into per-day totals
 * and deletes the raw rows, so the click table stays small. Analytics keep
 * working for the old days because they read the summaries too.
 */
async function handle(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;

  const limits = await getLinkLimits();
  const svc = createServiceClient();
  const { data, error } = await svc.rpc("rollup_link_clicks", { p_keep_days: limits.link_click_retention_days });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, raw_rows_rolled_up: data ?? 0, keep_days: limits.link_click_retention_days });
}

export async function GET(request: Request) {
  return trackCron("rollup-link-clicks", () => handle(request));
}
