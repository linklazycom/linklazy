import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRedirect, linkStatus, type RedirectState } from "@/lib/links/rules";
import { isLikelyBot } from "@/lib/links/bot";

const base: RedirectState = { is_active: true, disabled_reason: null, expires_at: null, max_clicks: null, click_count: 0, has_password: false };
const now = new Date("2026-10-15T12:00:00Z");

test("plain active link redirects", () => {
  assert.deepEqual(evaluateRedirect(base, now), { action: "redirect" });
});

test("takedown wins over everything", () => {
  assert.deepEqual(evaluateRedirect({ ...base, disabled_reason: "admin_takedown", is_active: false }, now), { action: "block", reason: "taken_down" });
});

test("inactive, expired, limit reached", () => {
  assert.deepEqual(evaluateRedirect({ ...base, is_active: false }, now), { action: "block", reason: "inactive" });
  assert.deepEqual(evaluateRedirect({ ...base, expires_at: "2026-10-15T11:59:59Z" }, now), { action: "block", reason: "expired" });
  assert.deepEqual(evaluateRedirect({ ...base, expires_at: "2026-10-15T12:00:00Z" }, now), { action: "block", reason: "expired" });
  assert.deepEqual(evaluateRedirect({ ...base, expires_at: "2026-10-15T12:00:01Z" }, now), { action: "redirect" });
  assert.deepEqual(evaluateRedirect({ ...base, max_clicks: 5, click_count: 5 }, now), { action: "block", reason: "limit_reached" });
  assert.deepEqual(evaluateRedirect({ ...base, max_clicks: 5, click_count: 4 }, now), { action: "redirect" });
});

test("password link asks for password only when otherwise valid", () => {
  assert.deepEqual(evaluateRedirect({ ...base, has_password: true }, now), { action: "ask_password" });
  assert.deepEqual(evaluateRedirect({ ...base, has_password: true, is_active: false }, now), { action: "block", reason: "inactive" });
});

test("linkStatus labels", () => {
  assert.equal(linkStatus(base, now), "active");
  assert.equal(linkStatus({ ...base, expires_at: "2020-01-01T00:00:00Z" }, now), "expired");
});

test("bot detection: previews and crawlers are bots, browsers are not", () => {
  assert.equal(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isLikelyBot("WhatsApp/2.23"), true);
  assert.equal(isLikelyBot("Slackbot-LinkExpanding 1.0"), true);
  assert.equal(isLikelyBot(null), true);
  assert.equal(isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"), false);
  assert.equal(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"), false);
});
