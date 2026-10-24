/** Small helpers for the admin SEO-tool overview pages (Batch 16D). Pure. */
export const daysAgoIso = (days: number, now = Date.now()): string => new Date(now - days * 86_400_000).toISOString();

export const shortDate = (v: unknown): string => String(v ?? "").slice(0, 16).replace("T", " ");

export const pctOf = (part: number, whole: number): string => (whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : "—");

export interface PersonRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

/** "Name (email)" for a user id, or a short id when nothing is known. */
export function personLabel(id: string | null | undefined, people: Map<string, PersonRow>): string {
  if (!id) return "—";
  const p = people.get(id);
  if (!p) return id.slice(0, 8);
  return p.full_name ? (p.email ? `${p.full_name} (${p.email})` : p.full_name) : p.email ?? id.slice(0, 8);
}

export const uniqueIds = (values: (string | null | undefined)[]): string[] => [...new Set(values.filter((v): v is string => !!v))];

/** True when an ISO time is more than `days` days before `now` (false for a missing time). */
export const isOlderThan = (iso: string | null | undefined, days: number, now = Date.now()): boolean => !!iso && now - new Date(iso).getTime() > days * 86_400_000;
