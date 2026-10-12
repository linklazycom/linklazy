/** Pure helpers for the background-task runner (see lib/tasks.ts). */

/** Exponential backoff with a cap: 30s, 60s, 2m, 4m ... up to 30 minutes. */
export function computeBackoffMs(attempt: number): number {
  const a = Math.max(1, Math.floor(attempt));
  return Math.min(30 * 60_000, 30_000 * 2 ** (a - 1));
}

/**
 * Makes an error message safe to store and show: removes things that look
 * like API keys / bearer tokens / emails, collapses whitespace, caps length.
 */
export function sanitizeError(input: unknown, maxLength = 300): string {
  const raw = input instanceof Error ? input.message : typeof input === "string" ? input : "Unknown error";
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(sk|pk|key|tok|api)[-_][A-Za-z0-9_-]{8,}\b/gi, "[redacted]")
    .replace(/\b[A-Za-z0-9._-]{32,}\b/g, "[redacted]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
