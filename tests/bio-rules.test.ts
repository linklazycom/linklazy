import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBioText, validateDisplayName, validateTheme, validateAvatarUrl, validateBioLink } from "@/lib/bio/rules";
import { BIO_THEMES, getBioTheme } from "@/lib/bio/themes";

test("cleanBioText keeps up to 5 lines, strips control chars, caps length", () => {
  assert.equal(cleanBioText("Hello\r\nWorld"), "Hello\nWorld");
  assert.equal(cleanBioText("a\n\n\n\n\n\n\nb")!.split("\n").length <= 5, true);
  assert.equal(cleanBioText("   "), null);
  assert.equal(cleanBioText("x".repeat(1000))!.length, 300);
  assert.equal(cleanBioText("a\u0000b"), "a b");
  assert.equal(cleanBioText(5), null);
});

test("HTML in text stays plain text (it is escaped by React at render time)", () => {
  assert.equal(cleanBioText("<script>alert(1)</script>"), "<script>alert(1)</script>");
});

test("display name and theme validation", () => {
  assert.deepEqual(validateDisplayName("  Rahim  "), { ok: true, value: "Rahim" });
  assert.equal(validateDisplayName("   ").ok, false);
  assert.equal(validateTheme("ocean").ok, true);
  assert.equal(validateTheme("neon").ok, false);
  assert.equal(validateTheme(undefined).ok, false);
});

test("avatar URL: https only, optional, safe hosts only", () => {
  assert.deepEqual(validateAvatarUrl(""), { ok: true, value: null });
  assert.deepEqual(validateAvatarUrl(null), { ok: true, value: null });
  assert.equal(validateAvatarUrl("http://example.com/a.png").ok, false);
  assert.equal(validateAvatarUrl("https://localhost/a.png").ok, false);
  assert.equal(validateAvatarUrl("javascript:alert(1)").ok, false);
  const ok = validateAvatarUrl("https://example.com/a.png");
  assert.equal(ok.ok && ok.value, "https://example.com/a.png");
});

test("bio link validation reuses the destination rules", () => {
  assert.equal(validateBioLink({ title: "My shop", url: "https://example.com/shop" }).ok, true);
  assert.equal(validateBioLink({ title: "", url: "https://example.com" }).ok, false);
  assert.equal(validateBioLink({ title: "x", url: "javascript:alert(1)" }).ok, false);
  assert.equal(validateBioLink({ title: "x", url: "http://10.0.0.1" }).ok, false);
  assert.equal(validateBioLink({ title: "x", url: "https://bit.ly/a" }).ok, false);
  const blocked = validateBioLink({ title: "x", url: "https://evil.com/a" }, { blockedDomains: ["evil.com"] });
  assert.equal(blocked.ok, false);
  const bare = validateBioLink({ title: "x", url: "example.com" });
  assert.equal(bare.ok && bare.url, "https://example.com/");
});

test("themes: unique ids, fallback to light", () => {
  const ids = BIO_THEMES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(getBioTheme("nope").id, "light");
  assert.equal(getBioTheme("dark").id, "dark");
  for (const t of BIO_THEMES) for (const c of [t.bg, t.text, t.button, t.buttonText]) assert.match(c, /^#[0-9A-Fa-f]{6}$/);
});
