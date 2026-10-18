import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectUser } from "@/lib/projects/auth";
import { buildSuggestMessage, parseSuggestion, SUGGEST_SYSTEM_PROMPT } from "@/lib/projects/suggest";
import { AiUnavailableError, callAi } from "@/lib/api-providers";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/links/http";
import { chargeUsage, refundUsage } from "@/lib/usage/charge";

const schema = z.object({
  name: z.string().max(300).nullish(),
  url: z.string().max(2048).nullish(),
  description: z.string().max(5000).nullish(),
  /** One id per button click: a retry with the same id is never charged twice. */
  request_id: z.string().max(100).nullish(),
  /** The price the user saw. The real price is always decided here, on the server. */
  expected_price: z.number().int().min(0).max(100_000).nullish(),
});

/**
 * Suggests a niche and keywords for the project form. The answer is a PROPOSAL the user edits;
 * nothing is saved here. When AI is off / not set up / out of quota the form just stays manual.
 * Wallet charging (Batch 14): when an admin has switched charging on and given this action a price, a use
 * beyond the daily free allowance is taken from the wallet BEFORE the AI is called and refunded automatically
 * if no suggestion could be delivered. Until then it is free (still rate-limited).
 */
export async function POST(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 20_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });

  const message = buildSuggestMessage(parsed.data);
  if (!message) {
    return NextResponse.json({ error: "Add a short description of the website first, then ask for suggestions.", field: "description" }, { status: 400 });
  }

  if (!gate.ctx.isAdmin) {
    const { allowed } = await checkRateLimit("project_suggest", gate.ctx.userId, { max: 10, windowMinutes: 60 });
    if (!allowed) return NextResponse.json({ error: "You've asked for suggestions too many times. Please try again in a while." }, { status: 429 });
  }

  const charge = await chargeUsage(gate.ctx, "project_ai_suggest", { requestId: parsed.data.request_id, expectedPrice: parsed.data.expected_price });
  if (!charge.ok) return NextResponse.json({ error: charge.error, code: charge.code, price: charge.price }, { status: charge.status });

  try {
    const result = await callAi({
      feature: "feature_ai_content",
      system: SUGGEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
      maxTokens: 400,
      temperature: 0.3,
      userId: gate.ctx.userId,
    });
    const suggestion = parseSuggestion(result.text);
    if (!suggestion) {
      await refundUsage(charge.chargeId, "no usable suggestion");
      return NextResponse.json({ error: "We couldn't come up with useful suggestions. Try a more detailed description, or fill the fields in by hand." + (charge.amount > 0 ? " You were not charged." : "") }, { status: 422 });
    }
    return NextResponse.json({ suggestion, charged: charge.amount });
  } catch (err) {
    await refundUsage(charge.chargeId, "ai call failed");
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: `${err.message} You can fill the fields in by hand.${charge.amount > 0 ? " You were not charged." : ""}`, unavailable: true }, { status: 503 });
    }
    return NextResponse.json({ error: `Suggestions are unavailable right now. You can fill the fields in by hand.${charge.amount > 0 ? " You were not charged." : ""}` }, { status: 500 });
  }
}
