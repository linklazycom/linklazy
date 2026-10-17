import { test } from "node:test";
import assert from "node:assert/strict";
import { validateHostname, isApexLike, txtRecordName, txtRecordValue } from "@/lib/domains/hostname";

const own = ["linklazy.com", "www.linklazy.com"];

test("accepts normal subdomains and normalises case / trailing dot", () => {
  assert.deepEqual(validateHostname("Go.YourBrand.com.", { ownHosts: own }), { ok: true, hostname: "go.yourbrand.com" });
  assert.equal(validateHostname("links.example-shop.co.uk").ok, true);
  assert.equal(validateHostname("xn--bcher-kva.example.com").ok, true);
});

test("rejects schemes, paths, ports, credentials and spaces", () => {
  for (const bad of ["https://go.brand.com", "go.brand.com/path", "go.brand.com:8080", "user@go.brand.com", "go brand.com", "go.brand.com?x=1", "go.brand.com#a"]) {
    const r = validateHostname(bad);
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.equal(r.error, "has_scheme_or_path", bad);
  }
});

test("rejects IPs, single labels and bad labels", () => {
  assert.equal(validateHostname("127.0.0.1").ok, false);
  assert.equal(validateHostname("10.1.2.3").ok, false);
  assert.equal(validateHostname("[::1]").ok, false);
  assert.equal(validateHostname("localhost").ok, false);
  assert.equal(validateHostname("brand").ok, false);
  assert.equal(validateHostname("-bad.brand.com").ok, false);
  assert.equal(validateHostname("bad-.brand.com").ok, false);
  assert.equal(validateHostname("a..brand.com").ok, false);
  assert.equal(validateHostname("under_score.brand.com").ok, false);
  assert.equal(validateHostname("brand.c").ok, false);
  assert.equal(validateHostname("brand.123").ok, false);
  assert.equal(validateHostname(`${"a".repeat(64)}.brand.com`).ok, false);
  assert.equal(validateHostname(`${"a.".repeat(130)}com`).ok, false);
  assert.equal(validateHostname("").ok, false);
});

test("rejects platform, reserved and own domains", () => {
  for (const bad of ["my-app.vercel.app", "x.vercel.com", "printer.local", "db.internal", "a.test", "a.example", "x.invalid", "x.onion", "linklazy.com", "go.linklazy.com", "www.linklazy.com"]) {
    assert.equal(validateHostname(bad, { ownHosts: own }).ok, false, bad);
  }
  // "notlinklazy.com" is a different domain and must not be caught by the suffix rule.
  assert.equal(validateHostname("notlinklazy.com", { ownHosts: own }).ok, true);
});

test("admin-blocked domains are rejected, including their subdomains", () => {
  assert.equal(validateHostname("go.evil.com", { blockedDomains: ["evil.com"] }).ok, false);
  assert.equal(validateHostname("evil.com", { blockedDomains: ["evil.com"] }).ok, false);
  assert.equal(validateHostname("notevil.com", { blockedDomains: ["evil.com"] }).ok, true);
});

test("apex detection and TXT record naming", () => {
  assert.equal(isApexLike("brand.com"), true);
  assert.equal(isApexLike("go.brand.com"), false);
  assert.equal(isApexLike("brand.co.uk"), true);
  assert.equal(isApexLike("go.brand.co.uk"), false);
  assert.equal(txtRecordName("go.brand.com"), "_linklazy-verify.go.brand.com");
  assert.equal(txtRecordValue("abc"), "linklazy-verification=abc");
});

import { relativeDnsName } from "@/lib/domains/hostname";

test("relative DNS names for providers that append the domain themselves", () => {
  assert.equal(relativeDnsName("go.brand.com", "go.brand.com"), "go");
  assert.equal(relativeDnsName("_linklazy-verify.go.brand.com", "go.brand.com"), "_linklazy-verify.go");
  assert.equal(relativeDnsName("brand.com", "brand.com"), "@");
  assert.equal(relativeDnsName("_linklazy-verify.brand.com", "brand.com"), "_linklazy-verify");
  assert.equal(relativeDnsName("go.brand.co.uk", "go.brand.co.uk"), "go");
  assert.equal(relativeDnsName("_linklazy-verify.go.brand.co.uk", "go.brand.co.uk"), "_linklazy-verify.go");
  assert.equal(relativeDnsName("a.b.brand.com", "a.b.brand.com"), "a.b");
});
