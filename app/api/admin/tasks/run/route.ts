import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { runDueTasks } from "@/lib/tasks";

// Manual trigger for the background-task runner (admin only). A scheduled
// cron route is added once the hosting plan allows more cron slots.
export const maxDuration = 60;

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  try {
    return NextResponse.json({ ok: true, summary: await runDueTasks({ limit: 5, maxMs: 45_000 }) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Task run failed" }, { status: 500 });
  }
}
