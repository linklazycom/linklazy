import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { encryptProviderKey, isEncryptionConfigured, listProvidersPublic } from "@/lib/api-providers";
import { isAiAdapter } from "@/lib/providers/adapters";
import { assertPublicHttpUrl } from "@/lib/safe-url";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  return NextResponse.json({ providers: await listProvidersPublic(), encryptionConfigured: isEncryptionConfigured() });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const name = String(body.name ?? "").trim().slice(0, 80);
  const adapter = String(body.adapter ?? "");
  const model = String(body.model ?? "").trim().slice(0, 120);
  const baseUrlRaw = String(body.base_url ?? "").trim();
  const apiKey = String(body.api_key ?? "").trim();
  const priority = Number.isFinite(Number(body.priority)) ? Math.max(0, Math.min(10000, Math.floor(Number(body.priority)))) : 100;
  const dailyLimit = body.daily_limit === "" || body.daily_limit == null ? null : Math.max(0, Math.floor(Number(body.daily_limit)));
  const monthlyLimit = body.monthly_limit === "" || body.monthly_limit == null ? null : Math.max(0, Math.floor(Number(body.monthly_limit)));

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!isAiAdapter(adapter)) return NextResponse.json({ error: "Unsupported adapter" }, { status: 400 });
  if (!model) return NextResponse.json({ error: "Model is required" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "API key is required" }, { status: 400 });
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      { error: "PROVIDER_KEY_ENCRYPTION_SECRET is not set on the server (add it in Vercel → Environment Variables, then redeploy)." },
      { status: 400 }
    );
  }
  if ((dailyLimit !== null && Number.isNaN(dailyLimit)) || (monthlyLimit !== null && Number.isNaN(monthlyLimit))) {
    return NextResponse.json({ error: "Limits must be numbers" }, { status: 400 });
  }

  let baseUrl: string | null = null;
  if (baseUrlRaw) {
    try {
      baseUrl = assertPublicHttpUrl(baseUrlRaw).toString().replace(/\/+$/, "");
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid base URL" }, { status: 400 });
    }
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("api_providers")
    .insert({
      name,
      kind: "ai",
      adapter,
      base_url: baseUrl,
      model,
      api_key_encrypted: encryptProviderKey(apiKey),
      priority,
      enabled: false, // new providers start OFF; the admin tests then enables
      daily_limit: dailyLimit,
      monthly_limit: monthlyLimit,
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
      created_by: auth.adminId,
    })
    .select("id")
    .single();

  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "A provider with this name already exists" : "Could not save provider" }, { status: dup ? 409 : 500 });
  }

  // Audit trail: never log the key.
  await auth.supabase.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: "api_provider_created",
    target_table: "api_providers",
    target_id: data.id,
    metadata: { name, adapter, model },
  });

  return NextResponse.json({ ok: true, id: data.id });
}
