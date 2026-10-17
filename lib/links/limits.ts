/** Admin-configurable link limits (Batch 9). Values live in site_settings (key -> number). */
export const LINK_LIMIT_DEFS = [
  { key: "link_max_per_user", label: "Max links per user", def: 50, min: 1, max: 100000 },
  { key: "link_create_per_hour", label: "Links a user may create per hour", def: 20, min: 1, max: 10000 },
  { key: "link_new_account_days", label: "Account counts as \"new\" for this many days", def: 7, min: 0, max: 365 },
  { key: "link_new_account_max", label: "Max links for a new account", def: 10, min: 1, max: 100000 },
  { key: "link_new_account_per_hour", label: "Links per hour for a new account", def: 5, min: 1, max: 10000 },
  { key: "link_bulk_max_rows", label: "Max rows per CSV import", def: 100, min: 1, max: 1000 },
  { key: "link_click_retention_days", label: "Keep detailed click logs for (days; older days are summarised)", def: 90, min: 7, max: 3650 },
  { key: "bio_max_pages", label: "Bio pages per user", def: 1, min: 1, max: 100 },
  { key: "bio_max_links", label: "Links per bio page", def: 20, min: 1, max: 200 },
  { key: "domain_max_per_user", label: "Custom domains per user (0 = turned off)", def: 2, min: 0, max: 100 },
  { key: "api_max_keys_per_user", label: "API keys per user (0 = turned off)", def: 5, min: 0, max: 100 },
  { key: "api_rate_per_minute", label: "API requests per key per minute", def: 60, min: 1, max: 6000 },
  { key: "project_max_per_user", label: "Projects per user (0 = turned off)", def: 5, min: 0, max: 1000 },
  { key: "project_max_keywords", label: "Keywords per project", def: 50, min: 1, max: 500 },
] as const;

export type LinkLimitKey = (typeof LINK_LIMIT_DEFS)[number]["key"];
export type LinkLimits = Record<LinkLimitKey, number>;

export const DEFAULT_LINK_LIMITS: LinkLimits = Object.fromEntries(
  LINK_LIMIT_DEFS.map((d) => [d.key, d.def])
) as LinkLimits;

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(/^"+|"+$/g, ""));
    if (v.trim() !== "" && Number.isFinite(n)) return n;
  }
  return null;
}

/** Merges stored setting rows over the defaults; out-of-range / junk values fall back to the default. */
export function resolveLimits(rows: { key: string; value: unknown }[] | null | undefined): LinkLimits {
  const out: LinkLimits = { ...DEFAULT_LINK_LIMITS };
  for (const row of rows ?? []) {
    const def = LINK_LIMIT_DEFS.find((d) => d.key === row.key);
    if (!def) continue;
    const n = toNumber(row.value);
    if (n !== null && Number.isInteger(n) && n >= def.min && n <= def.max) out[def.key] = n;
  }
  return out;
}

/** Which cap applies to this user right now. */
export function effectiveCaps(
  limits: LinkLimits,
  accountCreatedAt: string | null | undefined,
  now: Date = new Date()
): { maxLinks: number; perHour: number; isNewAccount: boolean } {
  const created = accountCreatedAt ? Date.parse(accountCreatedAt) : NaN;
  const ageDays = Number.isFinite(created) ? (now.getTime() - created) / 86_400_000 : Infinity;
  const isNew = ageDays < limits.link_new_account_days;
  return isNew
    ? {
        maxLinks: Math.min(limits.link_new_account_max, limits.link_max_per_user),
        perHour: Math.min(limits.link_new_account_per_hour, limits.link_create_per_hour),
        isNewAccount: true,
      }
    : { maxLinks: limits.link_max_per_user, perHour: limits.link_create_per_hour, isNewAccount: false };
}
