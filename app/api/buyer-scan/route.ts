import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { scanBuyerSite } from "@/lib/site-scanner";
import { NICHES } from "@/lib/niches";

const scanSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .refine((v) => /^https?:\/\//.test(v), "Include http:// or https://"),
  auto_order: z.boolean().default(false),
  target_url: z.string().url().optional(),
  anchor_text: z.string().trim().min(1).max(200).optional(),
  max_budget: z.coerce.number().int().min(1).optional(),
  max_sites: z.coerce.number().int().min(1).max(10).optional(),
  // If the buyer overrides the auto-detected niche (either because
  // detection failed or picked the wrong one), skip keyword matching
  // and use this niche directly for the site-matching step.
  manual_niche: z.enum(NICHES as [string, ...string[]]).optional(),
});

const RESULT_LIMIT = 30;

/**
 * POST /api/buyer-scan
 *
 * 1. Fetches the buyer's URL and detects a niche via keyword matching.
 * 2. Finds approved, paid-accepting seller sites in that niche.
 * 3. If auto_order was requested, places a wallet-paid bulk order
 *    against the top matches (bounded by max_budget/max_sites) using
 *    the atomic place_bulk_order_with_wallet RPC.
 *
 * If auto_order is true, target_url + anchor_text are required (there's
 * nothing to auto-order without them).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  if (input.auto_order && (!input.target_url || !input.anchor_text)) {
    return NextResponse.json(
      { error: "target_url and anchor_text are required when auto_order is on" },
      { status: 400 }
    );
  }

  // 1. Insert a pending scan row so the buyer has a record even if the
  // fetch below fails.
  const { data: scanRow, error: insertError } = await supabase
    .from("buyer_site_scans")
    .insert({
      buyer_id: user.id,
      url: input.url,
      status: "pending",
      auto_order: input.auto_order,
      max_budget: input.max_budget ?? null,
      max_sites: input.max_sites ?? null,
    })
    .select("id")
    .single();

  if (insertError || !scanRow) {
    return NextResponse.json({ error: insertError?.message ?? "Could not start scan" }, { status: 500 });
  }

  // 2. Run the scan. If the buyer already supplied a manual_niche
  // (either a retry after a failed auto-detect, or an explicit
  // override), skip keyword matching entirely and trust their pick —
  // we still attempt the fetch so confidence/matchedKeywords are
  // filled in for display, but a fetch failure here is non-fatal.
  let detectedNiche: string | null = input.manual_niche ?? null;
  let confidence = input.manual_niche ? 100 : 0;
  let matchedKeywords: string[] = [];
  let scanErrorMessage: string | null = null;

  try {
    const result = await scanBuyerSite(input.url);
    if (!input.manual_niche) {
      detectedNiche = result.detectedNiche;
      confidence = result.confidence;
    }
    matchedKeywords = result.matchedKeywords;
  } catch (err) {
    scanErrorMessage = (err as Error).message;
    if (!input.manual_niche) {
      await supabase
        .from("buyer_site_scans")
        .update({ status: "failed", error_message: scanErrorMessage })
        .eq("id", scanRow.id);
      return NextResponse.json(
        { error: `Couldn't scan that URL: ${scanErrorMessage}`, niches: NICHES },
        { status: 502 }
      );
    }
    // Manual niche was given, so a fetch failure just means we lose the
    // confidence/keyword display — the match step below can still run.
  }

  if (!detectedNiche) {
    await supabase
      .from("buyer_site_scans")
      .update({ status: "failed", error_message: "Couldn't confidently detect a niche" })
      .eq("id", scanRow.id);
    return NextResponse.json(
      {
        error:
          "Couldn't confidently detect a niche from that page. Pick your niche manually below and we'll use that instead.",
        niches: NICHES,
      },
      { status: 422 }
    );
  }

  // 3. Find matching seller sites: same niche, approved, accepts paid
  // orders, best sites first (DR desc, then price asc).
  const { data: matchedSites } = await supabase
    .from("sites")
    .select("id, domain, niche, dr, da, price_amount, turnaround_hours, owner_id")
    .eq("niche", detectedNiche)
    .eq("status", "approved")
    .eq("accepts_paid", true)
    .neq("owner_id", user.id)
    .order("dr", { ascending: false, nullsFirst: false })
    .order("price_amount", { ascending: true })
    .limit(RESULT_LIMIT);

  const resultSiteIds = (matchedSites ?? []).map((s) => s.id);

  await supabase
    .from("buyer_site_scans")
    .update({
      status: "scanned",
      detected_niche: detectedNiche,
      confidence,
      matched_keywords: matchedKeywords,
      result_site_ids: resultSiteIds,
    })
    .eq("id", scanRow.id);

  // 4. Auto-order, if requested.
  let autoOrder: {
    placed: boolean;
    createdOrderIds: string[];
    skipped: { domain: string; reason: string }[];
    newBalance?: number;
    error?: string;
  } | null = null;

  if (input.auto_order && resultSiteIds.length > 0) {
    autoOrder = await runAutoOrder({
      buyerId: user.id,
      allMatches: matchedSites ?? [],
      maxBudget: input.max_budget,
      maxSites: input.max_sites,
      targetUrl: input.target_url!,
      anchorText: input.anchor_text!,
    });

    await supabase
      .from("buyer_site_scans")
      .update({
        auto_order_status: autoOrder.error
          ? "skipped"
          : autoOrder.createdOrderIds.length === 0
            ? "insufficient_balance"
            : autoOrder.skipped.length > 0
              ? "partial"
              : "placed",
      })
      .eq("id", scanRow.id);
  }

  return NextResponse.json({
    scanId: scanRow.id,
    detectedNiche,
    confidence,
    matchedKeywords,
    sites: matchedSites ?? [],
    autoOrder,
  });
}

async function runAutoOrder({
  buyerId,
  allMatches,
  maxBudget,
  maxSites,
  targetUrl,
  anchorText,
}: {
  buyerId: string;
  allMatches: { id: string; price_amount: number | null }[];
  maxBudget?: number;
  maxSites?: number;
  targetUrl: string;
  anchorText: string;
}) {
  // Apply buyer's caps client-side before calling the RPC, so the RPC
  // only ever sees the candidate set the buyer actually authorized —
  // the RPC itself still re-checks wallet balance atomically.
  let candidates = allMatches.filter((s) => s.price_amount != null);

  if (maxSites) candidates = candidates.slice(0, maxSites);

  if (maxBudget) {
    const withinBudget: typeof candidates = [];
    let running = 0;
    for (const site of candidates) {
      const price = site.price_amount!;
      if (running + price > maxBudget) continue;
      running += price;
      withinBudget.push(site);
    }
    candidates = withinBudget;
  }

  if (candidates.length === 0) {
    return { placed: false, createdOrderIds: [], skipped: [], error: "No sites fit the budget/site cap." };
  }

  const service = createServiceClient();
  const { data, error } = await service
    .rpc("place_bulk_order_with_wallet", {
      p_buyer_id: buyerId,
      p_site_ids: candidates.map((s) => s.id),
      p_target_url: targetUrl,
      p_anchor_text: anchorText,
      p_notes: "Auto-placed from site scan match",
    })
    .single();

  if (error) {
    return { placed: false, createdOrderIds: [], skipped: [], error: error.message };
  }

  const result = data as {
    ok: boolean;
    error: string | null;
    created_order_ids: string[];
    skipped: { domain: string; reason: string }[];
    new_balance: number;
  };

  return {
    placed: result.ok && result.created_order_ids.length > 0,
    createdOrderIds: result.created_order_ids ?? [],
    skipped: result.skipped ?? [],
    newBalance: result.new_balance,
    error: result.ok ? undefined : (result.error ?? undefined),
  };
}
