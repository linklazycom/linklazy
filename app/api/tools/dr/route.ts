import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/links/http";
import { fetchDomainRating } from "@/lib/ahrefs";
import { normalizeDomainInput, PUBLIC_TOOLS_FLAG, TOOL_LIMITS } from "@/lib/growth/rules";
import { checkGlobalCeiling, gateToolRequest, readToolCache, writeToolCache } from "@/lib/growth/server";

const schema = z.object({ domain: z.string().max(300) });

/**
 * Free Domain Rating check for anyone (Batch 18). Protects the Ahrefs quota: a switch, per-visitor limits, a one-day saved answer
 * per domain, and a whole-site daily ceiling that only counts real Ahrefs calls. Error details from Ahrefs are never shown to visitors.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request, 2_000));
  const domain = parsed.success ? normalizeDomainInput(parsed.data.domain) : null;
  if (!domain) return NextResponse.json({ error: "Enter a website address like example.com." }, { status: 400 });

  const gate = await gateToolRequest(request, { flag: PUBLIC_TOOLS_FLAG, bucket: "tool_dr", perIpHour: TOOL_LIMITS.dr.perIpHour, perIpDay: TOOL_LIMITS.dr.perIpDay });
  if (!gate.ok) return NextResponse.json({ error: gate.response.error }, { status: gate.response.status });

  const cached = await readToolCache<{ dr: number }>("dr", domain);
  if (cached && Number.isInteger(cached.dr)) return NextResponse.json({ ok: true, domain, dr: cached.dr, cached: true });

  const ceiling = await checkGlobalCeiling("tool_dr", TOOL_LIMITS.dr.globalDay);
  if (!ceiling.ok) return NextResponse.json({ error: ceiling.error }, { status: ceiling.status });

  const result = await fetchDomainRating(domain);
  if (!result.ok || result.domainRating === null) {
    return NextResponse.json({ error: "We couldn't check that domain right now. Please try again later." }, { status: 503 });
  }
  await writeToolCache("dr", domain, { dr: result.domainRating }, "ahrefs");
  return NextResponse.json({ ok: true, domain, dr: result.domainRating, cached: false });
}
