import { createServiceClient } from "@/lib/supabase/service";
import { enqueueTask, type TaskRow } from "@/lib/tasks";
import { isBacklinkMonitorOn } from "@/lib/backlinks/feature";
import { BACKLINK_COLUMNS, runAndStoreCheck, type BacklinkRow } from "@/lib/backlinks/service";

/** Scheduled monitoring on top of the background-task queue (Batch 13). */
export const BACKLINK_TASK = "backlink.check";
/** A monitored backlink is due when its last check is older than this (the cron runs once a day). */
export const DUE_AFTER_HOURS = 20;

/** Queues one task per due backlink. The idempotency key (backlink + day) means a double cron run never double-checks. */
export async function enqueueDueBacklinkChecks(limit = 150): Promise<{ due: number; enqueued: number }> {
  const svc = createServiceClient();
  const before = new Date(Date.now() - DUE_AFTER_HOURS * 3_600_000).toISOString();
  const { data } = await svc
    .from("backlinks")
    .select("id, user_id, project_id")
    .eq("monitoring", true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${before}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  const day = new Date().toISOString().slice(0, 10);
  let enqueued = 0;
  for (const b of data ?? []) {
    try {
      const r = await enqueueTask({
        type: BACKLINK_TASK,
        userId: b.user_id as string,
        projectId: (b.project_id as string | null) ?? null,
        payload: { backlinkId: b.id },
        idempotencyKey: `backlink:${b.id}:${day}`,
        maxAttempts: 2,
      });
      if (r.created) enqueued++;
    } catch {
      /* one bad insert must not stop the others */
    }
  }
  return { due: data?.length ?? 0, enqueued };
}

let featureCache: { at: number; on: boolean } | null = null;
async function featureOn(): Promise<boolean> {
  if (featureCache && Date.now() - featureCache.at < 60_000) return featureCache.on;
  const on = await isBacklinkMonitorOn();
  featureCache = { at: Date.now(), on };
  return on;
}

/** Task handler: checks one backlink. Expected failures (page down, blocked...) are results, not errors. */
export async function handleBacklinkCheckTask(task: TaskRow): Promise<Record<string, unknown>> {
  const id = typeof task.payload?.backlinkId === "string" ? task.payload.backlinkId : null;
  if (!id) return { skipped: "no_backlink_id" };
  if (!(await featureOn())) return { skipped: "feature_off" };

  const svc = createServiceClient();
  const { data } = await svc.from("backlinks").select(BACKLINK_COLUMNS).eq("id", id).maybeSingle();
  const row = data as BacklinkRow | null;
  if (!row) return { skipped: "deleted" };
  if (!row.monitoring) return { skipped: "monitoring_off" };

  const { data: profile } = await svc.from("profiles").select("is_banned, is_suspended").eq("id", row.user_id).maybeSingle();
  if (profile?.is_banned || profile?.is_suspended) return { skipped: "owner_restricted" };

  const r = await runAndStoreCheck(row, "scheduled");
  return { status: r.outcome.status, reason: r.outcome.reason };
}
