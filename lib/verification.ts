import { randomBytes } from "crypto";
import { promises as dns } from "dns";

export function generateVerificationToken(): string {
  return `linklazy-verify-${randomBytes(12).toString("hex")}`;
}

interface VerifyResult {
  ok: boolean;
  message: string;
}

/**
 * Checks a <meta name="linklazy-site-verification" content="TOKEN"> tag
 * on the site's homepage.
 */
export async function checkMetaTag(url: string, token: string): Promise<VerifyResult> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, message: `Site responded with ${res.status}` };
    const html = await res.text();
    const found = new RegExp(
      `<meta[^>]+name=["']linklazy-site-verification["'][^>]+content=["']${token}["']`,
      "i"
    ).test(html);
    return found
      ? { ok: true, message: "Meta tag found and matched." }
      : { ok: false, message: "Meta tag not found on the homepage." };
  } catch (err) {
    return { ok: false, message: `Could not fetch site: ${(err as Error).message}` };
  }
}

/**
 * Checks for a file at /<token>.txt containing the token itself.
 */
export async function checkHtmlFile(url: string, token: string): Promise<VerifyResult> {
  try {
    const base = new URL(url);
    const fileUrl = `${base.origin}/${token}.txt`;
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, message: `Verification file not found at ${fileUrl}` };
    const text = (await res.text()).trim();
    return text === token
      ? { ok: true, message: "Verification file found and matched." }
      : { ok: false, message: "File found but content did not match." };
  } catch (err) {
    return { ok: false, message: `Could not fetch file: ${(err as Error).message}` };
  }
}

/**
 * Checks for a DNS TXT record: linklazy-site-verification=TOKEN
 */
export async function checkDnsTxt(url: string, token: string): Promise<VerifyResult> {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const records = await dns.resolveTxt(domain);
    const flat = records.map((r) => r.join(""));
    const found = flat.some((r) => r.trim() === `linklazy-site-verification=${token}`);
    return found
      ? { ok: true, message: "DNS TXT record found and matched." }
      : { ok: false, message: "No matching TXT record found yet (DNS can take time to propagate)." };
  } catch (err) {
    return { ok: false, message: `DNS lookup failed: ${(err as Error).message}` };
  }
}

export async function runVerification(
  method: "meta_tag" | "html_file" | "dns_txt",
  url: string,
  token: string
): Promise<VerifyResult> {
  switch (method) {
    case "meta_tag":
      return checkMetaTag(url, token);
    case "html_file":
      return checkHtmlFile(url, token);
    case "dns_txt":
      return checkDnsTxt(url, token);
    default:
      return { ok: false, message: "Unsupported verification method." };
  }
}
