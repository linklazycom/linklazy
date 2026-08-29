import type { SupabaseClient } from "@supabase/supabase-js";

/** Reads the platform's BDT-per-USD exchange rate (same source as
 * /api/currency, used to convert BDT-stored amounts — orders, wallet — into
 * USD wherever a rule or display is defined in USD, e.g. commission tiers). */
export async function getBdtPerUsd(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "bdt_per_usd")
    .maybeSingle();
  const rate = Number(data?.value ?? 125);
  return Number.isFinite(rate) && rate > 0 ? rate : 125;
}
