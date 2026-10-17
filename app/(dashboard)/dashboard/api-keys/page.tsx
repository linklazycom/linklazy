import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ApiKeyManager, type ApiKeyView } from "@/components/api-keys/api-key-manager";
import { getLinkLimits, isLinkFeatureOn } from "@/lib/links/server";

export const metadata = { title: "API keys" };

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!(await isLinkFeatureOn())) {
    return (
      <div>
        <h1 className="mb-2 font-display text-2xl font-medium">API keys</h1>
        <p className="text-muted">Link management is temporarily turned off. Please check back soon.</p>
      </div>
    );
  }

  // api_keys has no browser-readable policy on purpose (not even hashes leave the server): read it here with the service client, scoped to this user.
  const svc = createServiceClient();
  const [{ data: rows }, limits, { data: profile }] = await Promise.all([
    svc.from("api_keys").select("id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    getLinkLimits(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const nowMs = new Date().getTime();
  const keys: ApiKeyView[] = (rows ?? []).map((k) => ({ ...k, expired: !!k.expires_at && Date.parse(k.expires_at) <= nowMs }));
  const isAdmin = profile?.role === "admin";
  const active = keys.filter((k) => !k.revoked_at).length;
  const max = limits.api_max_keys_per_user;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">API keys</h1>
        <p className="text-sm text-muted">
          Create short links and read click statistics from your own tools. Limit: {limits.api_rate_per_minute} requests per minute per key.{" "}
          <Link href="/api-docs" className="underline">
            API documentation
          </Link>
        </p>
      </div>
      {max === 0 && !isAdmin ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">API keys are not available right now.</p>
      ) : (
        <ApiKeyManager keys={keys} canCreate={isAdmin || active < max} />
      )}
    </div>
  );
}
