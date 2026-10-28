/**
 * Pure rules for the wallet deposit bonus (Batch 19C). No database access.
 *
 * Decisions (agreed with the owner):
 *  - the bonus is credited to the wallet but can only be SPENT on the platform, never withdrawn
 *  - spending uses the bonus first
 *  - if the deposit payment is refunded, the unspent part of the bonus is clawed back
 */
export const BONUS_ENABLED_KEY = "deposit_bonus_enabled";
export const BONUS_MIN_KEY = "deposit_bonus_min_amount";
export const BONUS_PERCENT_KEY = "deposit_bonus_percent";
export const BONUS_MAX_KEY = "deposit_bonus_max_amount";
export const BONUS_SETTING_KEYS = [BONUS_ENABLED_KEY, BONUS_MIN_KEY, BONUS_PERCENT_KEY, BONUS_MAX_KEY];

export interface BonusSettings {
  enabled: boolean;
  minAmount: number; // top-ups of at least this many BDT get the bonus
  percent: number; // 1..100 (whole percent)
  maxBonus: number; // cap per top-up, BDT
}

/** Safe default: OFF. */
export const DEFAULT_BONUS: BonusSettings = { enabled: false, minAmount: 500, percent: 5, maxBonus: 500 };

function toNumber(v: unknown): number | null {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim().replace(/^"+|"+$/g, "");
    if (t === "true") return 1;
    if (t === "false") return 0;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  }
  return null;
}

/** Merges stored setting rows over the safe defaults; junk or out-of-range values fall back to the default. */
export function resolveBonusSettings(rows: { key: string; value: unknown }[] | null | undefined): BonusSettings {
  const out = { ...DEFAULT_BONUS };
  for (const row of rows ?? []) {
    const n = toNumber(row.value);
    if (n === null) continue;
    if (row.key === BONUS_ENABLED_KEY && (n === 0 || n === 1)) out.enabled = n === 1;
    if (row.key === BONUS_MIN_KEY && Number.isInteger(n) && n >= 50 && n <= 1_000_000) out.minAmount = n;
    if (row.key === BONUS_PERCENT_KEY && Number.isInteger(n) && n >= 1 && n <= 100) out.percent = n;
    if (row.key === BONUS_MAX_KEY && Number.isInteger(n) && n >= 1 && n <= 1_000_000) out.maxBonus = n;
  }
  return out;
}

export function validateBonusInput(input: {
  enabled: unknown;
  minAmount: unknown;
  percent: unknown;
  maxBonus: unknown;
}): { ok: true; rows: { key: string; value: number }[] } | { ok: false; error: string } {
  if (typeof input.enabled !== "boolean") return { ok: false, error: "Choose whether the bonus is on or off." };
  const min = Number(input.minAmount);
  const percent = Number(input.percent);
  const max = Number(input.maxBonus);
  if (!Number.isInteger(min) || min < 50 || min > 1_000_000) return { ok: false, error: "Minimum top-up must be a whole number from 50 to 1,000,000." };
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return { ok: false, error: "Bonus percent must be a whole number from 1 to 100." };
  if (!Number.isInteger(max) || max < 1 || max > 1_000_000) return { ok: false, error: "Maximum bonus must be a whole number from 1 to 1,000,000." };
  return {
    ok: true,
    rows: [
      { key: BONUS_ENABLED_KEY, value: input.enabled ? 1 : 0 },
      { key: BONUS_MIN_KEY, value: min },
      { key: BONUS_PERCENT_KEY, value: percent },
      { key: BONUS_MAX_KEY, value: max },
    ],
  };
}

/** Whole-taka bonus for one top-up (0 when off or below the minimum). */
export function computeBonus(topupAmount: number, s: BonusSettings): number {
  if (!s.enabled || !Number.isFinite(topupAmount) || topupAmount < s.minAmount) return 0;
  return Math.min(s.maxBonus, Math.floor((topupAmount * s.percent) / 100));
}

/** The part of the wallet that may go into a withdrawal: the balance minus the unspent bonus. */
export function withdrawableWallet(walletBalance: number, lockedBonus: number): number {
  return Math.max(0, Number(walletBalance) - Math.max(0, Number(lockedBonus)));
}

/** How much to take back when a deposit is refunded: only what is still unspent, never more than the balance. */
export function clawbackAmount(remaining: number, walletBalance: number): number {
  return Math.max(0, Math.min(Number(remaining), Number(walletBalance)));
}

export const BONUS_CLAWBACK_NOTE_PREFIX = "[bonus-clawback]";
