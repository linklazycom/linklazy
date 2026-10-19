import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { AiUnavailableError, searchStockImages } from "@/lib/api-providers";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanImageQuery } from "@/lib/providers/images";

/** Stock photo search through the admin-managed image providers. Read-only; free (rate-limited). Nothing is stored. */
export async function GET(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;

  const q = cleanImageQuery(new URL(request.url).searchParams.get("q"));
  if (!q) return NextResponse.json({ error: "Type at least two letters to search." }, { status: 400 });

  if (!gate.ctx.isAdmin) {
    const { allowed } = await checkRateLimit("stock_images", gate.ctx.userId, { max: 40, windowMinutes: 60 });
    if (!allowed) return NextResponse.json({ error: "Too many searches. Please try again in a while." }, { status: 429 });
  }

  try {
    const images = await searchStockImages({ query: q, userId: gate.ctx.userId });
    return NextResponse.json({ images });
  } catch (err) {
    if (err instanceof AiUnavailableError) return NextResponse.json({ error: err.message, unavailable: true }, { status: 503 });
    return NextResponse.json({ error: "Image search is unavailable right now." }, { status: 500 });
  }
}
