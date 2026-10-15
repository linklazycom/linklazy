import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateSlug } from "@/lib/links/slug";
import { cleanText } from "@/lib/links/fields";
import { clearLinkConfigCache } from "@/lib/links/server";
import { normalizeBlockDomain } from "@/lib/links/blocklist";

const addSchema = z.object({
  kind: z.enum(["domain", "slug"]),
  value: z.string().min(1).max(200),
  reason: z.string().max(300).nullish(),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const parsed = addSchema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  let value: string;
  if (parsed.data.kind === "domain") {
    const d = normalizeBlockDomain(parsed.data.value);
    if (!d) return NextResponse.json({ error: "Enter a valid domain, e.g. example.com." }, { status: 400 });
    value = d;
  } else {
    const s = validateSlug(parsed.data.value);
    // A reserved slug is already unusable, so blocking it again would just be noise.
    if (!s.ok && s.error !== "reserved") return NextResponse.json({ error: s.message }, { status: 400 });
    value = s.ok ? s.slug : parsed.data.value.trim().toLowerCase();
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("link_blocklist")
    .insert({ kind: parsed.data.kind, value, reason: cleanText(parsed.data.reason, 300), created_by: adminId });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Already on the blocklist." }, { status: 409 });
    return NextResponse.json({ error: "Could not add to the blocklist." }, { status: 500 });
  }
  clearLinkConfigCache();
  await supabase.from("admin_logs").insert({ admin_id: adminId, action: "link_blocklist_add", target_table: "link_blocklist", target_id: null, metadata: { kind: parsed.data.kind, value } });
  return NextResponse.json({ ok: true, value });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { adminId, supabase } = admin;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc.from("link_blocklist").delete().eq("id", id).select("kind, value");
  if (error) return NextResponse.json({ error: "Could not remove the entry." }, { status: 500 });
  clearLinkConfigCache();
  await supabase.from("admin_logs").insert({ admin_id: adminId, action: "link_blocklist_remove", target_table: "link_blocklist", target_id: id, metadata: data?.[0] ?? {} });
  return NextResponse.json({ ok: true });
}
