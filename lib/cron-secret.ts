import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Pure helper (no framework imports, so it can be unit-tested with the Node
 * test runner). Decides whether a request to a /api/cron/* route is allowed.
 *
 * SECURITY (audit R1): the old inline check was
 *   authHeader !== `Bearer ${process.env.CRON_SECRET}`
 * which, when CRON_SECRET is not set, compares against the literal string
 * "Bearer undefined" — anyone sending that header could run every cron job.
 * This version FAILS CLOSED: no usable secret => nobody is authorized.
 */
export type CronAuthResult = "ok" | "unconfigured" | "denied";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function verifyCronAuth(
  authorizationHeader: string | null | undefined,
  secret: string | null | undefined
): CronAuthResult {
  const s = (secret ?? "").trim();
  // Treat obvious "unset" artefacts as not configured too.
  if (!s || s === "undefined" || s === "null") return "unconfigured";

  const header = authorizationHeader ?? "";
  // Compare fixed-length digests so the comparison is constant-time and
  // never leaks the secret length.
  const given = digest(header);
  const expected = digest(`Bearer ${s}`);
  return timingSafeEqual(given, expected) ? "ok" : "denied";
}
