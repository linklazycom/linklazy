/** Formatting helpers for the analytics page and CSV export (Batch 10). Pure. */
export interface Counted {
  key: string;
  clicks: number;
}
export interface DailyPoint {
  day: string; // YYYY-MM-DD (UTC)
  clicks: number;
  uniques: number;
}
export interface LinkAnalytics {
  days: number;
  from: string;
  totals: { clicks: number; uniques: number; qr: number };
  daily: DailyPoint[];
  countries: Counted[];
  devices: Counted[];
  browsers: Counted[];
  referrers: Counted[];
  sources: Counted[];
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};
const counted = (v: unknown): Counted[] =>
  Array.isArray(v) ? v.map((r) => ({ key: String((r as { key?: unknown }).key ?? ""), clicks: num((r as { clicks?: unknown }).clicks) })) : [];

/** Defensive parse of the SQL function's JSON. Returns null when the input isn't the expected object. */
export function parseAnalytics(raw: unknown): LinkAnalytics | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const totals = (r.totals ?? {}) as Record<string, unknown>;
  return {
    days: num(r.days),
    from: String(r.from ?? ""),
    totals: { clicks: num(totals.clicks), uniques: num(totals.uniques), qr: num(totals.qr) },
    daily: Array.isArray(r.daily)
      ? r.daily.map((d) => ({
          day: String((d as { day?: unknown }).day ?? ""),
          clicks: num((d as { clicks?: unknown }).clicks),
          uniques: num((d as { uniques?: unknown }).uniques),
        }))
      : [],
    countries: counted(r.countries),
    devices: counted(r.devices),
    browsers: counted(r.browsers),
    referrers: counted(r.referrers),
    sources: counted(r.sources),
  };
}

/** Every day of the window, zero-filled, oldest first. `from` is YYYY-MM-DD (UTC). */
export function fillDaily(daily: DailyPoint[], from: string, days: number): DailyPoint[] {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const start = Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(start)) return daily;
  const out: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, clicks: 0, uniques: 0 });
  }
  return out;
}

export function countryName(code: string, locale = "en"): string {
  if (code === "??") return "Unknown";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function percent(part: number, total: number): string {
  if (total <= 0) return "0%";
  const p = (part / total) * 100;
  return `${p >= 10 ? Math.round(p) : Math.round(p * 10) / 10}%`;
}
