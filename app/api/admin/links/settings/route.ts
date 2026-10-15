import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { readJson } from "@/lib/links/http";
import { LINK_LIMIT_DEFS } from "@/lib/links/limits";
import { clearLinkConfigCache } from "@/lib/links/server";

/** Saves the admin-configurable link limits into site_settings (one row per key). */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const body = (await readJson(request, 10_000)) as { values?: Record<string, unknown> } | null;
  const values = body?.values;
  if (!values || typeof values !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const rows: { key: string; value: number; updated_by: string; updated_at: string }[] = [];
  for (const def of LINK_LIMIT_DEFS) {
    if (!(def.key in values)) continue;
    const n = Number(values[def.key]);
    if (!Number.isInteger(n) || n < def.min || n > def.max) {
      return NextResponse.json({ error: `"${def.label}" must be a whole number between ${def.min} and ${def.max}.` }, { status: 400 });
    }
    rows.push({ key: def.key, value: n, updated_by: adminId, updated_at: new Date().toISOString() });
  }
  if (rows.length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  for (const row of rows) {
    const { error } = await supabase.from("site_settings").upsert(row);
    if (error) return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
  clearLinkConfigCache();
  await supabase.from("admin_logs").insert({ admin_id: adminId, action: "link_settings_update", target_table: "site_settings", target_id: null, metadata: { keys: rows.map((r) => r.key) } });
  return NextResponse.json({ ok: true });
}
