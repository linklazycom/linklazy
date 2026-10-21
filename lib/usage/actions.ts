/**
 * Chargeable actions (Batch 14). Prices are set by the admin (Admin > Usage pricing) and live in
 * site_settings. Everything is OFF / free until an admin switches charging on AND gives an action a price.
 */
export const USAGE_ACTIONS = [
  {
    id: "project_ai_suggest",
    label: "Project AI suggestions (niche and keywords)",
    unit: "per suggestion",
    defaultFreePerDay: 5,
  },
  {
    id: "backlink_extra_check",
    label: "Manual backlink check beyond the free hourly allowance",
    unit: "per check",
    defaultFreePerDay: 0,
  },
  {
    id: "content_generate",
    label: "AI Content Studio: outreach, bio, ideas, outline, title/meta, alt text, comment draft",
    unit: "per generation",
    defaultFreePerDay: 5,
  },
  {
    id: "opportunity_search",
    label: "Opportunity Finder: one search run for a project",
    unit: "per search run",
    defaultFreePerDay: 3,
  },
  {
    id: "content_article_draft",
    label: "AI Content Studio: full article draft",
    unit: "per draft",
    defaultFreePerDay: 1,
  },
] as const;

export type UsageActionId = (typeof USAGE_ACTIONS)[number]["id"];

export const USAGE_ACTION_IDS: readonly string[] = USAGE_ACTIONS.map((a) => a.id);

export function isUsageAction(v: unknown): v is UsageActionId {
  return typeof v === "string" && USAGE_ACTION_IDS.includes(v);
}

export const MAX_USAGE_PRICE = 10_000;
export const MAX_FREE_PER_DAY = 1_000;

export const CHARGING_SETTING_KEY = "usage_charging_enabled";
export const priceKey = (id: UsageActionId) => `usage_price_${id}`;
export const freeKey = (id: UsageActionId) => `usage_free_per_day_${id}`;

export const CURRENCY_SYMBOL = "৳";
export const money = (n: number) => `${CURRENCY_SYMBOL}${n}`;
