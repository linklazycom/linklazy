import test from "node:test";
import assert from "node:assert/strict";
import { canMovePress, expectedDeliveryAt, isOverdue, marginOf, validateDeliveryUrl, validateSupplierCost, buildPressEmail } from "../lib/press-release-flow.ts";

test("press: allowed and blocked status moves", () => {
  assert.equal(canMovePress("pending_review", "in_progress"), true);
  assert.equal(canMovePress("in_progress", "submitted_to_media"), true);
  assert.equal(canMovePress("submitted_to_media", "published"), true);
  assert.equal(canMovePress("pending_review", "published"), false);
  assert.equal(canMovePress("published", "in_progress"), false);
  assert.equal(canMovePress("cancelled", "pending_review"), false);
  assert.equal(canMovePress("published", "published"), true); // note-only save
});

test("press: expected delivery uses the slowest package", () => {
  const from = new Date("2026-11-01T00:00:00Z");
  assert.equal(expectedDeliveryAt(from, [3, 7, null])?.toISOString(), "2026-11-08T00:00:00.000Z");
  assert.equal(expectedDeliveryAt(from, [null, undefined]), null);
});

test("press: overdue only for open orders past the date", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  assert.equal(isOverdue({ status: "in_progress", expected_delivery_at: "2026-11-08T00:00:00Z" }, now), true);
  assert.equal(isOverdue({ status: "published", expected_delivery_at: "2026-11-08T00:00:00Z" }, now), false);
  assert.equal(isOverdue({ status: "in_progress", expected_delivery_at: null }, now), false);
});

test("press: margin and supplier cost checks", () => {
  assert.deepEqual(marginOf(10000, 7000), { margin: 3000, percent: 30 });
  assert.equal(marginOf(10000, null), null);
  assert.deepEqual(validateSupplierCost(""), { ok: true, value: null });
  assert.equal(validateSupplierCost(-5).ok, false);
  assert.equal(validateSupplierCost("abc").ok, false);
});

test("press: delivery link must be https", () => {
  assert.equal(validateDeliveryUrl("").ok, false);
  assert.equal(validateDeliveryUrl("http://x.com/a").ok, false);
  assert.equal(validateDeliveryUrl("javascript:alert(1)").ok, false);
  assert.equal(validateDeliveryUrl("https://news.example.com/a").ok, true);
});

test("press: email escapes text and links the delivery", () => {
  const mail = buildPressEmail({ status: "published", headline: "<b>Big</b>", note: "<i>hi</i>", deliveryUrl: "https://n.example.com/a", siteUrl: "https://linklazy.com" });
  assert.ok(!mail.html.includes("<b>Big"));
  assert.ok(!mail.html.includes("<i>hi"));
  assert.match(mail.html, /https:\/\/n\.example\.com\/a/);
  assert.match(mail.subject, /Published/);
});
