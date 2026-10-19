import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectUser } from "@/lib/projects/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { AiUnavailableError, callAi } from "@/lib/api-providers";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/links/http";
import { chargeUsage, refundUsage } from "@/lib/usage/charge";
import { KIND_DEFS, isContentKind } from "@/lib/content/kinds";
import { buildContentRequest, cleanContentOutput, type ProjectContext } from "@/lib/content/prompts";
import { isUuid } from "@/lib/content/documents";

const schema = z.object({
  kind: z.string().max(40),
  input: z.record(z.string(), z.unknown()).default({}),
  project_id: z.string().max(60).nullish(),
  /** One id per button click: a retry with the same id is never charged twice. */
  request_id: z.string().max(100).nullish(),
  /** The price the user saw. The real price is always decided here, on the server. */
  expected_price: z.number().int().min(0).max(100_000).nullish(),
});

/**
 * AI Content Studio (Batch 15). The result is a DRAFT returned to the user's editor; nothing is saved or
 * published here. Same money rules as the project suggestions: the wallet is charged BEFORE the AI call
 * (only when an admin switched charging on and gave the action a price) and refunded automatically if no
 * usable text could be delivered.
 */
export async function POST(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 40_000));
  if (!parsed.success || !isContentKind(parsed.data.kind)) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const kind = parsed.data.kind;
  const def = KIND_DEFS[kind];

  let project: ProjectContext | null = null;
  const projectId = parsed.data.project_id;
  if (projectId) {
    if (!isUuid(projectId)) return NextResponse.json({ error: "Invalid project.", field: "project_id" }, { status: 400 });
    // Server-side client, but always filtered by the signed-in user: someone else's project is simply "not found".
    const { data } = await createServiceClient()
      .from("projects")
      .select("name, canonical_url, description, niche")
      .eq("id", projectId)
      .eq("user_id", gate.ctx.userId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Project not found.", field: "project_id" }, { status: 404 });
    project = { name: data.name, url: data.canonical_url, description: data.description, niche: data.niche };
  }

  const built = buildContentRequest(kind, parsed.data.input, project);
  if (!built.ok) return NextResponse.json({ error: built.message, field: built.field }, { status: 400 });

  if (!gate.ctx.isAdmin) {
    const { allowed } = await checkRateLimit("content_generate", gate.ctx.userId, { max: 20, windowMinutes: 60 });
    if (!allowed) return NextResponse.json({ error: "You've generated a lot in a short time. Please try again in a while." }, { status: 429 });
  }

  const charge = await chargeUsage(gate.ctx, def.action, { requestId: parsed.data.request_id, expectedPrice: parsed.data.expected_price });
  if (!charge.ok) return NextResponse.json({ error: charge.error, code: charge.code, price: charge.price }, { status: charge.status });
  const notCharged = charge.amount > 0 ? " You were not charged." : "";

  try {
    const result = await callAi({
      feature: "feature_ai_content",
      system: built.value.system,
      messages: [{ role: "user", content: built.value.user }],
      maxTokens: built.value.maxTokens,
      temperature: 0.6,
      userId: gate.ctx.userId,
    });
    const text = cleanContentOutput(result.text);
    if (!text) {
      await refundUsage(charge.chargeId, "no usable text");
      return NextResponse.json({ error: `We couldn't produce a usable draft. Try adding more detail.${notCharged}` }, { status: 422 });
    }
    return NextResponse.json({ text, kind, charged: charge.amount });
  } catch (err) {
    await refundUsage(charge.chargeId, "ai call failed");
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: `${err.message}${notCharged}`, unavailable: true }, { status: 503 });
    }
    return NextResponse.json({ error: `The writing assistant is unavailable right now.${notCharged}` }, { status: 500 });
  }
}
