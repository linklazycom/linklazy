import test from "node:test";
import assert from "node:assert/strict";
import { canMoveSendStatus, eventEffect, parseWebhook } from "@/lib/outreach/webhook";

const base = (extra: Record<string, unknown>) => ({
  prospect: { email: "Piyush@Acme.com", firstName: "Piyush" },
  sequence: { id: "139223", sequenceName: "Outreach", stepID: "FUWcw22do", stepNumber: "3", emailSubject: "Save cost!" },
  ...extra,
});

test("reply-received keeps the reply text and conversation id", () => {
  const r = parseWebhook(base({ event: "reply-received", replyReceiveAt: "2024-04-23T07:34:45.575Z", conversationId: "Rxh247rdgp", receivedReplyMessage: "I am Interested in this." }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.email, "piyush@acme.com");
    assert.equal(r.value.occurredAt, "2024-04-23T07:34:45.575Z");
    assert.equal(r.value.sequenceId, "139223");
    assert.equal(r.value.stepId, "FUWcw22do");
    assert.equal(r.value.detail.reply, "I am Interested in this.");
    assert.equal(r.value.detail.conversation_id, "Rxh247rdgp");
  }
});

test("bounce, unsubscribe, sent and finished events are understood", () => {
  const b = parseWebhook(base({ event: "email-bounced", emailBouncedAt: "2024-04-23T07:35:52.331Z", bounceReason: "554 Sender Address Blocked" }));
  assert.ok(b.ok && b.value.detail.bounce_reason === "554 Sender Address Blocked");
  for (const [event, field] of [["prospect-unsubscribed", "prospectUnsubscribedAt"], ["email-sent", "emailSentAt"], ["prospect-finished", "prospectFinishedAt"]] as const) {
    const r = parseWebhook(base({ event, [field]: "2024-04-23T07:00:00Z" }));
    assert.ok(r.ok, event);
    if (r.ok) assert.equal(r.value.occurredAt, "2024-04-23T07:00:00.000Z");
  }
});

test("effects: bounces and unsubscribes feed the do-not-email list; opens and clicks are only recorded", () => {
  assert.deepEqual(eventEffect("email-bounced"), { sendStatus: "bounced", suppression: "bounce" });
  assert.deepEqual(eventEffect("prospect-unsubscribed"), { sendStatus: "unsubscribed", suppression: "unsubscribe" });
  assert.deepEqual(eventEffect("reply-received"), { sendStatus: "replied", suppression: null });
  assert.deepEqual(eventEffect("email-sent"), { sendStatus: "sent", suppression: null });
  assert.deepEqual(eventEffect("email-opened"), { sendStatus: null, suppression: null });
  assert.deepEqual(eventEffect("email-link-clicked"), { sendStatus: null, suppression: null });
  assert.deepEqual(eventEffect("prospect-outcome-updated"), { sendStatus: null, suppression: null });
});

test("a status only ever moves forward", () => {
  assert.equal(canMoveSendStatus("pushed", "sent"), true);
  assert.equal(canMoveSendStatus("sent", "replied"), true);
  assert.equal(canMoveSendStatus("replied", "sent"), false); // late webhook
  assert.equal(canMoveSendStatus("sent", "sent"), false);
  assert.equal(canMoveSendStatus("replied", "bounced"), true);
  assert.equal(canMoveSendStatus("bounced", "replied"), false);
  assert.equal(canMoveSendStatus("push_failed", "pushed"), true);
});

test("every open and click is its own event, the same one twice is the same key", () => {
  const o = (n: string) => parseWebhook(base({ event: "email-opened", emailOpenedAt: "2024-04-23T07:14:48.306Z", openCount: n }));
  const a = o("1");
  const b = o("2");
  const a2 = o("1");
  assert.ok(a.ok && b.ok && a2.ok);
  if (a.ok && b.ok && a2.ok) {
    assert.notEqual(a.value.dedupeKey, b.value.dedupeKey);
    assert.equal(a.value.dedupeKey, a2.value.dedupeKey);
  }
});

test("bad payloads are rejected without throwing", () => {
  assert.equal(parseWebhook(null).ok, false);
  assert.equal(parseWebhook("x").ok, false);
  assert.equal(parseWebhook({ event: "email-exploded", prospect: { email: "a@b.com" } }).ok, false);
  assert.equal(parseWebhook({ event: "reply-received" }).ok, false);
  assert.equal(parseWebhook({ event: "reply-received", prospect: { email: "not an email" } }).ok, false);
});

test("text is cleaned and bounded", () => {
  const r = parseWebhook(base({ event: "reply-received", replyReceiveAt: "not a date", receivedReplyMessage: "hi\u0000 there" + "x".repeat(9000) }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.occurredAt, null);
    assert.ok(String(r.value.detail.reply).startsWith("hi there"));
    assert.equal(String(r.value.detail.reply).length, 5000);
  }
});
