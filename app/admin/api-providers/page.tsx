import { listProvidersPublic, isEncryptionConfigured } from "@/lib/api-providers";
import { EXTERNAL_APIS_FLAG, FEATURE_FLAGS, getFlags } from "@/lib/feature-flags";
import { ApiProvidersManager } from "@/components/admin/api-providers-manager";

export const dynamic = "force-dynamic";

export default async function AdminApiProvidersPage() {
  // The admin layout already blocks non-admins; every API route below also re-checks.
  const keys = [EXTERNAL_APIS_FLAG, ...FEATURE_FLAGS.map((f) => f.key)];
  const flagValues = await getFlags(keys);
  const flags = [
    { key: EXTERNAL_APIS_FLAG, label: "ALL external APIs (master switch)", on: flagValues[EXTERNAL_APIS_FLAG] },
    ...FEATURE_FLAGS.map((f) => ({ key: f.key as string, label: f.label as string, on: flagValues[f.key] })),
  ];
  const providers = await listProvidersPublic();

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-medium">API Providers</h1>
      <p className="mb-6 text-sm text-muted">
        Add, switch, limit or remove the AI services LinkLazy uses — no code change needed.
      </p>
      <ApiProvidersManager providers={providers} flags={flags} encryptionConfigured={isEncryptionConfigured()} />
    </div>
  );
}
