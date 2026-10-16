import { toCsv } from "@/lib/links/csv";
import { fillDaily, type LinkAnalytics } from "@/lib/analytics/format";

/** One flat CSV: section,key,clicks,uniques. (Formula-injection guarded via toCsv.) */
export function analyticsToCsv(a: LinkAnalytics): string {
  const rows: unknown[][] = [];
  for (const d of fillDaily(a.daily, a.from, a.days)) rows.push(["daily", d.day, d.clicks, d.uniques]);
  const sections: [string, { key: string; clicks: number }[]][] = [
    ["country", a.countries],
    ["device", a.devices],
    ["browser", a.browsers],
    ["referrer", a.referrers],
    ["source", a.sources],
  ];
  for (const [name, list] of sections) for (const r of list) rows.push([name, r.key, r.clicks, ""]);
  return toCsv(["section", "key", "clicks", "uniques"], rows);
}
