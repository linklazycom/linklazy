import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicHttpUrl, isBlockedIp, UrlNotAllowedError } from "../lib/safe-url.ts";

const blockedIps = [
  "127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255",
  "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "100.127.255.255", "224.0.0.1",
  "255.255.255.255", "198.18.0.1", "192.0.2.5",
  "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1",
  "::ffff:10.0.0.5", "::ffff:169.254.169.254", "[::1]", "2001:db8::1", "2002:7f00:1::1", "64:ff9b::7f00:1",
  "not-an-ip", "",
];
const publicIps = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "::ffff:8.8.8.8"];

for (const ip of blockedIps) {
  test(`isBlockedIp blocks ${JSON.stringify(ip)}`, () => assert.equal(isBlockedIp(ip), true));
}
for (const ip of publicIps) {
  test(`isBlockedIp allows ${ip}`, () => assert.equal(isBlockedIp(ip), false));
}

const rejectedUrls: Array<[string, string]> = [
  ["http://localhost/", "blocked_host"],
  ["http://LOCALHOST:80/", "blocked_host"],
  ["http://127.0.0.1/", "blocked_ip"],
  ["http://127.1/", "blocked_ip"],
  ["http://2130706433/", "blocked_ip"], // decimal form of 127.0.0.1
  ["http://0x7f000001/", "blocked_ip"], // hex form
  ["http://0177.0.0.1/", "blocked_ip"], // octal form
  ["http://169.254.169.254/latest/meta-data/", "blocked_ip"],
  ["http://[::1]/", "blocked_ip"],
  ["http://[::ffff:127.0.0.1]/", "blocked_ip"],
  ["http://10.0.0.1/", "blocked_ip"],
  ["http://0.0.0.0/", "blocked_ip"],
  ["http://metadata.google.internal/", "blocked_host"],
  ["http://intranet/", "blocked_host"],
  ["http://printer.local/", "blocked_host"],
  ["http://service.internal/", "blocked_host"],
  ["http://example.com:8080/", "bad_port"],
  ["http://example.com:22/", "bad_port"],
  ["http://user:pass@example.com/", "has_credentials"],
  ["ftp://example.com/", "bad_protocol"],
  ["file:///etc/passwd", "bad_protocol"],
  ["javascript:alert(1)", "bad_protocol"],
  ["data:text/html,hi", "bad_protocol"],
  ["not a url", "invalid_url"],
  ["", "invalid_url"],
];
for (const [url, reason] of rejectedUrls) {
  test(`assertPublicHttpUrl rejects ${JSON.stringify(url)} (${reason})`, () => {
    assert.throws(
      () => assertPublicHttpUrl(url),
      (err: unknown) => err instanceof UrlNotAllowedError && err.reason === reason
    );
  });
}

for (const url of ["https://example.com/", "http://example.com/path?q=1", "https://sub.example.co.uk:443/x", "https://8.8.8.8/", "https://example.com./"]) {
  test(`assertPublicHttpUrl allows ${url}`, () => {
    assert.equal(assertPublicHttpUrl(url) instanceof URL, true);
  });
}
