import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron-auth";
import { runDueTasks } from "@/lib/tasks";
import { enqueueDueBacklinkChecks } from "@/lib/backlinks/task";
import { isBacklinkMonitorOn } from "@/lib/backlinks/feature";
import "@/lib/backlinks/register";

// Many sequential page fetches; needs a plan with extended function duration (see cron/link-checker).
export const maxDuration = 300;

/**
 * Daily job: queues a check for every monitored backlink that is due (Backlink Monitor), then
 * runs the task queue (this also picks up any other queued task whose handler is registered).
 */
export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;

  try {
    const monitorOn = await isBacklinkMonitorOn();
    const queued = monitorOn ? await enqueueDueBacklinkChecks(150) : { due: 0, enqueued: 0, skipped: "feature_off" };
    const summary = await runDueTasks({ limit: 150, maxMs: 240_000 });
    return NextResponse.json({ ok: true, queued, summary });
  } catch (err) {
    console.error("run-tasks cron failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Task run failed" }, { status: 500 });
  }
}
