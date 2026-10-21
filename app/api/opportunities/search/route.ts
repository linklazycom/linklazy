import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectUser } from "@/lib/projects/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/links/http";
import { chargeUsage, refundUsage } from "@/lib/usage/charge";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isUuid, parseTypes } from "@/lib/opportunities/rules";
import { OPPORTUNITY_FEATURE, OpportunityError, runOpportunitySearch } from "@/lib/opportunities/server";

export const maxDuration = 60;

const schema = z.object({
  project_id: z.string().max(60),
  types: z.array(z.string().max(30)).max(10),
  /** One id per button click: a retry with the same id is never charged twice. */
  request_id: z.string().max(100).nullish(),
  /** The price the user saw. The real price is always decided here, on the server. */
  expected_price: z.number().int().min(0).max(100_000).nullish(),
});

/**
 * "Find opportunities" for one of the user's projects (Batch 16). Money rules like the AI features: the wallet is charged
 * BEFORE the search (only when an admin switched charging on and gave the action a price) and refunded automatically if
 * nothing could be delivered (search unavailable, or no result at all).
 */
export async function POST(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success || !isUuid(parsed.data.project_id)) return NextResponse.json({ error: "Please choose a project and try again." }, { status: 400 });
  const types = parseTypes(parsed.data.types);
  if (!types) return NextResponse.json({ error: "Choose at least one kind of opportunity.", field: "types" }, { status: 400 });

  if (!(await isFeatureEnabled(OPPORTUNITY_FEATURE))) {
    return NextResponse.json({ error: "The Opportunity Finder is currently switched off.", unavailable: true }, { status: 503 });
  }

  if (!gate.ctx.isAdmin) {
    const { allowed } = await checkRateLimit("opportunity_search", gate.ctx.userId, { max: 10, windowMinutes: 60 });
    if (!allowed) return NextResponse.json({ error: "You've searched a lot in a short time. Please try again in a while." }, { status: 429 });
  }

  const charge = await chargeUsage(gate.ctx, "opportunity_search", { requestId: parsed.data.request_id, expectedPrice: parsed.data.expected_price });
  if (!charge.ok) return NextResponse.json({ error: charge.error, code: charge.code, price: charge.price }, { status: charge.status });
  const notCharged = charge.amount > 0 ? " You were not charged." : "";

  try {
    const summary = await runOpportunitySearch(gate.ctx.userId, parsed.data.project_id, types);
    if (summary.hits === 0) {
      await refundUsage(charge.chargeId, "no results");
      return NextResponse.json({ ok: true, summary, charged: 0, refunded: charge.amount > 0 });
    }
    return NextResponse.json({ ok: true, summary, charged: charge.amount });
  } catch (err) {
    if (err instanceof OpportunityError) {
      if (err.nothingDelivered) await refundUsage(charge.chargeId, "search not delivered");
      return NextResponse.json({ error: `${err.message}${err.nothingDelivered ? notCharged : ""}`, unavailable: err.unavailable }, { status: err.status });
    }
    await refundUsage(charge.chargeId, "search failed");
    return NextResponse.json({ error: `The search failed unexpectedly.${notCharged}` }, { status: 500 });
  }
}
