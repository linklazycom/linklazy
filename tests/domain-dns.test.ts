import { test } from "node:test";
import assert from "node:assert/strict";
import {
  txtRecordsMatch, checkTxtOwnership, checkPointsToPlatform, isVercelCnameTarget, txtFailureMessage, type DnsResolver,
} from "@/lib/domains/dns";

function resolver(over: Partial<DnsResolver>): DnsResolver {
  const nf = () => Promise.reject(Object.assign(new Error("nf"), { code: "ENOTFOUND" }));
  return { resolveTxt: nf, resolveCname: nf, resolve4: nf, ...over };
}

test("TXT chunks are joined before comparing", () => {
  assert.equal(txtRecordsMatch([["linklazy-verification=ab", "cd"]], "abcd"), true);
  assert.equal(txtRecordsMatch([["other"], ["linklazy-verification=abcd"]], "abcd"), true);
  assert.equal(txtRecordsMatch([["linklazy-verification=abcd "]], "abcd"), true);
  assert.equal(txtRecordsMatch([["linklazy-verification=abce"]], "abcd"), false);
  assert.equal(txtRecordsMatch([["xlinklazy-verification=abcd"]], "abcd"), false);
  assert.equal(txtRecordsMatch([], "abcd"), false);
});

test("ownership check: ok, mismatch, not found, dns error — and queries the right name", async () => {
  const asked: string[] = [];
  const ok = resolver({ resolveTxt: async (n) => (asked.push(n), [["linklazy-verification=tok"]]) });
  assert.deepEqual(await checkTxtOwnership("go.brand.com", "tok", ok), { ok: true });
  assert.deepEqual(asked, ["_linklazy-verify.go.brand.com"]);

  const mismatch = resolver({ resolveTxt: async () => [["linklazy-verification=nope"]] });
  assert.deepEqual(await checkTxtOwnership("go.brand.com", "tok", mismatch), { ok: false, reason: "mismatch" });

  assert.deepEqual(await checkTxtOwnership("go.brand.com", "tok", resolver({})), { ok: false, reason: "not_found" });

  const broken = resolver({ resolveTxt: () => Promise.reject(Object.assign(new Error("x"), { code: "ETIMEOUT" })) });
  assert.deepEqual(await checkTxtOwnership("go.brand.com", "tok", broken), { ok: false, reason: "dns_error" });
});

test("Vercel CNAME targets (old and project-specific) are recognised, look-alikes are not", () => {
  assert.equal(isVercelCnameTarget("cname.vercel-dns.com"), true);
  assert.equal(isVercelCnameTarget("cname.vercel-dns.com."), true);
  assert.equal(isVercelCnameTarget("abc123.vercel-dns-017.com"), true);
  assert.equal(isVercelCnameTarget("vercel-dns.com.evil.io"), false);
  assert.equal(isVercelCnameTarget("notvercel-dns.com"), false);
});

test("pointing check: CNAME, A record, neither", async () => {
  assert.deepEqual(await checkPointsToPlatform("go.brand.com", resolver({ resolveCname: async () => ["cname.vercel-dns.com"] })), { pointing: true, via: "cname" });
  assert.deepEqual(await checkPointsToPlatform("brand.com", resolver({ resolve4: async () => ["1.2.3.4", "76.76.21.21"] })), { pointing: true, via: "a" });
  assert.deepEqual(await checkPointsToPlatform("brand.com", resolver({ resolve4: async () => ["1.2.3.4"] })), { pointing: false, via: null });
  assert.deepEqual(await checkPointsToPlatform("brand.com", resolver({})), { pointing: false, via: null });
});

test("failure messages exist for every reason", () => {
  for (const r of ["not_found", "mismatch", "dns_error"] as const) assert.ok(txtFailureMessage(r).length > 20);
});
