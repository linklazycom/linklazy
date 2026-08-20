import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { scanBuyerSite } from "@/lib/site-scanner";
import { classifyNicheWithAi, type AiProvider } from "@/lib/ai-niche-detect";
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
  manual_niche: z.enum(NICHES as unknown as [string, ...string[]]).optional(),
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

  // Rate-limit: max 5 scans per hour per buyer. Each scan can trigger up
  // to ~16 outbound fetches (1 for the buyer's site + 15 for reranking
  // candidates), so this is as much about protecting the server/being a
  // good citizen to scanned sites as it is about spam.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentScanCount } = await supabase
    .from("buyer_site_scans")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", user.id)
    .gte("created_at", oneHourAgo);

  const SCAN_LIMIT_PER_HOUR = 5;
  if ((recentScanCount ?? 0) >= SCAN_LIMIT_PER_HOUR) {
    return NextResponse.json(
      {
        error: `You've hit the limit of ${SCAN_LIMIT_PER_HOUR} scans per hour. Please try again later.`,
      },
      { status: 429 }
    );
  }

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
  let detectionMethod: "keyword" | "ai" | "manual" = input.manual_niche ? "manual" : "keyword";
  let aiVotes: { provider: string; niche: string | null; error?: string }[] = [];

  try {
    const result = await scanBuyerSite(input.url);
    if (!input.manual_niche) {
      detectedNiche = result.detectedNiche;
      confidence = result.confidence;
    }
    matchedKeywords = result.matchedKeywords;

    // 2b. AI fallback — only runs when keyword detection is missing or
    // weak, and only if the admin has enabled at least one provider.
    // This keeps the common case free; AI cost is only paid on the
    // harder-to-classify sites.
    if (!input.manual_niche) {
      const { data: settingsRows } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["ai_niche_detection_providers", "ai_niche_detection_min_confidence"]);

      const enabledProviders =
        (settingsRows?.find((r) => r.key === "ai_niche_detection_providers")?.value as
          | AiProvider[]
          | undefined) ?? [];
      const minConfidence = Number(
        settingsRows?.find((r) => r.key === "ai_niche_detection_min_confidence")?.value ?? 40
      );

      const shouldTryAi =
        enabledProviders.length > 0 &&
        (detectedNiche === null || confidence < (Number.isFinite(minConfidence) ? minConfidence : 40));

      if (shouldTryAi && result.pageText) {
        const aiResult = await classifyNicheWithAi(result.pageText, enabledProviders);
        aiVotes = aiResult.votes;
        // Only override if AI actually found something — never let an
        // AI failure erase a weak-but-real keyword match.
        if (aiResult.niche) {
          detectedNiche = aiResult.niche;
          confidence = aiResult.confidence;
          detectionMethod = "ai";
        }
      }
    }
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
          "Couldn't confidently detect a niche from that page, even with AI assistance. Pick your niche manually below and we'll use that instead.",
        niches: NICHES,
      },
      { status: 422 }
    );
  }

  // 3. Find candidate seller sites: same niche, admin-approved. No
  // accepts_paid filter here — every approved site in the niche should
  // show up in the scan result; accepts_paid only matters later when
  // the buyer actually tries to place a paid order against one.
  const { data: candidateSites } = await supabase
    .from("sites")
    .select("id, domain, niche, dr, da, price_amount, turnaround_hours, owner_id, accepts_paid")
    .eq("niche", detectedNiche)
    .eq("status", "approved")
    .neq("owner_id", user.id)
    .order("dr", { ascending: false, nullsFirst: false })
    .limit(RESULT_LIMIT);

  // 3b. Re-rank the top candidates by content overlap with the buyer's
  // own site, not just DR — scan each candidate's homepage (same
  // keyword-matching scanner, reused) and score by how many of the
  // buyer's matched keywords also show up there. This is a best-effort
  // pass: any candidate that fails to fetch (timeout, blocked, etc)
  // just keeps its DR-based position instead of being dropped.
  const rerankPool = (candidateSites ?? []).slice(0, 15);
  const rest = (candidateSites ?? []).slice(15);

  const overlapScores = await Promise.allSettled(
    rerankPool.map(async (site) => {
      const domainUrl = site.domain.startsWith("http") ? site.domain : `https://${site.domain}`;
      const sellerScan = await scanBuyerSite(domainUrl);
      const overlap = matchedKeywords.filter((kw) => sellerScan.matchedKeywords.includes(kw)).length;
      return { id: site.id, overlap };
    })
  );

  const overlapById = new Map<string, number>();
  overlapScores.forEach((r) => {
    if (r.status === "fulfilled") overlapById.set(r.value.id, r.value.overlap);
  });

  const rerankedPool = [...rerankPool].sort((a, b) => {
    const overlapDiff = (overlapById.get(b.id) ?? 0) - (overlapById.get(a.id) ?? 0);
    if (overlapDiff !== 0) return overlapDiff;
    return (b.dr ?? 0) - (a.dr ?? 0); // tie-break on DR, same as before
  });

  const matchedSites = [...rerankedPool, ...rest].map((s) => ({
    ...s,
    relevance_overlap: overlapById.get(s.id) ?? null,
  }));

  const resultSiteIds = matchedSites.map((s) => s.id);

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

    await notifyAutoOrderResult(supabase, user.id, autoOrder);
  }

  return NextResponse.json({
    scanId: scanRow.id,
    detectedNiche,
    confidence,
    matchedKeywords,
    detectionMethod,
    aiVotes,
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
  allMatches: { id: string; price_amount: number | null; accepts_paid: boolean }[];
  maxBudget?: number;
  maxSites?: number;
  targetUrl: string;
  anchorText: string;
}) {
  // Apply buyer's caps client-side before calling the RPC, so the RPC
  // only ever sees the candidate set the buyer actually authorized —
  // the RPC itself still re-checks wallet balance atomically.
  // Auto-order only makes sense against sites that actually accept paid
  // orders — unlike the scan result list (which now shows every approved
  // site regardless), auto-order must pre-filter here so a max_sites cap
  // doesn't get "wasted" on an exchange-only site the RPC would skip anyway.
  let candidates = allMatches.filter((s) => s.price_amount != null && s.accepts_paid);

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

/**
 * Lets the buyer's notification bell (existing Supabase Realtime setup)
 * pick this up instantly. Reuses the "order" notification type since the
 * notifications.type column has a check constraint we don't want to
 * alter just for this — an auto-placed order is still fundamentally an
 * order-related event.
 */
async function notifyAutoOrderResult(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  autoOrder: {
    placed: boolean;
    createdOrderIds: string[];
    skipped: { domain: string; reason: string }[];
    error?: string;
  }
) {
  let title: string;
  let bodyText: string;

  if (autoOrder.error) {
    title = "Auto-order couldn't run";
    bodyText = autoOrder.error;
  } else if (autoOrder.createdOrderIds.length === 0) {
    title = "Auto-order skipped — insufficient balance";
    bodyText = "Your wallet balance couldn't cover any matched sites. Top up and try again.";
  } else if (autoOrder.skipped.length > 0) {
    title = `Auto-order partially placed (${autoOrder.createdOrderIds.length} order${
      autoOrder.createdOrderIds.length > 1 ? "s" : ""
    })`;
    bodyText = `${autoOrder.skipped.length} site(s) were skipped — check Orders for details.`;
  } else {
    title = `Auto-order placed: ${autoOrder.createdOrderIds.length} order${
      autoOrder.createdOrderIds.length > 1 ? "s" : ""
    }`;
    bodyText = "Your backlink orders were placed automatically from your site scan.";
  }

  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "order",
      title,
      body: bodyText,
      link: "/dashboard/orders",
      read: false,
    });
  } catch {
    // Notification failure should never fail the scan/order response itself.
  }
}
