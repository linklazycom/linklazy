import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBlockDomain } from "@/lib/links/blocklist";

test("normalizeBlockDomain extracts a clean domain", () => {
  assert.equal(normalizeBlockDomain("https://www.Evil.com:8080/path?x=1"), "evil.com");
  assert.equal(normalizeBlockDomain("evil.com"), "evil.com");
  assert.equal(normalizeBlockDomain("sub.evil.co.uk/"), "sub.evil.co.uk");
});

test("normalizeBlockDomain rejects junk", () => {
  for (const v of ["", "localhost", "not a domain", "http://", "a..b.com", "-x.com.", "evil"]) {
    assert.equal(normalizeBlockDomain(v), null, v);
  }
});
