/**
 * The scheduled jobs and how often each must succeed (Batch 21). Pure, so it is unit-tested
 * (tests/cron-health.test.ts also checks this list against vercel.json so the two cannot drift apart).
 */
export interface CronDef {
  name: string; // folder name under app/api/cron
  label: string;
  intervalHours: number; // how often it should run
  scheduled: boolean; // false = not in vercel.json (triggered from outside)
}

export const CRONS: CronDef[] = [
  { name: "search-alerts", label: "Saved-search alerts", intervalHours: 24, scheduled: true },
  { name: "link-checker", label: "Exchange link checker", intervalHours: 24, scheduled: true },
  { name: "weekly-digest", label: "Weekly digest email", intervalHours: 168, scheduled: true },
  { name: "ping-search-engines", label: "Sitemap ping", intervalHours: 24, scheduled: true },
  { name: "release-ppv-earnings", label: "Release pay-per-view earnings", intervalHours: 24, scheduled: true },
  { name: "dr-refresh", label: "Domain Rating refresh", intervalHours: 168, scheduled: true },
  { name: "seller-metrics", label: "Seller metrics", intervalHours: 168, scheduled: true },
  { name: "rollup-link-clicks", label: "Short-link click roll-up", intervalHours: 24, scheduled: true },
  { name: "run-tasks", label: "Background tasks & backlink checks", intervalHours: 24, scheduled: true },
  { name: "outreach-push", label: "Outreach push (external trigger)", intervalHours: 24, scheduled: false },
];

export interface CronRunRow {
  name: string;
  last_finished_at: string | null;
  last_ok_at: string | null;
  last_status: string | null;
  last_http: number | null;
  last_duration_ms: number | null;
}

export type CronState = "ok" | "late" | "failing" | "never" | "external";

export interface CronHealth {
  def: CronDef;
  state: CronState;
  lastOkAt: string | null;
  lastFinishedAt: string | null;
  detail: string;
}

/** ok = succeeded within 1.5x its interval (+2h grace); failing = the last run answered with an error; late = no recent success. */
export function cronHealth(defs: CronDef[], rows: CronRunRow[], now: Date): CronHealth[] {
  const byName = new Map(rows.map((r) => [r.name, r]));
  return defs.map((def) => {
    const r = byName.get(def.name);
    if (!def.scheduled && !r) return { def, state: "external", lastOkAt: null, lastFinishedAt: null, detail: "Not on the Vercel schedule; runs only if you call it from outside." };
    if (!r) return { def, state: "never", lastOkAt: null, lastFinishedAt: null, detail: "No run recorded yet." };
    const limitMs = (def.intervalHours * 1.5 + 2) * 3_600_000;
    const okAge = r.last_ok_at ? now.getTime() - new Date(r.last_ok_at).getTime() : Number.POSITIVE_INFINITY;
    let state: CronState = "ok";
    let detail = "Healthy.";
    if (r.last_status === "failed") {
      state = "failing";
      detail = `The last run answered with an error${r.last_http ? ` (HTTP ${r.last_http})` : ""}. Open Vercel > Logs for this job.`;
    } else if (okAge > limitMs) {
      state = "late";
      detail = def.scheduled ? "No successful run in the expected time. Check Vercel > Settings > Cron Jobs." : "No recent run.";
    }
    return { def, state, lastOkAt: r.last_ok_at, lastFinishedAt: r.last_finished_at, detail };
  });
}
