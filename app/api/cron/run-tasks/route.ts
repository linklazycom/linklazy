import { trackCron } from "@/lib/cron-track";
import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron-auth";
import { runDueTasks } from "@/lib/tasks";
import { enqueueDueBacklinkChecks } from "@/lib/backlinks/task";
import { isBacklinkMonitorOn } from "@/lib/backlinks/feature";
import "@/lib/backlinks/register";
import { enqueueDueDomainRechecks } from "@/lib/domains/recheck";
import "@/lib/domains/register";
import { getFlags } from "@/lib/feature-flags";

// Many sequential page fetches; needs a plan with extended function duration (see cron/link-checker).
export const maxDuration = 300;

/**
 * Daily job: queues a check for every monitored backlink that is due (Backlink Monitor) and a re-check of every custom domain whose
 * ownership is due, then runs the task queue (this also picks up any other queued task whose handler is registered).
 */
async function handle(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;

  try {
    const monitorOn = await isBacklinkMonitorOn();
    const queued = monitorOn ? await enqueueDueBacklinkChecks(150) : { due: 0, enqueued: 0, skipped: "feature_off" };
    const domainsOn = (await getFlags(["feature_tool_domains"]))["feature_tool_domains"] !== false;
    const domains = domainsOn ? await enqueueDueDomainRechecks(100) : { due: 0, enqueued: 0, skipped: "feature_off" };
    // Backlink checks (up to 150) and domain checks (up to 100) share one run, so the limit covers both.
    const summary = await runDueTasks({ limit: 300, maxMs: 240_000 });
    return NextResponse.json({ ok: true, queued, domains, summary });
  } catch (err) {
    console.error("run-tasks cron failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Task run failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return trackCron("run-tasks", () => handle(request));
}
