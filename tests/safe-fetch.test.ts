import test from "node:test";
import assert from "node:assert/strict";
import { createGuardedLookup, safeFetch, SafeFetchError } from "../lib/safe-fetch.ts";

function lookupOnce(resolver: (h: string) => Promise<string[]>, all = false) {
  const lookup = createGuardedLookup(resolver);
  return new Promise<{ err: NodeJS.ErrnoException | null; address?: unknown }>((resolve) => {
    lookup("example.com", { all }, (err, address) => resolve({ err, address }));
  });
}

test("guarded lookup hands out a public address", async () => {
  const r = await lookupOnce(async () => ["93.184.216.34"]);
  assert.equal(r.err, null);
  assert.equal(r.address, "93.184.216.34");
});

test("guarded lookup supports {all:true}", async () => {
  const r = await lookupOnce(async () => ["93.184.216.34"], true);
  assert.equal(r.err, null);
  assert.deepEqual(r.address, [{ address: "93.184.216.34", family: 4 }]);
});

test("guarded lookup blocks a private address", async () => {
  const r = await lookupOnce(async () => ["10.0.0.5"]);
  assert.equal(r.err?.code, "EBLOCKED");
});

test("guarded lookup blocks when ANY returned address is private (mixed answer)", async () => {
  const r = await lookupOnce(async () => ["93.184.216.34", "169.254.169.254"]);
  assert.equal(r.err?.code, "EBLOCKED");
});

test("guarded lookup blocks IPv6 loopback", async () => {
  const r = await lookupOnce(async () => ["::1"]);
  assert.equal(r.err?.code, "EBLOCKED");
});

test("guarded lookup reports empty DNS answers", async () => {
  const r = await lookupOnce(async () => []);
  assert.equal(r.err?.code, "ENOTFOUND");
});

test("safeFetch refuses a hostname that RESOLVES to a private IP (DNS rebinding style)", async () => {
  await assert.rejects(
    safeFetch("http://rebind.example.com/", { resolveAll: async () => ["127.0.0.1"], timeoutMs: 3000 }),
    (err: unknown) => err instanceof SafeFetchError && err.code === "blocked"
  );
});

test("safeFetch refuses private IP literals before any network access", async () => {
  for (const url of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://localhost/"]) {
    await assert.rejects(safeFetch(url), (err: unknown) => err instanceof SafeFetchError && err.code === "blocked");
  }
});

test("safeFetch refuses non-http protocols and bad ports", async () => {
  await assert.rejects(safeFetch("file:///etc/passwd"), (e: unknown) => e instanceof SafeFetchError && e.code === "blocked");
  await assert.rejects(safeFetch("http://example.com:22/"), (e: unknown) => e instanceof SafeFetchError && e.code === "blocked");
});

test("safeFetch reports malformed URLs as invalid_url", async () => {
  await assert.rejects(safeFetch("not a url"), (e: unknown) => e instanceof SafeFetchError && e.code === "invalid_url");
});
