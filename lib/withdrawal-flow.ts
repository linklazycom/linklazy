/** Pure rules for withdrawal requests (no database access, easy to test). */
export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

/** Allowed admin moves. "paid" and "rejected" are final. */
export const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  paid: [],
  rejected: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = WITHDRAWAL_TRANSITIONS[from as WithdrawalStatus];
  return !!allowed && allowed.includes(to as WithdrawalStatus);
}

export interface LockedRequest {
  amount: number;
  status: string;
  /** Part of the amount that was taken out of the wallet when the request was made. null = request created before this field existed. */
  wallet_reserved: number | null;
}

const LOCKING_STATUSES = ["pending", "approved", "paid"];

/**
 * Referral credits are not a live balance, so what the user may still
 * withdraw from them is: total earned minus the referral part of every
 * request that still holds funds. The wallet part is NOT subtracted again
 * (it was already debited from wallet_balance when the request was made).
 * Old requests without wallet_reserved count fully against referral credits,
 * which is exactly what the previous formula did.
 */
export function referralAvailable(totalReferralEarned: number, requests: LockedRequest[]): number {
  const lockedReferral = requests
    .filter((r) => LOCKING_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + (r.amount - (r.wallet_reserved ?? 0)), 0);
  return totalReferralEarned - lockedReferral;
}

export type WithdrawalPlan =
  | { ok: true; fromWallet: number; fromReferral: number }
  | { ok: false; available: number };

/** Wallet is used first, the rest must be covered by referral credits. */
export function planWithdrawal(amount: number, walletBalance: number, referralAvail: number): WithdrawalPlan {
  const available = Math.max(0, walletBalance) + Math.max(0, referralAvail);
  if (!Number.isFinite(amount) || amount <= 0 || amount > available) return { ok: false, available };
  const fromWallet = Math.min(amount, Math.max(0, walletBalance));
  return { ok: true, fromWallet, fromReferral: amount - fromWallet };
}
