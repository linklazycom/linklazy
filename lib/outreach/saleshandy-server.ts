import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptSecret, encryptSecret } from "@/lib/provider-crypto";
import { isEncryptionConfigured } from "@/lib/api-providers";
import { safeFetch, SafeFetchError } from "@/lib/safe-fetch";
import { sanitizeError } from "@/lib/task-utils";
import { parseSequences, SALESHANDY_BASE, type FieldMap } from "@/lib/outreach/saleshandy";

type Service = ReturnType<typeof createServiceClient>;

export interface ConnectionRow {
  id: number;
  api_key_encrypted: string | null;
  api_key_hint: string | null;
  webhook_secret: string;
  field_map: FieldMap;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
}

const newSecret = () => randomBytes(24).toString("base64url"); // 32 URL-safe characters

export async function loadConnection(service: Service = createServiceClient()): Promise<ConnectionRow | null> {
  const { data } = await service.from("outreach_connection").select("*").eq("id", 1).maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/** Creates the single connection row (with its webhook secret) the first time it is needed. */
export async function ensureConnection(adminId: string, service: Service = createServiceClient()): Promise<ConnectionRow> {
  const existing = await loadConnection(service);
  if (existing) return existing;
  await service.from("outreach_connection").upsert({ id: 1, provider: "saleshandy", webhook_secret: newSecret(), field_map: {}, updated_by: adminId }, { onConflict: "id", ignoreDuplicates: true });
  const row = await loadConnection(service);
  if (!row) throw new Error("Could not create the connection");
  return row;
}

export async function saveApiKey(adminId: string, apiKey: string, service: Service = createServiceClient()): Promise<void> {
  if (!isEncryptionConfigured()) throw new Error("PROVIDER_KEY_ENCRYPTION_SECRET is not set, so keys cannot be stored safely.");
  await ensureConnection(adminId, service);
  const secret = process.env.PROVIDER_KEY_ENCRYPTION_SECRET as string;
  const { error } = await service
    .from("outreach_connection")
    .update({ api_key_encrypted: encryptSecret(apiKey, secret), api_key_hint: apiKey.slice(-4), last_test_at: null, last_test_ok: null, last_test_message: null, updated_by: adminId, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error("Could not save the key");
}

export async function rotateWebhookSecret(adminId: string, service: Service = createServiceClient()): Promise<string> {
  await ensureConnection(adminId, service);
  const secret = newSecret();
  const { error } = await service.from("outreach_connection").update({ webhook_secret: secret, updated_by: adminId, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error("Could not rotate the secret");
  return secret;
}

export function decryptApiKey(row: ConnectionRow): string | null {
  if (!row.api_key_encrypted || !isEncryptionConfigured()) return null;
  try {
    return decryptSecret(row.api_key_encrypted, process.env.PROVIDER_KEY_ENCRYPTION_SECRET as string);
  } catch {
    return null;
  }
}

/** Constant-time check of the secret in the webhook URL. */
export function webhookSecretMatches(row: ConnectionRow | null, given: string): boolean {
  if (!row) return false;
  const a = Buffer.from(row.webhook_secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ShResponse {
  status: number;
  json: unknown;
}

/** One call to Saleshandy through the SSRF-safe client (fixed host, no redirects). */
export async function shRequest(apiKey: string, path: string, init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" }): Promise<ShResponse> {
  let res;
  try {
    res = await safeFetch(`${SALESHANDY_BASE}${path}`, {
      method: init.method,
      headers: { "x-api-key": apiKey, Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      timeoutMs: 25_000,
      maxBytes: 2 * 1024 * 1024,
      maxRedirects: 0,
    });
  } catch (err) {
    if (err instanceof SafeFetchError) throw new Error(`Could not reach Saleshandy (${err.code}).`);
    throw err;
  }
  let json: unknown = null;
  try {
    json = JSON.parse(res.text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** "Test connection": lists the sequences. 401/403 means the key is wrong. */
export async function testSaleshandy(adminId: string, service: Service = createServiceClient()): Promise<{ ok: boolean; message: string; sequences: { id: string; name: string }[] }> {
  const row = await loadConnection(service);
  const key = row ? decryptApiKey(row) : null;
  if (!row || !key) return { ok: false, message: "Save your Saleshandy API key first.", sequences: [] };

  let result: { ok: boolean; message: string; sequences: { id: string; name: string }[] };
  try {
    const res = await shRequest(key, "/sequences");
    if (res.status === 401 || res.status === 403) result = { ok: false, message: "Saleshandy rejected this API key (wrong, deleted or no API access on the plan).", sequences: [] };
    else if (res.status < 200 || res.status >= 300) result = { ok: false, message: `Saleshandy answered HTTP ${res.status}. Try again in a moment.`, sequences: [] };
    else {
      const sequences = parseSequences(res.json);
      result = { ok: true, message: sequences.length > 0 ? `Connected. ${sequences.length} sequence(s) found.` : "Connected. No sequences could be listed (you can still type a sequence id by hand).", sequences };
    }
  } catch (err) {
    result = { ok: false, message: sanitizeError(err, 160), sequences: [] };
  }
  await service
    .from("outreach_connection")
    .update({ last_test_at: new Date().toISOString(), last_test_ok: result.ok, last_test_message: result.message.slice(0, 300), updated_by: adminId })
    .eq("id", 1);
  return result;
}
