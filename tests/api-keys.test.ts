import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateApiKey, hashApiKey, looksLikeApiKey, parseBearer, cleanScopes, hasScope, keyIsUsable, cleanKeyName, KEY_PREFIX,
} from "@/lib/api/keys";

test("generated keys have the documented shape, are unique, and only the hash is derivable", () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.ok(a.key.startsWith(KEY_PREFIX));
  assert.equal(looksLikeApiKey(a.key), true);
  assert.notEqual(a.key, b.key);
  assert.equal(a.hash, hashApiKey(a.key));
  assert.equal(a.hash.length, 64);
  assert.equal(a.prefix, a.key.slice(0, KEY_PREFIX.length + 4));
  assert.equal(a.hash.includes(a.key.slice(KEY_PREFIX.length)), false);
});

test("looksLikeApiKey rejects wrong prefix, length and characters", () => {
  const { key } = generateApiKey();
  assert.equal(looksLikeApiKey(key.slice(0, -1)), false);
  assert.equal(looksLikeApiKey(key + "x"), false);
  assert.equal(looksLikeApiKey("sk_live_" + key.slice(KEY_PREFIX.length)), false);
  assert.equal(looksLikeApiKey(key.slice(0, -1) + "!"), false);
  assert.equal(looksLikeApiKey(""), false);
});

test("parseBearer", () => {
  assert.equal(parseBearer("Bearer abc"), "abc");
  assert.equal(parseBearer("bearer abc"), "abc");
  assert.equal(parseBearer("  Bearer   abc  "), "abc");
  assert.equal(parseBearer("Basic abc"), null);
  assert.equal(parseBearer("Bearer"), null);
  assert.equal(parseBearer("Bearer a b"), null);
  assert.equal(parseBearer(null), null);
  assert.equal(parseBearer(undefined), null);
});

test("scopes: unknown ones are dropped, duplicates merged, empty is null", () => {
  assert.deepEqual(cleanScopes(["links:read", "links:read", "links:write"]), ["links:read", "links:write"]);
  assert.deepEqual(cleanScopes(["links:read", "admin", "*"]), ["links:read"]);
  assert.equal(cleanScopes(["admin"]), null);
  assert.equal(cleanScopes([]), null);
  assert.equal(cleanScopes("links:read"), null);
  assert.equal(hasScope(["links:read"], "links:write"), false);
  assert.equal(hasScope(["links:read", "links:write"], "links:write"), true);
});

test("key usability: revoked and expired keys are refused", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.equal(keyIsUsable({ revoked_at: null, expires_at: null }, now), true);
  assert.equal(keyIsUsable({ revoked_at: "2026-10-01T00:00:00Z", expires_at: null }, now), false);
  assert.equal(keyIsUsable({ revoked_at: null, expires_at: "2026-10-16T12:00:00Z" }, now), false);
  assert.equal(keyIsUsable({ revoked_at: null, expires_at: "2026-10-16T12:00:01Z" }, now), true);
  assert.equal(keyIsUsable({ revoked_at: "2026-10-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z" }, now), false);
});

test("key names are trimmed, stripped of control characters and capped", () => {
  assert.equal(cleanKeyName("  My CRM \n"), "My CRM");
  assert.equal(cleanKeyName("a".repeat(100))?.length, 60);
  assert.equal(cleanKeyName("   "), null);
  assert.equal(cleanKeyName(5), null);
});
