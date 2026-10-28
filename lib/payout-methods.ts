/**
 * Pure rules for seller payout details (no database access, easy to test).
 * Supported methods: bKash, Nagad (Bangladesh mobile wallets) and bank transfer.
 * Payoneer / Wise can be added later by extending PAYOUT_METHODS.
 */
export type PayoutMethod = "bkash" | "nagad" | "bank";

export const PAYOUT_METHODS: { id: PayoutMethod; label: string }[] = [
  { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" },
  { id: "bank", label: "Bank transfer" },
];

export interface PayoutInput {
  method?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  routing_number?: string | null;
}

export interface PayoutDetails {
  method: PayoutMethod;
  account_number: string;
  account_name: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  routing_number: string | null;
}

export type PayoutResult = { ok: true; value: PayoutDetails } | { ok: false; error: string };

export function isPayoutMethod(value: unknown): value is PayoutMethod {
  return value === "bkash" || value === "nagad" || value === "bank";
}

export function payoutLabel(method: string | null | undefined): string {
  return PAYOUT_METHODS.find((m) => m.id === method)?.label ?? "bKash";
}

/** Accepts 01XXXXXXXXX, 8801XXXXXXXXX and +8801XXXXXXXXX (spaces/dashes allowed). Returns 01XXXXXXXXX or null. */
export function normalizeBdMobile(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("880") ? `0${digits.slice(3)}` : digits;
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

const clean = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ");

export function validatePayout(input: PayoutInput): PayoutResult {
  const method = input.method ?? "bkash";
  if (!isPayoutMethod(method)) return { ok: false, error: "Please choose a payout method." };

  if (method === "bkash" || method === "nagad") {
    const number = normalizeBdMobile(input.account_number ?? "");
    if (!number) {
      return { ok: false, error: `Enter a valid ${payoutLabel(method)} number, like 01XXXXXXXXX.` };
    }
    return {
      ok: true,
      value: { method, account_number: number, account_name: null, bank_name: null, bank_branch: null, routing_number: null },
    };
  }

  const accountNumber = (input.account_number ?? "").replace(/[\s-]/g, "");
  if (!/^[A-Za-z0-9]{6,34}$/.test(accountNumber)) {
    return { ok: false, error: "Enter a valid bank account number (6 to 34 letters or digits)." };
  }
  const accountName = clean(input.account_name);
  if (accountName.length < 2 || accountName.length > 80) {
    return { ok: false, error: "Enter the account holder name exactly as the bank has it." };
  }
  const bankName = clean(input.bank_name);
  if (bankName.length < 2 || bankName.length > 80) {
    return { ok: false, error: "Enter the bank name." };
  }
  const branch = clean(input.bank_branch);
  if (branch.length > 80) return { ok: false, error: "Branch name is too long." };
  const routing = (input.routing_number ?? "").replace(/[\s-]/g, "");
  if (routing && !/^\d{9}$/.test(routing)) {
    return { ok: false, error: "A routing number has 9 digits. Leave it empty if you do not know it." };
  }

  return {
    ok: true,
    value: {
      method,
      account_number: accountNumber,
      account_name: accountName,
      bank_name: bankName,
      bank_branch: branch || null,
      routing_number: routing || null,
    },
  };
}

export interface PayoutRow {
  method?: string | null;
  bkash_number?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  routing_number?: string | null;
}

/** The account to pay: new column first, then the old bKash column (requests made before Batch 19A). */
export function payoutAccount(row: PayoutRow): string {
  return (row.account_number ?? row.bkash_number ?? "").trim();
}

export function maskAccount(account: string): string {
  const compact = account.replace(/\s/g, "");
  if (compact.length <= 4) return compact;
  return `${"*".repeat(Math.min(compact.length - 4, 8))}${compact.slice(-4)}`;
}

/** One-line description of where the money goes. mask=true hides all but the last 4 characters of a bank account. */
export function payoutSummary(row: PayoutRow, options: { mask?: boolean } = {}): string {
  const method = isPayoutMethod(row.method) ? row.method : "bkash";
  const account = payoutAccount(row);
  if (method !== "bank") return `${payoutLabel(method)} ${account}`.trim();
  const shown = options.mask ? maskAccount(account) : account;
  const bank = row.bank_name ? `${row.bank_name} · ` : "";
  const holder = row.account_name ? ` (${row.account_name})` : "";
  return `Bank: ${bank}A/C ${shown}${holder}`;
}

/** What the admin must enter when marking a request as paid. */
export function validatePaidProof(input: {
  transaction_id?: string | null;
  proof_url?: string | null;
}): { ok: true; transaction_id: string; proof_url: string | null } | { ok: false; error: string } {
  const txn = clean(input.transaction_id);
  if (txn.length < 4 || txn.length > 64 || !/^[A-Za-z0-9._\- #/]+$/.test(txn)) {
    return { ok: false, error: "Enter the payout transaction ID (4 to 64 characters)." };
  }
  const rawProof = (input.proof_url ?? "").trim();
  if (!rawProof) return { ok: true, transaction_id: txn, proof_url: null };
  if (rawProof.length > 500) return { ok: false, error: "The proof link is too long." };
  let url: URL;
  try {
    url = new URL(rawProof);
  } catch {
    return { ok: false, error: "The proof link must be a full https:// address." };
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    return { ok: false, error: "The proof link must be a full https:// address." };
  }
  return { ok: true, transaction_id: txn, proof_url: url.toString() };
}
