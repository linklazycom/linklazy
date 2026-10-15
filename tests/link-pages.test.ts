import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderPasswordPage, renderStatePage, stateHttpStatus } from "@/lib/links/pages";
import { hashLinkPassword, verifyLinkPassword } from "@/lib/links/password";

test("escapeHtml escapes all dangerous characters", () => {
  assert.equal(escapeHtml(`<script>"a"&'b'</script>`), "&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;");
});

test("pages never inject raw slug/error values", () => {
  const html = renderPasswordPage('x"><script>alert(1)</script>', "<b>bad</b>");
  assert.equal(html.includes("<script>alert"), false);
  assert.equal(html.includes("<b>bad</b>"), false);
  assert.ok(html.includes("noindex"));
});

test("state pages and statuses", () => {
  assert.equal(stateHttpStatus("not_found"), 404);
  assert.equal(stateHttpStatus("expired"), 410);
  assert.equal(stateHttpStatus("taken_down"), 410);
  assert.equal(stateHttpStatus("unavailable"), 503);
  assert.ok(renderStatePage("expired", "abc").includes("/report-link?slug=abc"));
  assert.equal(renderStatePage("not_found", "abc").includes("report-link"), false);
});

test("password hash verifies and rejects", () => {
  const h = hashLinkPassword("secret1");
  assert.match(h, /^s1:/);
  assert.equal(verifyLinkPassword("secret1", h), true);
  assert.equal(verifyLinkPassword("secret2", h), false);
  assert.equal(verifyLinkPassword("secret1", "garbage"), false);
  assert.notEqual(hashLinkPassword("secret1"), h); // random salt
});
