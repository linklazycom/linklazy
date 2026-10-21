import test from "node:test";
import assert from "node:assert/strict";
import { classifyReply, deliveryHealth, pct, sumDelivery, toDeliveryRow, validateTicketPatch } from "@/lib/outreach/reply";

test("classifyReply: automatic answers, stop requests and normal replies", () => {
  assert.equal(classifyReply("I am out of office until Monday. Regards"), "auto_reply");
  assert.equal(classifyReply("This is an automatic reply. To unsubscribe click here"), "auto_reply");
  assert.equal(classifyReply("Please remove me from your list"), "no_thanks");
  assert.equal(classifyReply("No thanks, not interested."), "no_thanks");
  assert.equal(classifyReply("Stop emailing me"), "no_thanks");
  assert.equal(classifyReply("Send me the price for the first site please"), "reply");
  assert.equal(classifyReply("Interested! How much for a post on the tech one?"), "reply");
  assert.equal(classifyReply(""), "reply");
  assert.equal(classifyReply(null), "reply");
});

test("validateTicketPatch: status and note", () => {
  assert.deepEqual(validateTicketPatch({ status: "interested" }), { ok: true, value: { status: "interested" } });
  const bad = validateTicketPatch({ status: "open" });
  assert.ok(!bad.ok && bad.field === "status");
  const empty = validateTicketPatch({ note: "   " });
  assert.ok(!empty.ok && empty.field === "note");
  assert.ok(!validateTicketPatch({}).ok);
  const both = validateTicketPatch({ status: "closed", note: "Spoke on mail\nwill buy later" });
  assert.ok(both.ok && both.value.note === "Spoke on mail\nwill buy later" && both.value.status === "closed");
  const long = validateTicketPatch({ note: "x".repeat(5000) });
  assert.ok(long.ok && long.value.note!.length === 2000);
});

test("pct and row conversion", () => {
  assert.equal(pct(1, 8), "12.5%");
  assert.equal(pct(0, 0), "—");
  const r = toDeliveryRow({ campaign_id: "c1", campaign_name: "A", total: "12", sent: 10, bounced: "1", opened: -4, stuck: null });
  assert.equal(r.total, 12);
  assert.equal(r.bounced, 1);
  assert.equal(r.opened, 0);
  assert.equal(r.stuck, 0);
  const sum = sumDelivery([r, toDeliveryRow({ total: 3, sent: 2 })]);
  assert.equal(sum.total, 15);
  assert.equal(sum.sent, 12);
});

const row = (o: Record<string, number>) => toDeliveryRow({ campaign_name: "A", ...o });
test("deliveryHealth: finds the real problems", () => {
  const ctx = { lastEventAt: "2026-10-20T00:00:00Z", pushEnabled: true };
  assert.equal(deliveryHealth(row({}), ctx)[0].level, "warn");
  assert.equal(deliveryHealth(row({ total: 20, handed_over: 20, sent: 20, bounced: 0 }), ctx)[0].level, "ok");
  assert.ok(deliveryHealth(row({ total: 20, push_failed: 2 }), ctx).some((n) => n.level === "bad" && /could not be handed/.test(n.text)));
  assert.ok(deliveryHealth(row({ total: 20, handed_over: 20, stuck: 5 }), ctx).some((n) => n.level === "bad" && /never confirmed/.test(n.text)));
  assert.ok(deliveryHealth(row({ total: 40, handed_over: 40, sent: 40, bounced: 3 }), ctx).some((n) => n.level === "bad" && /above 3%/.test(n.text)));
  assert.ok(deliveryHealth(row({ total: 40, handed_over: 40, sent: 40, bounced: 1 }), ctx).some((n) => n.level === "warn" && /above 2%/.test(n.text)));
  assert.ok(deliveryHealth(row({ total: 5, handed_over: 5 }), { lastEventAt: null, pushEnabled: true }).some((n) => /No webhook event has ever arrived/.test(n.text)));
  assert.ok(deliveryHealth(row({ total: 5, handed_over: 5, sent: 5 }), { lastEventAt: "x", pushEnabled: false }).some((n) => /switch is OFF/.test(n.text)));
});
