import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { validateTestimonial } from "@/lib/growth/testimonials";

const read = (f: string) => readFileSync(f, "utf8");

test("validateTestimonial: needs a name and a real-length quote; never publishes without permission", () => {
  const base = { author_name: "Rina Akter", quote: "It saved me hours of searching for sites.", consent_confirmed: true, is_published: true };
  const ok = validateTestimonial(base);
  assert.ok(ok.ok && ok.value.is_published && ok.value.author_role === null && ok.value.sort_order === 0);
  const noConsent = validateTestimonial({ ...base, consent_confirmed: false });
  assert.ok(!noConsent.ok && noConsent.field === "consent_confirmed");
  const draft = validateTestimonial({ ...base, consent_confirmed: false, is_published: false });
  assert.ok(draft.ok && !draft.value.is_published);
  assert.ok(!validateTestimonial({ ...base, author_name: "   " }).ok);
  assert.ok(!validateTestimonial({ ...base, quote: "too short" }).ok);
  const long = validateTestimonial({ ...base, quote: "x".repeat(601) });
  assert.ok(!long.ok && long.field === "quote");
  const messy = validateTestimonial({ ...base, author_name: "  A\u0000   B  ", author_role: "  CEO ", sort_order: "7", consent_confirmed: "yes" as unknown as boolean });
  assert.ok(!messy.ok, "consent must be the real boolean true, not the text 'yes'");
  const trimmed = validateTestimonial({ ...base, author_name: "  A\u0000   B  ", author_role: "  CEO ", sort_order: 7 });
  assert.ok(trimmed.ok && trimmed.value.author_name === "A B" && trimmed.value.author_role === "CEO" && trimmed.value.sort_order === 7);
});

test("testimonials: the database itself refuses publishing without permission", () => {
  const sql = read("supabase/sql/057_batch18_testimonials.sql");
  assert.ok(/constraint testimonials_consent_before_publish check \(not is_published or consent_confirmed\)/.test(sql));
  assert.ok(/using \(is_published and consent_confirmed\)/.test(sql), "visitors can only read published-with-permission rows");
  assert.ok(!/grant (insert|update|delete|all)/i.test(sql), "no write grants for visitors");
});

test("the About page shows testimonials only through the component that hides itself when empty", () => {
  assert.ok(read("app/(marketing)/about/page.tsx").includes("<Testimonials />"));
  const c = read("components/marketing/testimonials.tsx");
  assert.ok(c.includes("if (rows.length === 0) return null;"));
  assert.ok(c.includes('.eq("is_published", true)'));
});

test("public tool routes: switch and limits come first, the cache before the paid ceiling", () => {
  for (const f of ["app/api/tools/dr/route.ts", "app/api/tools/price-check/route.ts", "app/api/recommendations/route.ts"]) {
    const s = read(f);
    assert.ok(s.includes("gateToolRequest("), `${f} uses the gate`);
    assert.ok(/PUBLIC_(TOOLS|RECOMMEND)_FLAG/.test(s), `${f} names its switch`);
  }
  const dr = read("app/api/tools/dr/route.ts");
  assert.ok(dr.indexOf("readToolCache(") < dr.indexOf("checkGlobalCeiling("), "a saved answer must not use the Ahrefs ceiling");
  assert.ok(dr.indexOf("checkGlobalCeiling(") < dr.indexOf("fetchDomainRating("), "the ceiling is checked before calling Ahrefs");
  assert.ok(!/error: result\.error/.test(dr), "provider error text is never shown to visitors");
  const rec = read("app/api/recommendations/route.ts");
  assert.ok(rec.indexOf("gateToolRequest(") < rec.indexOf("scanBuyerSite("), "no outbound fetch before the visitor passed the gate");
});

test("public data stays public: price check and recommendations read only the masked view and never leak owners or domains", () => {
  for (const f of ["app/api/tools/price-check/route.ts", "app/api/recommendations/route.ts"]) {
    const s = read(f);
    assert.ok(s.includes('"sites_public"'), `${f} reads the public view`);
    assert.ok(!s.includes('from("sites")'), `${f} must not read the raw sites table`);
    assert.ok(!/select\([^)]*(owner_id|domain)/.test(s), `${f} must not select owner_id or domain`);
  }
});

test("every public tool page has a canonical address and checks its switch; new pages are in the sitemap", () => {
  const pages = ["tools", "tools/dr-checker", "tools/price-check", "tools/utm-builder", "tools/qr-code", "recommendations", "getting-started"];
  const sitemap = read("lib/seo/index.ts");
  for (const p of pages) {
    const f = `app/(marketing)/${p}/page.tsx`;
    assert.ok(existsSync(f), f);
    const s = read(f);
    assert.ok(s.includes(`canonical: "/${p}"`), `${f} canonical`);
    assert.ok(sitemap.includes(`path: "/${p}"`), `${p} in sitemap`);
    if (p !== "getting-started") assert.ok(s.includes("ToolShell") || s.includes("isFeatureEnabled"), `${f} checks its switch`);
  }
});

test("getting-started text does not invent numbers or guarantees", () => {
  const s = read("app/(marketing)/getting-started/page.tsx");
  assert.ok(!/\b\d{2,}\s?(%|\+|k\b)/.test(s), "no made-up statistics");
  assert.ok(!/\b(guarantee|guaranteed|best|#1)\b/i.test(s));
});

test("the tool pages promise nothing they cannot keep", () => {
  for (const f of ["components/tools/dr-checker.tsx", "components/tools/price-check.tsx", "components/tools/recommendations-form.tsx", "components/tools/qr-generator.tsx", "components/tools/utm-builder.tsx"]) {
    const s = read(f);
    assert.ok(!/\b(guarantee|guaranteed)\b/i.test(s.replace(/not a guarantee/gi, "").replace(/not a promise/gi, "")), `${f}`);
  }
  assert.ok(read("components/tools/price-check.tsx").includes("not from the wider market"), "the price check states its data source");
});
