import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDestinationUrl, isSafeRedirectTarget, hostMatchesDomain } from "@/lib/links/url";

const own = ["linklazy.com", "www.linklazy.com"];

test("accepts normal URLs and adds https to bare domains", () => {
  const a = validateDestinationUrl("https://example.com/page?a=1#x");
  assert.equal(a.ok, true);
  const b = validateDestinationUrl("example.com/path");
  assert.equal(b.ok && b.url, "https://example.com/path");
});

test("rejects dangerous schemes", () => {
  for (const u of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd", "ftp://example.com/x", "vbscript:x"]) {
    const r = validateDestinationUrl(u);
    assert.equal(r.ok, false, u);
    if (!r.ok) assert.equal(r.error, "bad_protocol", u);
  }
});

test("rejects private / internal destinations", () => {
  for (const u of ["http://localhost/", "http://127.0.0.1/", "http://10.0.0.5/x", "http://169.254.169.254/latest", "http://[::1]/", "http://intranet/", "http://server.internal/", "https://example.com:8443/"]) {
    const r = validateDestinationUrl(u);
    assert.equal(r.ok, false, u);
    if (!r.ok) assert.equal(r.error, "private_host", u);
  }
});

test("rejects empty, spaces, control chars and over-long URLs", () => {
  assert.equal(validateDestinationUrl("").ok, false);
  assert.equal(validateDestinationUrl("https://exa mple.com").ok, false);
  assert.equal(validateDestinationUrl("https://example.com/\u0000").ok, false);
  const long = validateDestinationUrl("https://example.com/" + "a".repeat(2100));
  assert.equal(!long.ok && long.error, "too_long");
});

test("blocks loops to own short links but allows other own pages", () => {
  const loop = validateDestinationUrl("https://linklazy.com/l/abc", { ownHosts: own });
  assert.equal(!loop.ok && loop.error, "loop");
  const loop2 = validateDestinationUrl("https://www.linklazy.com/L/abc", { ownHosts: own });
  assert.equal(!loop2.ok && loop2.error, "loop");
  assert.equal(validateDestinationUrl("https://linklazy.com/browse", { ownHosts: own }).ok, true);
});

test("blocks other URL shorteners (redirect chains)", () => {
  for (const u of ["https://bit.ly/abc", "https://sub.tinyurl.com/x", "https://t.co/y"]) {
    const r = validateDestinationUrl(u);
    assert.equal(!r.ok && r.error, "shortener", u);
  }
});

test("admin blocked domains match the domain and its subdomains only", () => {
  const opts = { blockedDomains: ["evil.com"] };
  assert.equal(!validateDestinationUrl("https://evil.com/a", opts).ok, true);
  assert.equal(!validateDestinationUrl("https://login.evil.com/a", opts).ok, true);
  assert.equal(validateDestinationUrl("https://notevil.com/a", opts).ok, true);
  assert.equal(hostMatchesDomain("a.b.evil.com", "evil.com"), true);
  assert.equal(hostMatchesDomain("evil.com.au", "evil.com"), false);
});

test("credentials in URL are rejected (phishing trick)", () => {
  const r = validateDestinationUrl("https://paypal.com@evil.com/x");
  assert.equal(r.ok, false);
});

test("isSafeRedirectTarget only passes http(s)", () => {
  assert.equal(isSafeRedirectTarget("https://a.com"), true);
  assert.equal(isSafeRedirectTarget("javascript:alert(1)"), false);
  assert.equal(isSafeRedirectTarget("not a url"), false);
});
