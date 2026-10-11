-- 013b_add_payment_provider_values.sql
-- Run FIRST and ALONE (its own Run). This file must contain ONLY the two ALTER lines:
-- a new enum value cannot be used (even in a SELECT) in the same Run that adds it.
--
-- Problem found in your export: enum payment_provider = {bkash, stripe, manual}.
--   * PayPal: app/api/orders/[id]/pay and app/api/wallet/topup insert provider 'paypal'
--     -> fails today ("invalid input value for enum"), so PayPal payments cannot start.
--   * Wallet orders: place_bulk_order_with_wallet inserts provider 'wallet' inside a block
--     that silently ignores that exact error -> wallet orders never got a payments row.
-- Adding the two values fixes both. Existing values stay untouched.
--
-- To check the result, run this ONE line separately afterwards (new Run):
--   select unnest(enum_range(null::public.payment_provider))::text as provider;
-- Expected: bkash, stripe, manual, paypal, wallet

alter type public.payment_provider add value if not exists 'paypal';
alter type public.payment_provider add value if not exists 'wallet';
