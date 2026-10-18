import { createServiceClient } from "@/lib/supabase/service";
import { resolveUsagePricing, USAGE_SETTING_KEYS, DEFAULT_PRICING, type UsagePricing } from "@/lib/usage/pricing";

let cache: { at: number; value: UsagePricing } | null = null;
const TTL_MS = 20_000;

/** Current pricing (short in-memory cache). On any error returns the safe default: nothing is charged. */
export async function getUsagePricing(): Promise<UsagePricing> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const { data } = await createServiceClient().from("site_settings").select("key, value").in("key", USAGE_SETTING_KEYS);
    const value = resolveUsagePricing(data);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_PRICING;
  }
}

/** Called after an admin changes pricing so THIS instance sees it immediately (others within ~20 s). */
export function clearUsagePricingCache() {
  cache = null;
}
