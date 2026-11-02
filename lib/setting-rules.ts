/**
 * Rules for the values an admin may save in Admin > Platform settings (Batch 23B). Only settings that move money or break pages when
 * mistyped are checked; every other key passes through unchanged. Pure, so it is unit-tested.
 */
export const BDT_PER_USD_MIN = 50;
export const BDT_PER_USD_MAX = 500;

export type SettingCheck = { ok: true; value: unknown } | { ok: false; error: string };

export function validateSetting(key: string, value: unknown): SettingCheck {
  if (key === "bdt_per_usd") {
    const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Enter the rate as a plain number, for example 125 or 124.5 (no letters, commas or currency signs)." };
    const n = Number(text);
    if (!Number.isFinite(n) || n < BDT_PER_USD_MIN || n > BDT_PER_USD_MAX) return { ok: false, error: `The rate must be between ${BDT_PER_USD_MIN} and ${BDT_PER_USD_MAX} BDT per USD. Wallet top-ups and commissions use it.` };
    return { ok: true, value: String(n) };
  }
  return { ok: true, value };
}
