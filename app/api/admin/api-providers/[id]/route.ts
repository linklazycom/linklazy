import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { encryptProviderKey, isEncryptionConfigured } from "@/lib/api-providers";
import { assertPublicHttpUrl } from "@/lib/safe-url";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changed: string[] = [];

  if (typeof body.enabled === "boolean") { update.enabled = body.enabled; changed.push("enabled"); }
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    update.name = name; changed.push("name");
  }
  if (typeof body.model === "string") {
    const model = body.model.trim().slice(0, 120);
    if (!model) return NextResponse.json({ error: "Model is required" }, { status: 400 });
    update.model = model; changed.push("model");
  }
  if (typeof body.base_url === "string") {
    const raw = body.base_url.trim();
    if (raw) {
      try {
        update.base_url = assertPublicHttpUrl(raw).toString().replace(/\/+$/, "");
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid base URL" }, { status: 400 });
      }
    } else {
      update.base_url = null;
    }
    changed.push("base_url");
  }
  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (!Number.isFinite(p)) return NextResponse.json({ error: "Priority must be a number" }, { status: 400 });
    update.priority = Math.max(0, Math.min(10000, Math.floor(p))); changed.push("priority");
  }
  for (const field of ["daily_limit", "monthly_limit"] as const) {
    if (body[field] !== undefined) {
      if (body[field] === "" || body[field] === null) {
        update[field] = null;
      } else {
        const n = Number(body[field]);
        if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "Limits must be non-negative numbers" }, { status: 400 });
        update[field] = Math.floor(n);
      }
      changed.push(field);
    }
  }
  if (typeof body.notes === "string") { update.notes = body.notes.slice(0, 500) || null; changed.push("notes"); }
  if (typeof body.api_key === "string" && body.api_key.trim()) {
    if (!isEncryptionConfigured()) {
      return NextResponse.json({ error: "PROVIDER_KEY_ENCRYPTION_SECRET is not set on the server." }, { status: 400 });
    }
    update.api_key_encrypted = encryptProviderKey(body.api_key.trim());
    changed.push("api_key");
  }

  if (changed.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from("api_providers").update(update).eq("id", id);
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "A provider with this name already exists" : "Could not update provider" }, { status: dup ? 409 : 500 });
  }

  await auth.supabase.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: "api_provider_updated",
    target_table: "api_providers",
    target_id: id,
    metadata: { fields: changed }, // field names only — never values or keys
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;

  const service = createServiceClient();
  const { error } = await service.from("api_providers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete provider" }, { status: 500 });

  await auth.supabase.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: "api_provider_deleted",
    target_table: "api_providers",
    target_id: id,
    metadata: {},
  });
  return NextResponse.json({ ok: true });
}
