import test from "node:test";
import assert from "node:assert/strict";
import { checkResponder, domainForViewer, isHttpUrl } from "../lib/match-flow.ts";

const A = "user-a";
const B = "user-b";

test("match: outsider denied", () => {
  const r = checkResponder({ status: "proposed", initiated_by: A }, "x", A, B);
  assert.equal(r.ok, false);
});
test("match: receiving side may respond", () => {
  const r = checkResponder({ status: "proposed", initiated_by: A }, B, A, B);
  assert.deepEqual(r, { ok: true, side: "b" });
});
test("match: proposer cannot accept own proposal", () => {
  assert.equal(checkResponder({ status: "proposed", initiated_by: A }, A, A, B).ok, false);
});
test("match: counter-offer sender cannot accept own counter", () => {
  assert.equal(checkResponder({ status: "countered", initiated_by: B }, B, A, B).ok, false);
  assert.equal(checkResponder({ status: "countered", initiated_by: B }, A, A, B).ok, true);
});
test("match: closed proposals cannot be answered again", () => {
  for (const s of ["accepted", "rejected", "expired"]) {
    const r = checkResponder({ status: s, initiated_by: A }, B, A, B);
    assert.equal(r.ok, false);
  }
});
test("match: only http(s) links", () => {
  assert.equal(isHttpUrl("https://example.com/p"), true);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("nope"), false);
});
test("match: domain masked for the other party until accepted", () => {
  const site = { owner_id: A, domain: "example.com" };
  assert.equal(domainForViewer(site, A, "proposed"), "example.com");
  assert.notEqual(domainForViewer(site, B, "proposed"), "example.com");
  assert.equal(domainForViewer(site, B, "accepted"), "example.com");
});
