import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/links/http";
import { createClient } from "@/lib/supabase/server";
import { scanBuyerSite } from "@/lib/site-scanner";
import { NICHES } from "@/lib/niches";
import { normalizePageInput, pickRecommendations, PUBLIC_RECOMMEND_FLAG, TOOL_LIMITS } from "@/lib/growth/rules";
import { checkGlobalCeiling, gateToolRequest } from "@/lib/growth/server";

const schema = z.object({ url: z.string().max(2048).optional(), manual_niche: z.string().max(80).optional() });

/**
 * Public recommendations (Batch 18): a visitor gives a page address, we read that ONE page (SSRF-safe fetch, keyword matching, no AI),
 * detect the niche and list up to 5 listed sites in the same niche using only fields /browse already shows publicly.
 * A visitor can also pick the niche by hand (then nothing is fetched).
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request, 4_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const manual = parsed.data.manual_niche && (NICHES as readonly string[]).includes(parsed.data.manual_niche) ? parsed.data.manual_niche : null;
  const pageUrl = parsed.data.url ? normalizePageInput(parsed.data.url) : null;
  if (!manual && !pageUrl) return NextResponse.json({ error: "Enter your website address (for example https://example.com).", niches: NICHES }, { status: 400 });

  const gate = await gateToolRequest(request, { flag: PUBLIC_RECOMMEND_FLAG, bucket: "tool_recommend", perIpHour: TOOL_LIMITS.recommend.perIpHour, perIpDay: TOOL_LIMITS.recommend.perIpDay });
  if (!gate.ok) return NextResponse.json({ error: gate.response.error }, { status: gate.response.status });

  let niche = manual;
  let confidence = manual ? 100 : 0;
  let matchedKeywords: string[] = [];
  if (!niche && pageUrl) {
    const ceiling = await checkGlobalCeiling("tool_recommend", TOOL_LIMITS.recommend.globalDay);
    if (!ceiling.ok) return NextResponse.json({ error: ceiling.error }, { status: ceiling.status });
    try {
      const scan = await scanBuyerSite(pageUrl);
      niche = scan.detectedNiche;
      confidence = scan.confidence;
      matchedKeywords = scan.matchedKeywords.slice(0, 6);
    } catch {
      return NextResponse.json({ error: "We couldn't read that page. Check the address, or pick your niche below.", niches: NICHES }, { status: 502 });
    }
    if (!niche) return NextResponse.json({ error: "We couldn't tell the niche from that page. Pick it below and we'll show matching sites.", niches: NICHES }, { status: 422 });
  }

  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("sites_public")
      .select("id, niche, dr, da, price_amount, turnaround_hours")
      .eq("niche", niche as string)
      .eq("status", "approved")
      .order("dr", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase.from("sites_public").select("id", { count: "exact", head: true }).eq("niche", niche as string).eq("status", "approved"),
  ]);
  const sites = pickRecommendations(
    (data ?? []).map((s) => ({ id: s.id as string, niche: s.niche as string, dr: (s.dr as number | null) ?? null, da: (s.da as number | null) ?? null, price_amount: s.price_amount != null ? Number(s.price_amount) : null, turnaround_hours: (s.turnaround_hours as number | null) ?? null })),
    5
  );
  return NextResponse.json({ ok: true, niche, confidence, matchedKeywords, totalInNiche: count ?? sites.length, sites });
}
