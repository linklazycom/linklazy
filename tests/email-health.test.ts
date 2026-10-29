import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDkim, evaluateDmarc, evaluateSpf, parseFromDomain } from "../lib/email-health.ts";
import { buildLinkNoticeEmail } from "../lib/link-notices.ts";
import { limiterFor } from "../lib/limiter-registry.ts";

test("email: sending domain is read from EMAIL_FROM", () => {
  assert.equal(parseFromDomain("LinkLazy <no-reply@mail.LinkLazy.com>"), "mail.linklazy.com");
  assert.equal(parseFromDomain("hello@linklazy.com"), "linklazy.com");
  assert.equal(parseFromDomain("not an email"), null);
  assert.equal(parseFromDomain(undefined), null);
});

test("email: DKIM, SPF and DMARC evaluators", () => {
  assert.equal(evaluateDkim([["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1234567890"]]).ok, true);
  assert.equal(evaluateDkim([]).ok, false);
  assert.equal(evaluateSpf([["v=spf1 include:amazonses.com ~all"]]).ok, true);
  assert.equal(evaluateSpf([["v=spf1 include:other.com ~all"]]).ok, false);
  assert.equal(evaluateSpf([["v=spf1 include:amazonses.com ~all"], ["v=spf1 a ~all"]]).ok, false);
  assert.equal(evaluateSpf([]).ok, false);
  assert.equal(evaluateDmarc([["v=DMARC1; p=none; rua=mailto:a@b.com"]]).ok, true);
  assert.equal(evaluateDmarc([["something else"]]).ok, false);
});

test("link notice email escapes slug and reason", () => {
  const m = buildLinkNoticeEmail("takedown", { slug: "a<b>", note: "<script>x</script>", siteUrl: "https://linklazy.com" });
  assert.ok(!m.html.includes("<script>"));
  assert.ok(!m.html.includes("a<b>"));
  assert.match(m.subject, /turned off/);
  assert.match(buildLinkNoticeEmail("restore", { slug: "x", siteUrl: "https://linklazy.com" }).subject, /back on/);
});

test("public limiter: blocks after max, per name", () => {
  const l = limiterFor("test_route", 3, 60_000);
  assert.equal(l.allow("1.1.1.1"), true);
  assert.equal(l.allow("1.1.1.1"), true);
  assert.equal(l.allow("1.1.1.1"), true);
  assert.equal(l.allow("1.1.1.1"), false);
  assert.equal(l.allow("2.2.2.2"), true);
  assert.equal(limiterFor("other_route", 3, 60_000).allow("1.1.1.1"), true);
});
