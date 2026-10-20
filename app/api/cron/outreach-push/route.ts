import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron-auth";
import { runOutreachPush } from "@/lib/outreach/push";

export const maxDuration = 120;

/**
 * Optional automatic hand-over (Batch 16B-2). NOT scheduled in vercel.json: the Vercel plan limits how many cron jobs a
 * project may have, so on LinkLazy the batch is sent with the "Send now" button on the Campaigns page. This route stays
 * so a free external scheduler (for example cron-job.org or a GitHub Action) can call it once a day with the header
 * "Authorization: Bearer <CRON_SECRET>". Does nothing unless the master switch is ON.
 */
export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  try {
    const run = await runOutreachPush();
    // "Not ready" (switch off, no campaigns...) is normal, not an error.
    if (!run.ok) return NextResponse.json({ ok: true, skipped: run.error });
    return NextResponse.json({ ok: true, results: run.results });
  } catch (err) {
    console.error("outreach-push cron failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Outreach push failed" }, { status: 500 });
  }
}
