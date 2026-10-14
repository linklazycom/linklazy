# Money audit (Batch 8) - 14 Oct 2026

## Commission "10% on a 1950 BDT order" (suspected earlier)
The current code is correct: `computeCommission` (lib/order-money.ts) converts the seller's month-to-date BDT
total to USD with `bdt_per_usd` before applying the tiers. 1950 BDT at 125 is about 15.6 USD, so 20%.
Unit tests now pin this (tests/order-money.test.ts). The 10% seen earlier came from orders accepted through the
old admin "force accept" path before all money moves were centralised (see SQL 021).

## Bugs found and fixed
| Area | Problem | Fix |
|---|---|---|
| Admin rejects a withdrawal | The wallet part reserved at request time was never returned; the user lost it | `wallet_reserved` column; rejection returns it (ledger type admin_adjustment) |
| Withdrawal availability | The wallet part was counted twice (once debited, once as "locked"), understating what could be withdrawn | `referralAvailable` / `planWithdrawal` in lib/withdrawal-flow.ts |
| Withdrawal insert fails after the wallet debit | Money gone, no request | Debit is refunded automatically |
| Two simultaneous requests | Referral credits could be overdrawn | Re-check after insert; undo if overdrawn |
| Admin status changes | Any status could be set from any status (rejected -> approved, paid -> rejected) | Transition table + atomic claim |
| Seller rejects an order | Refund ignored RPC errors and used ledger type topup (skewed deposit statistics) | Uses refundOrderToBuyer; failure re-opens the order |
| Unlock route | Old subscription quota path still wrote profiles.buyer_* and credits_ledger | Path retired (HTTP 410), wallet is the default |
| wallet_ledger | UPDATE/DELETE possible | Append-only trigger (SQL 030) |

## New tools
- Admin > Wallet reconciliation (read-only): wallet_balance versus sum of ledger rows.
- SQL 030 checks C3 and C4 list mismatches and old rejected withdrawals that may need a manual wallet correction.

## Known and accepted
- The bulk-order database function still writes a placeholder 17.5% commission on creation; the insert trigger nulls it,
  the UI never shows it, and the real commission is set on accept. Harmless; cleanup is optional.
- Refunds use ledger type admin_adjustment until a dedicated refund type exists (Batch 8b).
