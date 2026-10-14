/**
 * Ledger type used when money goes BACK to a wallet (order refunds, rejected
 * withdrawals). It is a single constant so it can be switched in one place to a
 * dedicated "refund" ledger type later. It must never be "topup": top-ups are
 * real deposits and are counted as such in revenue/health statistics.
 */
export const REFUND_LEDGER_TYPE = "admin_adjustment";
