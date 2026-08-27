import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A buyer can unlock a site's full details two ways:
 *  1. "quota" — spend one of their plan's included views (credits_ledger,
 *     type "unlock_spend"). Only available to buyers an admin has manually
 *     granted a plan with a view quota (see /admin/users) — there's no
 *     self-serve subscription checkout yet.
 *  2. "wallet" — pay per view from their wallet balance (site_unlocks),
 *     available on any listing the seller has enabled pay-per-view for.
 *     These unlocks can expire (site.access_duration_days).
 *
 * Every place that needs "has this buyer already unlocked site X" (browse
 * list masking, detail pages) must check both, or wallet-unlocked sites
 * wrongly show as locked again on next visit.
 */
export async function getUnlockedSiteIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const [{ data: quotaUnlocks }, { data: walletUnlocks }] = await Promise.all([
    supabase
      .from("credits_ledger")
      .select("related_site_id")
      .eq("user_id", userId)
      .eq("type", "unlock_spend"),
    supabase
      .from("site_unlocks")
      .select("site_id, expires_at")
      .eq("buyer_id", userId),
  ]);

  const ids = new Set<string>((quotaUnlocks ?? []).map((u) => u.related_site_id as string));

  const now = Date.now();
  (walletUnlocks ?? []).forEach((u) => {
    const active = !u.expires_at || new Date(u.expires_at as string).getTime() > now;
    if (active) ids.add(u.site_id as string);
  });

  return ids;
}
