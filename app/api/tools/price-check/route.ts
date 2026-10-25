import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NICHES } from "@/lib/niches";
import { computePriceStats, drWindow, parseDr, PRICE_CHECK_MIN_SAMPLES, PUBLIC_TOOLS_FLAG, TOOL_LIMITS } from "@/lib/growth/rules";
import { gateToolRequest } from "@/lib/growth/server";

/**
 * Backlink price check (Batch 18): summary prices of the LinkLazy listings whose Domain Rating is within 5 of the number entered
 * (optionally the same niche). Real listings only: with fewer than 5 matching listings it says so instead of showing numbers.
 * Prices are stored in BDT; the page converts them for display like everywhere else.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dr = parseDr(url.searchParams.get("dr"));
  if (dr === null) return NextResponse.json({ error: "Enter a Domain Rating between 0 and 100." }, { status: 400 });
  const nicheRaw = url.searchParams.get("niche")?.trim() || null;
  const niche = nicheRaw && (NICHES as readonly string[]).includes(nicheRaw) ? nicheRaw : null;

  const gate = await gateToolRequest(request, { flag: PUBLIC_TOOLS_FLAG, bucket: "tool_price", perIpHour: TOOL_LIMITS.price.perIpHour });
  if (!gate.ok) return NextResponse.json({ error: gate.response.error }, { status: gate.response.status });

  const [lo, hi] = drWindow(dr);
  const supabase = await createClient();
  let q = supabase.from("sites_public").select("price_amount").eq("status", "approved").gte("dr", lo).lte("dr", hi).not("price_amount", "is", null).limit(1000);
  if (niche) q = q.eq("niche", niche);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "We couldn't load listings right now. Please try again later." }, { status: 503 });

  const prices = (data ?? []).map((r) => Number(r.price_amount));
  const stats = computePriceStats(prices);
  return NextResponse.json({ ok: true, range: [lo, hi], niche, listings: prices.length, minSamples: PRICE_CHECK_MIN_SAMPLES, stats });
}
