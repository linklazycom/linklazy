import test from "node:test";
import assert from "node:assert/strict";
import { decideBacklinkNotice, buildBacklinkEmail } from "../lib/backlinks/notify.ts";
import { summarizeUsage, taskHealth } from "../lib/ops-summary.ts";

test("backlink notice: one miss is silent, two in a row is 'lost', only once", () => {
  assert.equal(decideBacklinkNotice({ prevStatus: "active", newStatus: "not_found", lostNotifiedAt: null }), null);
  assert.equal(decideBacklinkNotice({ prevStatus: "not_found", newStatus: "not_found", lostNotifiedAt: null }), "lost");
  assert.equal(decideBacklinkNotice({ prevStatus: "not_found", newStatus: "not_found", lostNotifiedAt: "2026-10-01T00:00:00Z" }), null);
});

test("backlink notice: temporary problems never trigger; restored only after a 'lost' mail", () => {
  assert.equal(decideBacklinkNotice({ prevStatus: "not_found", newStatus: "unavailable", lostNotifiedAt: null }), null);
  assert.equal(decideBacklinkNotice({ prevStatus: "not_found", newStatus: "check_failed", lostNotifiedAt: null }), null);
  assert.equal(decideBacklinkNotice({ prevStatus: "not_found", newStatus: "active", lostNotifiedAt: "2026-10-01T00:00:00Z" }), "restored");
  assert.equal(decideBacklinkNotice({ prevStatus: "not_found", newStatus: "active", lostNotifiedAt: null }), null);
});

test("backlink email escapes the urls", () => {
  const m = buildBacklinkEmail("lost", { sourceUrl: "https://a.com/<script>", targetUrl: "https://b.com/?x=\"1\"", siteUrl: "https://linklazy.com" });
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("&lt;script&gt;"));
  assert.match(buildBacklinkEmail("restored", { sourceUrl: "https://a.com", targetUrl: "https://b.com", siteUrl: "https://linklazy.com" }).subject, /back/);
});

test("ops: usage summary totals and refund rate", () => {
  const rows = [
    { action: "ai_article", amount: 50, status: "charged" },
    { action: "ai_article", amount: 50, status: "charged" },
    { action: "ai_article", amount: 50, status: "charged" },
    { action: "ai_article", amount: 50, status: "refunded" },
    { action: "ai_article", amount: 0, status: "free" },
    { action: "dr_check", amount: 10, status: "charged" },
  ];
  const s = summarizeUsage(rows);
  assert.equal(s[0].action, "ai_article");
  assert.equal(s[0].chargedAmount, 150);
  assert.equal(s[0].refunded, 1);
  assert.equal(s[0].refundRate, 25);
  assert.equal(s[0].free, 1);
  assert.equal(s[1].refundRate, 0);
});

test("ops: overdue queued and stuck running tasks", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const h = taskHealth([
    { status: "queued", run_at: "2026-11-01T01:00:00Z", locked_at: null }, // 11h overdue
    { status: "queued", run_at: "2026-11-01T11:00:00Z", locked_at: null }, // fine
    { status: "running", run_at: "2026-11-01T10:00:00Z", locked_at: "2026-11-01T11:00:00Z" }, // stuck
    { status: "running", run_at: "2026-11-01T10:00:00Z", locked_at: "2026-11-01T11:50:00Z" }, // fine
  ], now);
  assert.deepEqual(h, { overdueQueued: 1, stuckRunning: 1 });
});
