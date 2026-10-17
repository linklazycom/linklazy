import { test } from "node:test";
import assert from "node:assert/strict";
import { isCustomHost, customHostRewritePath, normalizeHostHeader } from "@/lib/domains/host";

const own = ["linklazy.com", "www.linklazy.com"];

test("our own hosts, previews and local hosts are never custom", () => {
  for (const h of ["linklazy.com", "www.linklazy.com", "LinkLazy.com:443", "linklazy-abc123.vercel.app", "localhost:3000", "foo.localhost", "127.0.0.1", "[::1]:3000", "", null, undefined]) {
    assert.equal(isCustomHost(h, own), false, String(h));
  }
});

test("any other dotted hostname is a custom host", () => {
  assert.equal(isCustomHost("go.brand.com", own), true);
  assert.equal(isCustomHost("GO.Brand.com:443", own), true);
  assert.equal(isCustomHost("go.brand.com.", own), true);
  // look-alikes of our own domain are still custom (and simply resolve to "not found" unless registered)
  assert.equal(isCustomHost("linklazy.com.evil.io", own), true);
});

test("normalizeHostHeader strips port, trailing dot and case", () => {
  assert.equal(normalizeHostHeader("Go.Brand.com.:8443"), "go.brand.com");
});

test("every path on a custom host is rewritten under /d/<host>", () => {
  assert.equal(customHostRewritePath("go.brand.com", "/"), "/d/go.brand.com");
  assert.equal(customHostRewritePath("go.brand.com", "/abc"), "/d/go.brand.com/abc");
  assert.equal(customHostRewritePath("go.brand.com", "/dashboard"), "/d/go.brand.com/dashboard");
  assert.equal(customHostRewritePath("go.brand.com", "/api/admin/users"), "/d/go.brand.com/api/admin/users");
  assert.equal(customHostRewritePath("go.brand.com", "/l/abc"), "/d/go.brand.com/l/abc");
  assert.equal(customHostRewritePath("go.brand.com", "/bio/me"), "/d/go.brand.com/bio/me");
});
