import test from "node:test";
import assert from "node:assert/strict";
import { maskEmail, normalizeEmail } from "@/lib/outreach/email";
import { countryFromDomain, isRestrictedCountry, normalizeCountry } from "@/lib/outreach/regions";

test("valid emails are lowercased and trimmed; wrappers are removed", () => {
  const r = normalizeEmail("  Maria.Lopez@Example-Blog.COM ");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.email, "maria.lopez@example-blog.com");
    assert.equal(r.domain, "example-blog.com");
    assert.equal(r.isRole, false);
  }
  const w = normalizeEmail("mailto:<bob@site.io>");
  assert.ok(w.ok && w.email === "bob@site.io");
});

test("invalid syntax is rejected", () => {
  for (const bad of ["", "plain", "a@b", "a@@b.com", "a b@c.com", "a@-b.com", "a@b..com", ".a@b.com", "a.@b.com", "a@b.c", "a@b.com.", "x".repeat(70) + "@b.com", 5, null]) {
    assert.equal(normalizeEmail(bad).ok, false, String(bad));
  }
});

test("reserved test domains and system mailboxes are rejected; shared mailboxes are only flagged", () => {
  assert.equal(normalizeEmail("a@example.com").ok, false);
  assert.equal(normalizeEmail("a@site.test").ok, false);
  assert.equal(normalizeEmail("noreply@site.com").ok, false);
  assert.equal(normalizeEmail("abuse@site.com").ok, false);
  const r = normalizeEmail("info@site.com");
  assert.ok(r.ok && r.isRole);
});

test("internationalised domains become punycode", () => {
  const r = normalizeEmail("a@bücher.de");
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.domain, "xn--bcher-kva.de");
});

test("masking keeps the first letter and the domain only", () => {
  assert.equal(maskEmail("john.doe@example.org"), "j•••@example.org");
  assert.equal(maskEmail("nonsense"), "•••");
});

test("countries: codes are normalised, ccTLDs inferred, restricted regions recognised", () => {
  assert.equal(normalizeCountry(" uk "), "GB");
  assert.equal(normalizeCountry("bd"), "BD");
  assert.equal(normalizeCountry("Germany"), null);
  assert.equal(normalizeCountry(5), null);
  assert.equal(countryFromDomain("shop.example.de"), "DE");
  assert.equal(countryFromDomain("site.co.uk"), "GB");
  assert.equal(countryFromDomain("site.eu"), "EU");
  assert.equal(countryFromDomain("site.com"), null);
  assert.equal(isRestrictedCountry("DE"), true);
  assert.equal(isRestrictedCountry("GB"), true);
  assert.equal(isRestrictedCountry("CH"), true);
  assert.equal(isRestrictedCountry("US"), false);
  assert.equal(isRestrictedCountry("BD"), false);
  assert.equal(isRestrictedCountry(null), false);
});
