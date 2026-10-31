import { createServiceClient } from "@/lib/supabase/service";

/**
 * Wraps a cron handler: after it answers, records when it finished and whether it succeeded in cron_runs
 * (shown in Admin > Operations). Recording is best effort and can never change the cron's own response.
 * Unauthorised calls (401/403) are NOT recorded, so a stranger cannot make a job look healthy or broken.
 * If a job is killed by a timeout it never gets to record, which correctly shows up as "late".
 */
export async function trackCron(name: string, run: () => Promise<Response>): Promise<Response> {
  const started = Date.now();
  let response: Response | null = null;
  let thrown: unknown = null;
  try {
    response = await run();
  } catch (error) {
    thrown = error;
  }
  const status = response ? response.status : 500;
  if (status !== 401 && status !== 403) {
    try {
      const now = new Date().toISOString();
      const ok = response !== null && response.ok;
      await createServiceClient()
        .from("cron_runs")
        .upsert({
          name,
          last_started_at: new Date(started).toISOString(),
          last_finished_at: now,
          last_status: ok ? "ok" : "failed",
          last_http: status,
          last_duration_ms: Date.now() - started,
          ...(ok ? { last_ok_at: now } : {}),
        }, { onConflict: "name" });
    } catch {
      // never break the job because of bookkeeping
    }
  }
  if (thrown) throw thrown;
  return response as Response;
}
