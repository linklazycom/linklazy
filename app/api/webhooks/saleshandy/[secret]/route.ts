import { NextResponse } from "next/server";
import { readJson } from "@/lib/links/http";
import { loadConnection, webhookSecretMatches } from "@/lib/outreach/saleshandy-server";
import { parseWebhook } from "@/lib/outreach/webhook";
import { applySaleshandyEvent } from "@/lib/outreach/events-server";

/**
 * Receives Saleshandy webhooks (Batch 16B-2). Saleshandy does not sign its calls, so the URL itself carries a long random
 * secret; a wrong one gets the same plain 404 as a page that does not exist. Safe to call twice with the same event.
 */
export async function POST(request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const conn = await loadConnection();
  if (!webhookSecretMatches(conn, secret)) return new NextResponse("Not found", { status: 404 });

  const body = await readJson(request, 200_000);
  const parsed = parseWebhook(body);
  // Anything we cannot use (a test ping, an event type we do not handle) is acknowledged, so Saleshandy does not keep retrying it.
  if (!parsed.ok) return NextResponse.json({ ok: true, ignored: parsed.reason });

  try {
    const outcome = await applySaleshandyEvent(parsed.value);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error("saleshandy webhook failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Could not process the event" }, { status: 500 });
  }
}
