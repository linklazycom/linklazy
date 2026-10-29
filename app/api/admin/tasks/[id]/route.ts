import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Retry a failed background task: back to the queue with fresh attempts. Only "failed" tasks can be retried. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("tasks")
    .update({ status: "queued", attempts: 0, run_at: new Date().toISOString(), locked_at: null, finished_at: null, last_error: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "failed")
    .select("id");
  if (error) return NextResponse.json({ error: "Could not retry this task." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Only a failed task can be retried." }, { status: 409 });

  await admin.supabase.from("admin_logs").insert({ admin_id: admin.adminId, action: "task_retry", target_table: "tasks", target_id: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
