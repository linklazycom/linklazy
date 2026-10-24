import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BUSINESS, copyrightLine, formatAddress, organizationSchema } from "@/lib/business";
import { TOOLS } from "@/lib/features/registry";
import { clampText } from "@/lib/seo";

test("business facts are exactly the ones the owner confirmed", () => {
  assert.equal(BUSINESS.legalName, "LinkLazy LLC");
  assert.equal(BUSINESS.brandName, "LinkLazy");
  assert.equal(BUSINESS.email, "hi@linklazy.com");
  assert.equal(BUSINESS.companyEstablished, 2014);
  assert.equal(BUSINESS.websiteStarted, 2026);
  assert.deepEqual({ ...BUSINESS.address }, { streetAddress: "1 apt", locality: "Bronx", region: "NY", postalCode: "10463", countryCode: "US", countryName: "USA" });
  assert.equal(formatAddress(), "1 apt, Bronx, NY 10463, USA");
  assert.equal(copyrightLine(2026), "© 2026 LinkLazy LLC. All rights reserved.");
});

test("organizationSchema uses only confirmed facts: nothing invented", () => {
  const s = organizationSchema("https://linklazy.com");
  assert.equal(s["@type"], "Organization");
  assert.equal(s.legalName, "LinkLazy LLC");
  assert.equal(s.foundingDate, "2014");
  assert.equal(s.email, "hi@linklazy.com");
  assert.equal(s.url, "https://linklazy.com");
  assert.equal(s.logo, "https://linklazy.com/logo.png");
  assert.equal(s.address.addressCountry, "US");
  assert.equal(s.address.postalCode, "10463");
  const allowed = new Set(["@context", "@type", "name", "legalName", "url", "logo", "email", "foundingDate", "description", "address", "contactPoint"]);
  assert.deepEqual(Object.keys(s).filter((k) => !allowed.has(k)), [], "no founders, employees, ratings or reviews");
});

test("About page, footer, settings and root layout read the business facts; no stock 'team' photos", () => {
  const about = readFileSync("app/(marketing)/about/page.tsx", "utf8");
  assert.ok(about.includes("BUSINESS.legalName") && about.includes("formatAddress()") && about.includes("BUSINESS.email"));
  assert.ok(!/pexels/i.test(about), "the About page must not show stock photos of a made-up team");
  assert.ok(about.includes("toolFlags[tool.flagKey] !== false"), "only tools that are switched on are advertised");
  assert.ok(!about.includes("{siteCount ?? 0}+"), "no invented '+' after the real listing count");
  assert.ok(readFileSync("components/layout/site-footer.tsx", "utf8").includes("copyrightLine("));
  assert.ok(readFileSync("lib/site-settings.ts", "utf8").includes("contact_email: BUSINESS.email"));
  assert.ok(readFileSync("app/layout.tsx", "utf8").includes("organizationSchema(siteUrl())"));
});

test("every switchable tool has a short public sentence for the About page", () => {
  for (const t of TOOLS) {
    assert.ok(t.publicSummary.length >= 20 && t.publicSummary.length <= 200, `${t.id}: ${t.publicSummary.length}`);
    assert.ok(t.publicSummary.startsWith(t.label), `${t.id} summary starts with the tool name`);
    assert.ok(!/\b(best|leading|#1|guarantee|free)\b/i.test(t.publicSummary), `${t.id}: no unprovable claims`);
  }
});

test("article/case-study share images and breadcrumb data exist", () => {
  assert.ok(existsSync("app/blog/[slug]/opengraph-image.tsx"));
  assert.ok(existsSync("app/(marketing)/case-studies/[slug]/opengraph-image.tsx"));
  for (const f of ["app/blog/[slug]/page.tsx", "app/(marketing)/case-studies/[slug]/page.tsx", "app/(marketing)/browse/[id]/page.tsx", "app/(marketing)/about/page.tsx"]) {
    assert.ok(readFileSync(f, "utf8").includes("breadcrumbSchema") || readFileSync(f, "utf8").includes("buildBreadcrumb"), `${f} has breadcrumbs`);
  }
});

test("clampText", () => {
  assert.equal(clampText("short", 20), "short");
  assert.equal(clampText("  many   spaces here  ", 30), "many spaces here");
  assert.equal(clampText("The quick brown fox jumps over the lazy dog", 20), "The quick brown fox…");
  assert.ok(clampText("x".repeat(200), 50).length <= 50);
  assert.ok(clampText("x".repeat(200), 50).endsWith("…"));
});
