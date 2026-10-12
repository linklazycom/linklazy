/** Pure: interprets a site_settings flag value ("on"/"off", true/false, '"on"'). */
export function normalizeFlag(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().replace(/^"+|"+$/g, "").toLowerCase();
    if (["on", "true", "yes", "1", "enabled"].includes(v)) return true;
    if (["off", "false", "no", "0", "disabled"].includes(v)) return false;
  }
  return fallback;
}
