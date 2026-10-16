import { validateDestinationUrl, type DestinationOptions } from "@/lib/links/url";
import { cleanText } from "@/lib/links/fields";
import { BIO_THEME_IDS } from "@/lib/bio/themes";

/** Pure validation for bio pages and their links (Batch 10). Tested in tests/bio-rules.test.ts. */
export const BIO_NAME_MAX = 60;
export const BIO_TEXT_MAX = 300;
export const BIO_LINK_TITLE_MAX = 80;

type Fail = { ok: false; message: string; field: string };

/** Plain text only (never HTML). Keeps line breaks, max 5 lines. */
export function cleanBioText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const lines = v
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim())
    .slice(0, 5);
  const t = lines.join("\n").trim().slice(0, BIO_TEXT_MAX);
  return t || null;
}

export function validateDisplayName(v: unknown): { ok: true; value: string } | Fail {
  const t = cleanText(v, BIO_NAME_MAX);
  return t ? { ok: true, value: t } : { ok: false, message: "Enter a display name.", field: "display_name" };
}

export function validateTheme(v: unknown): { ok: true; value: string } | Fail {
  return typeof v === "string" && BIO_THEME_IDS.includes(v)
    ? { ok: true, value: v }
    : { ok: false, message: "Choose one of the available themes.", field: "theme" };
}

/** Avatar must be a public https image URL (no uploads yet, so we only link it). Empty = no avatar. */
export function validateAvatarUrl(v: unknown, opts: DestinationOptions = {}): { ok: true; value: string | null } | Fail {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, message: "Invalid avatar URL.", field: "avatar_url" };
  if (!/^https:\/\//i.test(v.trim())) return { ok: false, message: "The avatar URL must start with https://", field: "avatar_url" };
  const r = validateDestinationUrl(v, opts);
  if (!r.ok) return { ok: false, message: r.message, field: "avatar_url" };
  if (r.url.length > 500) return { ok: false, message: "The avatar URL is too long.", field: "avatar_url" };
  return { ok: true, value: r.url };
}

export function validateBioLink(
  input: { title?: unknown; url?: unknown },
  opts: DestinationOptions = {}
): { ok: true; title: string; url: string } | Fail {
  const title = cleanText(input.title, BIO_LINK_TITLE_MAX);
  if (!title) return { ok: false, message: "Enter a title for the link.", field: "title" };
  const r = validateDestinationUrl(typeof input.url === "string" ? input.url : "", opts);
  if (!r.ok) return { ok: false, message: r.message, field: "url" };
  return { ok: true, title, url: r.url };
}
