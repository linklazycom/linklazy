/**
 * Ledger type used when money goes BACK to a wallet (order refunds, rejected
 * withdrawals). It must never be "topup": top-ups are real deposits and are
 * counted as such in revenue/health statistics.
 */
export const REFUND_LEDGER_TYPE = "order_refund";

/**
 * Older databases may reject an unknown ledger type (for example through a
 * check constraint inside the wallet function). The credit helper then retries
 * once with this long-standing type so a refund can never fail only because of its label.
 */
export const REFUND_FALLBACK_LEDGER_TYPE = "admin_adjustment";
