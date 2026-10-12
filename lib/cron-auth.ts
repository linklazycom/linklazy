import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-secret";

/**
 * Guard for every /api/cron/* route. Usage at the top of the handler:
 *
 *   const denied = requireCron(request);
 *   if (denied) return denied;
 *
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when the
 * CRON_SECRET environment variable is set on the project.
 */
export function requireCron(request: Request): NextResponse | null {
  const result = verifyCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (result === "ok") return null;

  if (result === "unconfigured") {
    // Fail closed, and say why in the server log (never the secret itself).
    console.error("Cron request rejected: CRON_SECRET is not configured on this deployment.");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
