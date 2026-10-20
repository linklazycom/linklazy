import { createServiceClient } from "@/lib/supabase/service";
import { OUTREACH_SENDER_ADDRESS_KEY, OUTREACH_SENDER_NAME_KEY } from "@/lib/outreach/sender";

type Service = ReturnType<typeof createServiceClient>;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Which of these emails already exist in the given table (lookups in small parallel groups). */
export async function existingEmails(service: Service, table: "outreach_contacts" | "outreach_suppressions", emails: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const groups = chunk(emails, 100);
  for (let i = 0; i < groups.length; i += 5) {
    const results = await Promise.all(
      groups.slice(i, i + 5).map(async (g) => {
        const { data, error } = await service.from(table).select("email").in("email", g);
        if (error) throw new Error("Could not check existing contacts");
        return data ?? [];
      })
    );
    for (const rows of results) for (const r of rows) found.add(r.email as string);
  }
  return found;
}

export async function getSenderIdentity(service: Service = createServiceClient()): Promise<{ name: string; address: string }> {
  const { data } = await service.from("site_settings").select("key, value").in("key", [OUTREACH_SENDER_NAME_KEY, OUTREACH_SENDER_ADDRESS_KEY]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { name: str(map.get(OUTREACH_SENDER_NAME_KEY)), address: str(map.get(OUTREACH_SENDER_ADDRESS_KEY)) };
}

// ---------------------------------------------------------------------------
// Sending switch (Batch 16B-2). Unlike the other feature flags, a MISSING value means OFF.
// ---------------------------------------------------------------------------
export const OUTREACH_PUSH_KEY = "outreach_push_enabled";

export async function isPushEnabled(service: Service = createServiceClient()): Promise<boolean> {
  const { data } = await service.from("site_settings").select("value").eq("key", OUTREACH_PUSH_KEY).maybeSingle();
  return data?.value === true || data?.value === "true";
}

export async function setPushEnabled(enabled: boolean, adminId: string, service: Service = createServiceClient()): Promise<boolean> {
  const { error } = await service.from("site_settings").upsert({ key: OUTREACH_PUSH_KEY, value: enabled, updated_by: adminId, updated_at: new Date().toISOString() });
  return !error;
}

export const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();

/** ISO timestamp for "n days ago" (kept out of page components, which must stay pure). */
export const daysAgoIso = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();
