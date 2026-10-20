/**
 * Regions where unsolicited commercial email needs consent or a stricter legal basis (Batch 16B-1).
 * This is a conservative SAFETY HOLD, not legal advice: contacts here are imported as "held" and only
 * sent to after the admin releases them on purpose. EU/EEA, UK and Switzerland.
 */
export const RESTRICTED_COUNTRIES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "GB", "CH", "EU",
]);

/** ISO 3166-1 alpha-2 (plus "UK" -> "GB"). Anything else is null. */
export function normalizeCountry(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  if (c === "UK") return "GB";
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** Country from a country-code domain (example.de -> DE). Generic domains (.com, .org) give null. */
export function countryFromDomain(domain: string): string | null {
  const tld = domain.toLowerCase().split(".").pop() ?? "";
  if (tld === "uk") return "GB";
  if (tld === "eu") return "EU";
  return /^[a-z]{2}$/.test(tld) ? tld.toUpperCase() : null;
}

export const isRestrictedCountry = (code: string | null): boolean => !!code && RESTRICTED_COUNTRIES.has(code);
