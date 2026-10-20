import test from "node:test";
import assert from "node:assert/strict";
import { cleanTags, cleanWebsite, validateContactPatch } from "@/lib/outreach/rules";
import { getUnsubscribeSecret, parseUnsubscribeToken, signUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/outreach/token";
import { parseContactFilters } from "@/lib/outreach/filters";
import { senderIsComplete, validateSenderIdentity } from "@/lib/outreach/sender";

const ID = "3f2b1c4e-5a6d-4e7f-8a9b-0c1d2e3f4a5b";
const SECRET = "s".repeat(32);

test("tags: lowercased, deduplicated, symbols dropped, capped at 10", () => {
  assert.deepEqual(cleanTags("VIP, vip; Big Buyers\n<b>x</b>"), ["vip", "big buyers", "b x b"]);
  assert.equal(cleanTags(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 10);
  assert.deepEqual(cleanTags(5), []);
});

test("website cleaning accepts http(s) hosts only", () => {
  assert.equal(cleanWebsite("Example.com"), "https://example.com/");
  assert.equal(cleanWebsite("http://a.io/x/"), "http://a.io/x");
  assert.equal(cleanWebsite("ftp://a.io"), null);
  assert.equal(cleanWebsite("https://user:pw@a.io"), null);
  assert.equal(cleanWebsite("localhost"), null);
});

test("edits: allowed fields pass; final statuses can never be changed", () => {
  const ok = validateContactPatch({ full_name: " Ann ", tags: "a,b", status: "blocked" }, "active");
  assert.ok(ok.ok && ok.value.full_name === "Ann" && ok.value.status === "blocked");
  assert.equal(validateContactPatch({ status: "active" }, "unsubscribed").ok, false);
  assert.equal(validateContactPatch({ status: "bounced" }, "active").ok, false);
  assert.equal(validateContactPatch({ status: "complained" }, "held").ok, false);
  assert.equal(validateContactPatch({}, "active").ok, false);
  assert.equal(validateContactPatch({ website: "not a site" }, "active").ok, false);
  assert.equal(validateContactPatch({ tags: "x" }, "unsubscribed").ok, true); // non-status edits stay possible
});

test("unsubscribe tokens: sign, parse, verify; tampering and wrong email fail", () => {
  const token = signUnsubscribeToken(SECRET, ID, "A@B.com");
  const p = parseUnsubscribeToken(token);
  assert.ok(p);
  assert.equal(verifyUnsubscribeToken(SECRET, p!, "a@b.com"), true); // email case does not matter
  assert.equal(verifyUnsubscribeToken(SECRET, p!, "other@b.com"), false);
  assert.equal(verifyUnsubscribeToken("t".repeat(32), p!, "a@b.com"), false);
  const forged = parseUnsubscribeToken(`${ID}.${"0".repeat(32)}`);
  assert.equal(verifyUnsubscribeToken(SECRET, forged!, "a@b.com"), false);
});

test("malformed tokens are rejected", () => {
  for (const bad of [undefined, 5, "", "abc", `${ID}`, `${ID}.zz`, `${ID}.${"a".repeat(32)}.x`, `not-a-uuid.${"a".repeat(32)}`, "a".repeat(200)]) {
    assert.equal(parseUnsubscribeToken(bad), null, String(bad));
  }
});

test("the unsubscribe secret comes from its own variable, else is derived, else links are off", () => {
  assert.equal(getUnsubscribeSecret({}), null);
  assert.equal(getUnsubscribeSecret({ OUTREACH_UNSUBSCRIBE_SECRET: "short" }), null);
  assert.equal(getUnsubscribeSecret({ OUTREACH_UNSUBSCRIBE_SECRET: SECRET }), SECRET);
  const derived = getUnsubscribeSecret({ PROVIDER_KEY_ENCRYPTION_SECRET: "k".repeat(32) });
  assert.ok(derived && derived.length === 64 && derived !== "k".repeat(32));
  assert.equal(derived, getUnsubscribeSecret({ PROVIDER_KEY_ENCRYPTION_SECRET: "k".repeat(32) }));
});

test("contact filters only pass known values and safe search text", () => {
  const f = parseContactFilters({ status: "held", source: "nope", country: "de", tag: " VIP! ", q: "a,b)(%_x", page: "3" });
  assert.equal(f.status, "held");
  assert.equal(f.source, null);
  assert.equal(f.country, "DE");
  assert.equal(f.tag, "vip");
  assert.equal(f.q, "abx");
  assert.equal(f.page, 3);
  const d = parseContactFilters({ status: "x", page: "-5", q: "a" });
  assert.equal(d.status, null);
  assert.equal(d.page, 1);
  assert.equal(d.q, null);
});

test("sender identity needs a name and a real-looking address", () => {
  assert.equal(validateSenderIdentity({ name: "", address: "12 Road, Dhaka, Bangladesh" }).ok, false);
  assert.equal(validateSenderIdentity({ name: "LinkLazy", address: "Dhaka" }).ok, false);
  assert.equal(validateSenderIdentity({ name: "LinkLazy", address: "12 Road\nDhaka 1205, Bangladesh" }).ok, true);
  assert.equal(senderIsComplete({ name: "LinkLazy", address: "12 Road, Dhaka, Bangladesh" }), true);
  assert.equal(senderIsComplete({ name: "", address: "" }), false);
});
