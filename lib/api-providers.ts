import { createServiceClient } from "@/lib/supabase/service";
import { safeFetch, SafeFetchError } from "@/lib/safe-fetch";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/provider-crypto";
import { buildAiRequest, isAiAdapter, parseAiResponse, type AiAdapterId, type AiTurn } from "@/lib/providers/adapters";
import { buildImageSearchRequest, isImageAdapter, parseImageResponse, type StockImage } from "@/lib/providers/images";
import { EXTERNAL_APIS_FLAG, getFlags } from "@/lib/feature-flags";
import { sanitizeError } from "@/lib/task-utils";

/**
 * Server-only orchestration for admin-managed API providers.
 *  - keys are stored AES-256-GCM encrypted (lib/provider-crypto.ts) and are
 *    never returned to the browser (only a masked hint)
 *  - every outbound call goes through safeFetch (SSRF-safe)
 *  - global kill switch + per-feature kill switch + per-provider on/off
 *  - per-provider daily / monthly call limits, priority order, automatic fallback
 *  - every call is logged WITHOUT prompts or keys
 */

export interface ProviderRow {
  id: string;
  name: string;
  kind: "ai" | "search" | "image";
  adapter: string;
  base_url: string | null;
  model: string | null;
  api_key_encrypted: string | null;
  priority: number;
  enabled: boolean;
  daily_limit: number | null;
  monthly_limit: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** What the admin UI is allowed to see (never the key, only a hint that one is stored). */
export interface ProviderPublic extends Omit<ProviderRow, "api_key_encrypted"> {
  has_key: boolean;
  key_hint: string | null;
  used_today: number;
  used_month: number;
}

function masterSecret(): string {
  return process.env.PROVIDER_KEY_ENCRYPTION_SECRET ?? "";
}

export function isEncryptionConfigured(): boolean {
  return masterSecret().trim().length >= 16;
}

/** Encrypts a new key for storage. Throws a clear error if the master secret is missing. */
export function encryptProviderKey(plainKey: string): string {
  return encryptSecret(plainKey, masterSecret());
}

function startOfUtcDay(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}
function startOfUtcMonth(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function countUsage(providerId: string, sinceIso: string): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("api_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .neq("feature", "provider_test")
    .gte("created_at", sinceIso);
  return count ?? 0;
}

export async function listProvidersPublic(): Promise<ProviderPublic[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("api_providers")
    .select("*")
    .order("kind", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as ProviderRow[];
  const out: ProviderPublic[] = [];
  for (const row of rows) {
    let keyHint: string | null = null;
    if (row.api_key_encrypted && isEncryptionConfigured()) {
      try {
        keyHint = maskSecret(decryptSecret(row.api_key_encrypted, masterSecret()));
      } catch {
        keyHint = "(unreadable — re-enter key)";
      }
    }
    const { api_key_encrypted, ...rest } = row;
    out.push({
      ...rest,
      has_key: !!api_key_encrypted,
      key_hint: keyHint,
      used_today: await countUsage(row.id, startOfUtcDay()),
      used_month: await countUsage(row.id, startOfUtcMonth()),
    });
  }
  return out;
}

async function logUsage(entry: {
  providerId: string | null;
  providerName: string;
  feature: string;
  userId?: string | null;
  ok: boolean;
  status?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  error?: string | null;
  durationMs: number;
}) {
  try {
    const supabase = createServiceClient();
    await supabase.from("api_usage_log").insert({
      provider_id: entry.providerId,
      provider_name: entry.providerName,
      feature: entry.feature,
      user_id: entry.userId ?? null,
      ok: entry.ok,
      http_status: entry.status ?? null,
      input_tokens: entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
      error: entry.error ? sanitizeError(entry.error) : null,
      duration_ms: entry.durationMs,
    });
  } catch {
    // Logging must never break the feature that called us.
  }
}

export type AiUnavailableCode = "disabled" | "not_configured" | "all_failed";

export class AiUnavailableError extends Error {
  code: AiUnavailableCode;
  constructor(code: AiUnavailableCode, message: string) {
    super(message);
    this.name = "AiUnavailableError";
    this.code = code;
  }
}

export interface CallAiInput {
  /** The feature flag key, e.g. "feature_ai_content". Used for the kill switch and the usage log. */
  feature: string;
  system?: string;
  messages: AiTurn[];
  maxTokens?: number;
  temperature?: number;
  userId?: string | null;
}

export interface CallAiResult {
  text: string;
  providerName: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

interface AttemptResult {
  ok: true;
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

async function attemptProvider(
  provider: ProviderRow,
  input: { system?: string; messages: AiTurn[]; maxTokens: number; temperature?: number }
): Promise<AttemptResult> {
  if (!isAiAdapter(provider.adapter)) throw new Error(`Unsupported adapter "${provider.adapter}"`);
  if (!provider.api_key_encrypted) throw new Error("No API key saved");
  if (!provider.model) throw new Error("No model set");

  const apiKey = decryptSecret(provider.api_key_encrypted, masterSecret());
  const req = buildAiRequest({
    adapter: provider.adapter as AiAdapterId,
    baseUrl: provider.base_url,
    apiKey,
    model: provider.model,
    system: input.system,
    messages: input.messages,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });

  let res;
  try {
    res = await safeFetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      timeoutMs: 60_000,
      maxBytes: 1024 * 1024,
      maxRedirects: 0, // an API endpoint that redirects is suspicious; do not follow
    });
  } catch (err) {
    if (err instanceof SafeFetchError) throw new Error(`Request failed (${err.code}): ${err.message}`);
    throw err;
  }

  if (!res.ok) {
    // Provider error bodies can echo input; keep only a short sanitized snippet.
    throw new Error(`HTTP ${res.status}: ${sanitizeError(res.text, 160)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw new Error("The provider returned a non-JSON response.");
  }
  const parsed = parseAiResponse(provider.adapter as AiAdapterId, json);
  return { ok: true, ...parsed };
}

/**
 * The single entry point features use to call an AI model. Respects the
 * kill switches, provider priority, limits and fallback. Throws
 * AiUnavailableError (never a raw provider error) so callers can show a
 * clean message and — importantly — NOT charge the user.
 */
export async function callAi(input: CallAiInput): Promise<CallAiResult> {
  const flags = await getFlags([EXTERNAL_APIS_FLAG, input.feature]);
  if (!flags[EXTERNAL_APIS_FLAG] || !flags[input.feature]) {
    throw new AiUnavailableError("disabled", "This feature is currently switched off.");
  }
  if (!isEncryptionConfigured()) {
    throw new AiUnavailableError("not_configured", "AI is not set up yet.");
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("api_providers")
    .select("*")
    .eq("kind", "ai")
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  const providers = (data ?? []) as ProviderRow[];
  if (providers.length === 0) throw new AiUnavailableError("not_configured", "AI is not set up yet.");

  const maxTokens = input.maxTokens ?? 1000;
  let attempted = 0;

  for (const provider of providers) {
    if (provider.daily_limit !== null && (await countUsage(provider.id, startOfUtcDay())) >= provider.daily_limit) continue;
    if (provider.monthly_limit !== null && (await countUsage(provider.id, startOfUtcMonth())) >= provider.monthly_limit) continue;

    attempted++;
    const started = Date.now();
    try {
      const r = await attemptProvider(provider, {
        system: input.system,
        messages: input.messages,
        maxTokens,
        temperature: input.temperature,
      });
      await logUsage({
        providerId: provider.id,
        providerName: provider.name,
        feature: input.feature,
        userId: input.userId,
        ok: true,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        durationMs: Date.now() - started,
      });
      return { text: r.text, providerName: provider.name, model: provider.model ?? "", inputTokens: r.inputTokens, outputTokens: r.outputTokens };
    } catch (err) {
      await logUsage({
        providerId: provider.id,
        providerName: provider.name,
        feature: input.feature,
        userId: input.userId,
        ok: false,
        error: err instanceof Error ? err.message : "error",
        durationMs: Date.now() - started,
      });
    }
  }

  throw new AiUnavailableError(
    "all_failed",
    attempted === 0 ? "AI usage limit reached for now. Please try again later." : "AI is temporarily unavailable. Please try again."
  );
}

// ---------------------------------------------------------------------------
// Stock images (Batch 15)
// ---------------------------------------------------------------------------

async function attemptImageProvider(provider: ProviderRow, query: string): Promise<StockImage[]> {
  if (!isImageAdapter(provider.adapter)) throw new Error(`Unsupported adapter "${provider.adapter}"`);
  if (!provider.api_key_encrypted) throw new Error("No API key saved");

  const req = buildImageSearchRequest({
    adapter: provider.adapter,
    apiKey: decryptSecret(provider.api_key_encrypted, masterSecret()),
    query,
    baseUrl: provider.base_url,
  });

  let res;
  try {
    res = await safeFetch(req.url, { method: "GET", headers: req.headers, timeoutMs: 15_000, maxBytes: 1024 * 1024, maxRedirects: 0 });
  } catch (err) {
    if (err instanceof SafeFetchError) throw new Error(`Request failed (${err.code}): ${err.message}`);
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${sanitizeError(res.text, 160)}`);

  let json: unknown;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw new Error("The provider returned a non-JSON response.");
  }
  return parseImageResponse(provider.adapter, json);
}

// Small per-instance cache: saves free-tier quota and satisfies providers that ask for caching.
const IMAGE_CACHE_TTL_MS = 10 * 60_000;
const IMAGE_CACHE_MAX = 100;
const imageCache = new Map<string, { at: number; images: StockImage[] }>();

/**
 * Searches stock photos through the admin-managed image providers (kill switches, priority, limits and
 * fallback like callAi). Throws AiUnavailableError when nothing could answer. Results are only links and
 * previews: no image is downloaded or stored here.
 */
export async function searchStockImages(input: { query: string; userId?: string | null }): Promise<StockImage[]> {
  const feature = "feature_ai_content";
  const flags = await getFlags([EXTERNAL_APIS_FLAG, feature]);
  if (!flags[EXTERNAL_APIS_FLAG] || !flags[feature]) {
    throw new AiUnavailableError("disabled", "Stock image search is currently switched off.");
  }
  if (!isEncryptionConfigured()) throw new AiUnavailableError("not_configured", "Stock image search is not set up yet.");

  const cacheKey = input.query.toLowerCase();
  const hit = imageCache.get(cacheKey);
  if (hit && Date.now() - hit.at < IMAGE_CACHE_TTL_MS) return hit.images;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("api_providers")
    .select("*")
    .eq("kind", "image")
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  const providers = (data ?? []) as ProviderRow[];
  if (providers.length === 0) throw new AiUnavailableError("not_configured", "Stock image search is not set up yet.");

  let attempted = 0;
  for (const provider of providers) {
    if (provider.daily_limit !== null && (await countUsage(provider.id, startOfUtcDay())) >= provider.daily_limit) continue;
    if (provider.monthly_limit !== null && (await countUsage(provider.id, startOfUtcMonth())) >= provider.monthly_limit) continue;

    attempted++;
    const started = Date.now();
    try {
      const images = await attemptImageProvider(provider, input.query);
      await logUsage({ providerId: provider.id, providerName: provider.name, feature: "stock_images", userId: input.userId, ok: true, durationMs: Date.now() - started });
      if (imageCache.size >= IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value as string);
      imageCache.set(cacheKey, { at: Date.now(), images });
      return images;
    } catch (err) {
      await logUsage({ providerId: provider.id, providerName: provider.name, feature: "stock_images", userId: input.userId, ok: false, error: err instanceof Error ? err.message : "error", durationMs: Date.now() - started });
    }
  }

  throw new AiUnavailableError(
    "all_failed",
    attempted === 0 ? "Stock image search limit reached for now. Please try again later." : "Stock image search is temporarily unavailable. Please try again."
  );
}

/** Admin "Test connection": one tiny call, ignores the enabled flag and the kill switches. */
export async function testProvider(providerId: string): Promise<{ ok: boolean; ms: number; message: string }> {
  if (!isEncryptionConfigured()) {
    return { ok: false, ms: 0, message: "PROVIDER_KEY_ENCRYPTION_SECRET is not set on the server." };
  }
  const supabase = createServiceClient();
  const { data } = await supabase.from("api_providers").select("*").eq("id", providerId).single();
  const provider = data as ProviderRow | null;
  if (!provider) return { ok: false, ms: 0, message: "Provider not found." };
  if (provider.kind === "image") {
    const started = Date.now();
    try {
      const images = await attemptImageProvider(provider, "nature");
      const ms = Date.now() - started;
      await logUsage({ providerId: provider.id, providerName: provider.name, feature: "provider_test", ok: true, durationMs: ms });
      return { ok: true, ms, message: images.length > 0 ? "Connected successfully." : "Connected, but the test search returned no photos." };
    } catch (err) {
      const ms = Date.now() - started;
      const message = sanitizeError(err);
      await logUsage({ providerId: provider.id, providerName: provider.name, feature: "provider_test", ok: false, error: message, durationMs: ms });
      return { ok: false, ms, message };
    }
  }
  if (provider.kind !== "ai") return { ok: false, ms: 0, message: "Test is only available for AI and image providers for now." };

  const started = Date.now();
  try {
    const r = await attemptProvider(provider, {
      system: "You are a connectivity test. Reply with exactly one word.",
      messages: [{ role: "user", content: "Reply with the word: ok" }],
      maxTokens: 16,
    });
    const ms = Date.now() - started;
    await logUsage({ providerId: provider.id, providerName: provider.name, feature: "provider_test", ok: true, inputTokens: r.inputTokens, outputTokens: r.outputTokens, durationMs: ms });
    return { ok: true, ms, message: "Connected successfully." };
  } catch (err) {
    const ms = Date.now() - started;
    const message = sanitizeError(err);
    await logUsage({ providerId: provider.id, providerName: provider.name, feature: "provider_test", ok: false, error: message, durationMs: ms });
    return { ok: false, ms, message };
  }
}
