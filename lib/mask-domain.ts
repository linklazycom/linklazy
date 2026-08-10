/**
 * Masks a domain for display to buyers who haven't unlocked the listing —
 * e.g. "example.com" -> "ex****.com". Keeps enough of the string that the
 * masking is visually obvious without leaking the real domain.
 */
export function maskDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length < 2) return "****";

  const tld = parts[parts.length - 1];
  const name = parts.slice(0, -1).join(".");
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(4, name.length - visible.length))}.${tld}`;
}
