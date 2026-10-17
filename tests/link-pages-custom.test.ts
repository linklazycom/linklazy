import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPasswordPage, renderStatePage } from "@/lib/links/pages";

test("defaults are unchanged for linklazy.com", () => {
  const html = renderPasswordPage("abc");
  assert.ok(html.includes('action="/l/abc"'));
  assert.ok(html.includes('href="/report-link?slug=abc"'));
  assert.ok(renderStatePage("expired", "abc").includes('href="/report-link?slug=abc"'));
  assert.ok(renderStatePage("expired", "abc").includes('<a href="/">Go to LinkLazy</a>'));
});

test("on a custom domain the form posts to the same host and every other link is absolute", () => {
  const html = renderPasswordPage("abc", undefined, { action: "/abc", base: "https://linklazy.com" });
  assert.ok(html.includes('action="/abc"'));
  assert.ok(html.includes('href="https://linklazy.com/report-link?slug=abc"'));
  const state = renderStatePage("taken_down", "abc", "https://linklazy.com");
  assert.ok(state.includes('href="https://linklazy.com/report-link?slug=abc"'));
  assert.ok(state.includes('href="https://linklazy.com/"'));
});

test("the base and action are HTML-escaped", () => {
  const html = renderPasswordPage("abc", undefined, { action: '/x"><script>', base: 'https://a.com"><b>' });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>"), false);
});
