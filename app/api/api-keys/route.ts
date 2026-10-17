import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { readJson } from "@/lib/links/http";
import { getLinkLimits } from "@/lib/links/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanKeyName, cleanScopes, generateApiKey } from "@/lib/api/keys";

const schema = z.object({
  name: z.string().max(100),
  scopes: z.array(z.string().max(30)).max(5),
  expires_in_days: z.number().int().min(1).max(365).nullish(),
});

export async function POST(request: Request) {
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 5_000));
  const name = parsed.success ? cleanKeyName(parsed.data.name) : null;
  const scopes = parsed.success ? cleanScopes(parsed.data.scopes) : null;
  if (!parsed.success || !name) return NextResponse.json({ error: "Give the key a name.", field: "name" }, { status: 400 });
  if (!scopes) return NextResponse.json({ error: "Choose at least one permission.", field: "scopes" }, { status: 400 });

  const svc = createServiceClient();
  if (!gate.ctx.isAdmin) {
    const limits = await getLinkLimits();
    if (limits.api_max_keys_per_user === 0) return NextResponse.json({ error: "API keys are not available right now." }, { status: 403 });
    const { count } = await svc.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", gate.ctx.userId).is("revoked_at", null);
    if ((count ?? 0) >= limits.api_max_keys_per_user) {
      return NextResponse.json({ error: `You can have up to ${limits.api_max_keys_per_user} active API keys. Revoke one first.` }, { status: 403 });
    }
  }

  const { key, prefix, hash } = generateApiKey();
  const expires = parsed.data.expires_in_days ? new Date(Date.now() + parsed.data.expires_in_days * 86_400_000).toISOString() : null;
  const { data, error } = await svc
    .from("api_keys")
    .insert({ user_id: gate.ctx.userId, name, key_prefix: prefix, key_hash: hash, scopes, expires_at: expires })
    .select("id, name, key_prefix, scopes, expires_at, created_at")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not create the key. Please try again." }, { status: 500 });
  // The full key is returned exactly once; only its hash is stored.
  return NextResponse.json({ key, api_key: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
