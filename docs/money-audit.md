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
- (Batch 8b) Refunds now use ledger type order_refund (wallet_ledger.type is plain text, so no enum change is needed).
  If a database rejects the new label, lib/wallet-refund.ts retries once with admin_adjustment, so a refund never fails because of its label.

## Verified in production (14 Oct 2026)
SQL 030 checks: append-only trigger enabled; 7 users checked, 0 reconciliation mismatches; no old rejected withdrawals with a missing wallet refund.

## Batch 14: pay-per-use charges from the wallet

- **Everything is OFF by default.** Nothing is charged until an admin switches charging on (Admin > Usage pricing) AND gives an action a price above 0. Admins are never charged.
- **Where money moves:** only inside two database functions (SQL 042), `usage_charge_debit` and `usage_charge_refund`. Both call the existing atomic `adjust_wallet_balance`, so `wallet_ledger` rows (type `usage_charge`, or `admin_adjustment` when a database rejects the label; refunds `order_refund` or `admin_adjustment`) and the Wallet reconciliation view stay consistent. Both functions are closed to every browser role (service role only).
- **One transaction:** the `usage_charges` row and the wallet debit succeed together or neither happens. A refused/failed debit leaves no usage row behind.
- **Never charged twice:** `(user_id, idempotency_key)` is unique; a retry with the same request id returns "already processed" and takes no money. The free-allowance count and the duplicate check run under a per-user-per-action advisory lock.
- **Refunds are idempotent:** refunding a charge twice returns the money once; refunding a free use marks it `void` (the free use goes back to the daily allowance).
- **Prices are server-side:** the browser sends only a request id and the price it displayed. If the real price is higher the request is refused (409); the charged amount always comes from site_settings, never from the browser.
- **Failure policy:** AI suggestions are refunded automatically when no usable suggestion could be delivered. A paid extra backlink check is refunded only when the check failed on OUR side ("Check failed"); an unreachable source page still counts as a delivered check.
- **Support:** Admin > Usage pricing lists the 50 newest charges with a Refund button (also logged in `admin_logs`). If the server crashes between the debit and the AI call the charge stays `charged`; the admin refunds it from that list.
- **Not covered yet:** link/short-link over-limit charging (only AI suggestions and extra manual backlink checks are chargeable today).
