import { createServiceClient } from "@/lib/supabase/service";
import { computeBackoffMs, sanitizeError } from "@/lib/task-utils";

/**
 * Minimal background-task queue on top of the `tasks` table (see
 * supabase/sql/022_tasks.sql). Features register a handler per task type;
 * `runDueTasks` claims due tasks atomically, runs them, and handles retries
 * with exponential backoff. Errors are sanitized before they are stored.
 *
 * No scheduler is wired yet (Vercel Hobby allows very few cron slots): tasks
 * run when an admin triggers /api/admin/tasks/run, or when a feature calls
 * runDueTasks itself. A cron route is added once the plan allows it.
 */
export interface TaskRow {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  user_id: string | null;
  project_id: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  run_at: string;
  idempotency_key: string | null;
  last_error: string | null;
}

export type TaskHandler = (task: TaskRow) => Promise<Record<string, unknown> | void>;

const handlers = new Map<string, TaskHandler>();

export function registerTaskHandler(type: string, handler: TaskHandler) {
  handlers.set(type, handler);
}

export interface EnqueueInput {
  type: string;
  userId?: string | null;
  projectId?: string | null;
  payload?: Record<string, unknown>;
  /** Same key => same task. Makes retries/double-clicks safe. */
  idempotencyKey?: string;
  runAt?: Date;
  maxAttempts?: number;
}

export async function enqueueTask(input: EnqueueInput): Promise<{ id: string; created: boolean }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      type: input.type,
      user_id: input.userId ?? null,
      project_id: input.projectId ?? null,
      payload: input.payload ?? {},
      idempotency_key: input.idempotencyKey ?? null,
      run_at: (input.runAt ?? new Date()).toISOString(),
      max_attempts: input.maxAttempts ?? 3,
    })
    .select("id")
    .single();

  if (!error && data) return { id: data.id as string, created: true };

  // Unique violation on idempotency_key: return the task that already exists.
  if (error?.code === "23505" && input.idempotencyKey) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("idempotency_key", input.idempotencyKey)
      .single();
    if (existing) return { id: existing.id as string, created: false };
  }
  throw new Error(`Could not enqueue task: ${sanitizeError(error?.message ?? "unknown error")}`);
}

async function logTask(taskId: string, level: "info" | "error", message: string) {
  const supabase = createServiceClient();
  await supabase.from("task_logs").insert({ task_id: taskId, level, message: sanitizeError(message, 500) });
}

export interface RunSummary {
  claimed: number;
  succeeded: number;
  retried: number;
  failed: number;
}

export async function runDueTasks(options: { limit?: number; maxMs?: number; types?: string[] } = {}): Promise<RunSummary> {
  const limit = options.limit ?? 5;
  const deadline = Date.now() + (options.maxMs ?? 50_000);
  const supabase = createServiceClient();
  const summary: RunSummary = { claimed: 0, succeeded: 0, retried: 0, failed: 0 };

  while (summary.claimed < limit && Date.now() < deadline) {
    const { data, error } = await supabase.rpc("claim_next_task", {
      p_types: options.types ?? null,
      p_stale_after_minutes: 10,
    });
    if (error) throw new Error(`Could not claim a task: ${sanitizeError(error.message)}`);
    const task = (Array.isArray(data) ? data[0] : data) as TaskRow | undefined;
    if (!task) break;
    summary.claimed++;

    const handler = handlers.get(task.type);
    if (!handler) {
      await supabase
        .from("tasks")
        .update({
          status: "failed",
          last_error: `No handler registered for task type "${task.type}"`,
          finished_at: new Date().toISOString(),
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      await logTask(task.id, "error", `No handler registered for "${task.type}"`);
      summary.failed++;
      continue;
    }

    try {
      const result = await handler(task);
      await supabase
        .from("tasks")
        .update({
          status: "succeeded",
          result: result ?? null,
          last_error: null,
          finished_at: new Date().toISOString(),
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      await logTask(task.id, "info", "Succeeded");
      summary.succeeded++;
    } catch (err) {
      const message = sanitizeError(err);
      const outOfAttempts = task.attempts >= task.max_attempts;
      await supabase
        .from("tasks")
        .update(
          outOfAttempts
            ? { status: "failed", last_error: message, finished_at: new Date().toISOString(), locked_at: null, updated_at: new Date().toISOString() }
            : {
                status: "queued",
                last_error: message,
                run_at: new Date(Date.now() + computeBackoffMs(task.attempts)).toISOString(),
                locked_at: null,
                updated_at: new Date().toISOString(),
              }
        )
        .eq("id", task.id);
      await logTask(task.id, "error", `${outOfAttempts ? "Failed" : "Will retry"}: ${message}`);
      if (outOfAttempts) summary.failed++;
      else summary.retried++;
    }
  }

  return summary;
}
