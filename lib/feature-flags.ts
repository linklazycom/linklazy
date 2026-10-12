import { createServiceClient } from "@/lib/supabase/service";
import { normalizeFlag } from "@/lib/flag-value";

/**
 * Feature flags / kill switches live in the existing `site_settings` table
 * (key -> "on" | "off"), so admins flip them from the admin panel and no new
 * table is needed. Defaults are "on": a feature with no provider configured
 * shows its "setup" state instead of failing.
 */
export const EXTERNAL_APIS_FLAG = "external_apis_enabled";

export const FEATURE_FLAGS = [
  { key: "feature_ai_content", label: "AI Content Studio" },
  { key: "feature_opportunity_finder", label: "Opportunity Finder" },
  { key: "feature_backlink_monitor", label: "Backlink Monitor" },
  { key: "feature_link_management", label: "Link Management" },
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]["key"];

/** Reads several flags in one query. Missing rows fall back to "on". */
export async function getFlags(keys: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = true;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("site_settings").select("key, value").in("key", keys);
    for (const row of data ?? []) out[row.key] = normalizeFlag(row.value, true);
  } catch {
    // If settings can't be read we keep the defaults rather than break pages.
  }
  return out;
}

/** True only when the global external-API switch AND this feature's switch are on. */
export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  const flags = await getFlags([EXTERNAL_APIS_FLAG, featureKey]);
  return flags[EXTERNAL_APIS_FLAG] && flags[featureKey];
}
