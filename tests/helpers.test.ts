import test from "node:test";
import assert from "node:assert/strict";
import { verifyCronAuth } from "../lib/cron-secret.ts";
import { sanitizeTrackPayload, TRACK_LIMITS } from "../lib/track-payload.ts";
import { createMemoryRateLimiter } from "../lib/memory-rate-limit.ts";
import { computeBackoffMs, sanitizeError } from "../lib/task-utils.ts";
import { decryptSecret, encryptSecret, maskSecret } from "../lib/provider-crypto.ts";
import { buildAiRequest, parseAiResponse } from "../lib/providers/adapters.ts";
import { normalizeFlag } from "../lib/flag-value.ts";

// ---- cron guard (audit R1) ----
test("cron: correct secret passes", () => assert.equal(verifyCronAuth("Bearer s3cret-value", "s3cret-value"), "ok"));
test("cron: wrong secret denied", () => assert.equal(verifyCronAuth("Bearer nope", "s3cret-value"), "denied"));
test("cron: missing header denied", () => assert.equal(verifyCronAuth(null, "s3cret-value"), "denied"));
test("cron: raw secret without 'Bearer ' denied", () => assert.equal(verifyCronAuth("s3cret-value", "s3cret-value"), "denied"));
test("cron: unset secret FAILS CLOSED even for 'Bearer undefined'", () => {
  assert.equal(verifyCronAuth("Bearer undefined", undefined), "unconfigured");
  assert.equal(verifyCronAuth("Bearer undefined", ""), "unconfigured");
  assert.equal(verifyCronAuth("Bearer undefined", "undefined"), "unconfigured");
  assert.equal(verifyCronAuth("Bearer null", "null"), "unconfigured");
  assert.equal(verifyCronAuth("Bearer ", "   "), "unconfigured");
});

// ---- /api/track payload (audit R7) ----
test("track: normal payload is kept", () => {
  const p = sanitizeTrackPayload({ path: "/browse", referrer: "https://google.com/", utm_source: "x" });
  assert.deepEqual(p, { path: "/browse", referrer: "https://google.com/", utm_source: "x", utm_medium: null, utm_campaign: null });
});
test("track: oversized fields are clipped", () => {
  const p = sanitizeTrackPayload({ path: "/" + "a".repeat(5000), referrer: "r".repeat(5000), utm_source: "u".repeat(500) });
  assert.equal(p?.path.length, TRACK_LIMITS.path);
  assert.equal(p?.referrer?.length, TRACK_LIMITS.referrer);
  assert.equal(p?.utm_source?.length, TRACK_LIMITS.utm);
});
test("track: non-string values and control characters are dropped", () => {
  const p = sanitizeTrackPayload({ path: "/ok\u0000\n", referrer: 123, utm_source: { a: 1 } });
  assert.equal(p?.path, "/ok");
  assert.equal(p?.referrer, null);
  assert.equal(p?.utm_source, null);
});
test("track: junk input rejected", () => {
  assert.equal(sanitizeTrackPayload(null), null);
  assert.equal(sanitizeTrackPayload("x"), null);
  assert.equal(sanitizeTrackPayload([1]), null);
  assert.equal(sanitizeTrackPayload({ path: "javascript:alert(1)" }), null);
});
test("track: missing path defaults to '/'", () => assert.equal(sanitizeTrackPayload({})?.path, "/"));

// ---- memory rate limiter ----
test("rate limiter: blocks over the limit, frees after the window", () => {
  let t = 0;
  const rl = createMemoryRateLimiter({ max: 3, windowMs: 1000, now: () => t });
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), false);
  assert.equal(rl.allow("b"), true); // other keys unaffected
  t = 1001;
  assert.equal(rl.allow("a"), true);
});
test("rate limiter: memory stays bounded", () => {
  const rl = createMemoryRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 10 });
  for (let i = 0; i < 100; i++) rl.allow(`k${i}`);
  assert.equal(rl.allow("fresh"), true);
});

// ---- task utils ----
test("backoff grows and caps", () => {
  assert.equal(computeBackoffMs(1), 30_000);
  assert.equal(computeBackoffMs(2), 60_000);
  assert.equal(computeBackoffMs(3), 120_000);
  assert.equal(computeBackoffMs(50), 30 * 60_000);
  assert.equal(computeBackoffMs(0), 30_000);
});
test("sanitizeError redacts secrets and emails and caps length", () => {
  const msg = sanitizeError(new Error("401 for Bearer abc123.def-456 key sk-live_ABCDEFGH12345 user@example.com"));
  assert.ok(!msg.includes("abc123"));
  assert.ok(!msg.includes("sk-live"));
  assert.ok(!msg.includes("user@example.com"));
  assert.ok(sanitizeError("x ".repeat(1000)).length <= 300);
  assert.equal(sanitizeError(42), "Unknown error");
});

// ---- provider key encryption ----
const SECRET = "unit-test-master-secret-0123456789";
test("crypto: round trip", () => {
  const enc = encryptSecret("sk-test-1234567890abcdef", SECRET);
  assert.ok(enc.startsWith("v1:"));
  assert.ok(!enc.includes("sk-test"));
  assert.equal(decryptSecret(enc, SECRET), "sk-test-1234567890abcdef");
});
test("crypto: each encryption is different (random IV)", () => {
  assert.notEqual(encryptSecret("same", SECRET), encryptSecret("same", SECRET));
});
test("crypto: wrong secret / tampering fails", () => {
  const enc = encryptSecret("value", SECRET);
  assert.throws(() => decryptSecret(enc, "another-master-secret-0123456789"));
  const parts = enc.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptSecret(parts.join(":"), SECRET));
});
test("crypto: short or missing master secret is refused", () => {
  assert.throws(() => encryptSecret("x", ""));
  assert.throws(() => encryptSecret("x", "short"));
});
test("mask never reveals the middle", () => {
  assert.equal(maskSecret("sk-abcdefghijklmnop"), "sk-a…mnop");
  assert.equal(maskSecret("short"), "••••");
});

// ---- AI adapters ----
test("openai_compatible request: bearer auth, system first, max_completion_tokens on api.openai.com", () => {
  const r = buildAiRequest({ adapter: "openai_compatible", baseUrl: null, apiKey: "KEY", model: "m", system: "S", messages: [{ role: "user", content: "hi" }], maxTokens: 100 });
  assert.equal(r.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(r.headers.authorization, "Bearer KEY");
  const body = JSON.parse(r.body);
  assert.deepEqual(body.messages[0], { role: "system", content: "S" });
  assert.equal(body.max_completion_tokens, 100);
  assert.equal(body.max_tokens, undefined);
});
test("openai_compatible request: other hosts use max_tokens and custom base URL (trailing slash trimmed)", () => {
  const r = buildAiRequest({ adapter: "openai_compatible", baseUrl: "https://api.groq.com/openai/v1/", apiKey: "K", model: "m", messages: [{ role: "user", content: "hi" }], maxTokens: 50, temperature: 0.3 });
  assert.equal(r.url, "https://api.groq.com/openai/v1/chat/completions");
  const body = JSON.parse(r.body);
  assert.equal(body.max_tokens, 50);
  assert.equal(body.temperature, 0.3);
});
test("anthropic request: x-api-key, version header, system separate", () => {
  const r = buildAiRequest({ adapter: "anthropic", baseUrl: null, apiKey: "K", model: "m", system: "S", messages: [{ role: "user", content: "hi" }], maxTokens: 10 });
  assert.equal(r.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r.headers["x-api-key"], "K");
  assert.equal(r.headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(r.body);
  assert.equal(body.system, "S");
  assert.equal(body.max_tokens, 10);
  assert.equal(r.headers.authorization, undefined);
});
test("parse openai response + usage", () => {
  const p = parseAiResponse("openai_compatible", { choices: [{ message: { content: " Hello " } }], usage: { prompt_tokens: 5, completion_tokens: 7 } });
  assert.deepEqual(p, { text: "Hello", inputTokens: 5, outputTokens: 7 });
});
test("parse anthropic response + usage", () => {
  const p = parseAiResponse("anthropic", { content: [{ type: "text", text: "Hi " }, { type: "text", text: "there" }], usage: { input_tokens: 3, output_tokens: 4 } });
  assert.deepEqual(p, { text: "Hi there", inputTokens: 3, outputTokens: 4 });
});
test("parse: empty or malformed responses throw", () => {
  assert.throws(() => parseAiResponse("openai_compatible", {}));
  assert.throws(() => parseAiResponse("anthropic", { content: [] }));
  assert.throws(() => parseAiResponse("anthropic", null));
});

// ---- flags ----
test("flag normalisation", () => {
  assert.equal(normalizeFlag("on", false), true);
  assert.equal(normalizeFlag('"off"', true), false);
  assert.equal(normalizeFlag(false, true), false);
  assert.equal(normalizeFlag(undefined, true), true);
  assert.equal(normalizeFlag("weird", true), true);
  assert.equal(normalizeFlag("weird", false), false);
});
