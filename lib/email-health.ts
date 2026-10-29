/**
 * Email setup check (Batch 20B). The evaluators are pure (tested in tests/email-health.test.ts);
 * lookupEmailDns() does the real DNS lookups on the server. This is a helpful second opinion only:
 * the authoritative status is Resend > Domains, and Resend's exact records can change.
 */
export interface DnsFinding {
  name: string;
  host: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

/** "LinkLazy <no-reply@mail.linklazy.com>" or "no-reply@linklazy.com" -> "mail.linklazy.com". */
export function parseFromDomain(from: string | undefined | null): string | null {
  if (!from) return null;
  const m = from.match(/<([^>]+)>/);
  const addr = (m ? m[1] : from).trim();
  const at = addr.lastIndexOf("@");
  if (at < 1) return null;
  const domain = addr.slice(at + 1).toLowerCase();
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain) ? domain : null;
}

const flat = (records: string[][]) => records.map((r) => r.join(""));

export function evaluateDkim(records: string[][]): { ok: boolean; detail: string } {
  const hit = flat(records).find((t) => /(^|;)\s*p=[A-Za-z0-9+/=]{20,}/.test(t));
  return hit ? { ok: true, detail: "DKIM key found." } : { ok: false, detail: "No DKIM key found at resend._domainkey. Copy the DKIM record from Resend > Domains." };
}

export function evaluateSpf(records: string[][]): { ok: boolean; detail: string } {
  const spf = flat(records).filter((t) => /^v=spf1\b/i.test(t.trim()));
  if (spf.length === 0) return { ok: false, detail: "No SPF record found on the sending subdomain." };
  if (spf.length > 1) return { ok: false, detail: "More than one SPF record: only one is allowed. Merge them into one." };
  return /amazonses\.com|resend/i.test(spf[0]) ? { ok: true, detail: "SPF record found." } : { ok: false, detail: "An SPF record exists but does not include Resend's sender (amazonses.com)." };
}

export function evaluateDmarc(records: string[][]): { ok: boolean; detail: string } {
  const d = flat(records).find((t) => /^v=DMARC1\b/i.test(t.trim()));
  if (!d) return { ok: false, detail: "No DMARC record. Add a TXT record at _dmarc with at least v=DMARC1; p=none; rua=mailto:you@yourdomain." };
  return { ok: true, detail: /p=none/i.test(d) ? "DMARC found (monitoring mode p=none, fine to start)." : "DMARC found." };
}

/** Real DNS lookups. Never throws; a missing record is a finding, not an error. */
export async function lookupEmailDns(domain: string): Promise<DnsFinding[]> {
  const { resolveTxt } = await import("node:dns/promises");
  const txt = async (host: string): Promise<string[][]> => {
    try {
      return await resolveTxt(host);
    } catch {
      return [];
    }
  };
  const root = domain.replace(/^send\./, "");
  const [dkim, spfSend, spfRoot, dmarc] = await Promise.all([
    txt(`resend._domainkey.${root}`),
    txt(`send.${root}`),
    txt(root),
    txt(`_dmarc.${root}`),
  ]);
  const spf = spfSend.length ? evaluateSpf(spfSend) : evaluateSpf(spfRoot);
  const k = evaluateDkim(dkim);
  const m = evaluateDmarc(dmarc);
  return [
    { name: "DKIM", host: `resend._domainkey.${root}`, ok: k.ok, required: true, detail: k.detail },
    { name: "SPF", host: spfSend.length ? `send.${root}` : root, ok: spf.ok, required: true, detail: spf.detail },
    { name: "DMARC", host: `_dmarc.${root}`, ok: m.ok, required: false, detail: m.detail },
  ];
}
