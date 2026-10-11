-- 013_protect_orders.sql
-- Run in Supabase → SQL Editor AFTER the Batch 3 code is deployed. Safe to re-run.
--
-- Problem: policies `orders_insert_buyer` / `orders_update_participant` let a buyer or
-- seller write ANY column from the browser: create an order that is already
-- "delivered" with any price/commission, change status/price, etc. Together with the
-- old accept route this allowed paying a seller wallet for an order nobody paid for.
--
-- Fix: a trigger that restricts DIRECT client sessions only (authenticated/anon).
-- Server code (service_role), SECURITY DEFINER functions, admins and the SQL editor
-- are unaffected.
--
-- What clients may still do (matches the app's current routes):
--   INSERT  : create an order (status forced to the correct starting status)
--   seller  : pending_seller_acceptance -> in_progress          (accept-order)
--   seller  : awaiting_seller_site|in_progress -> delivered     (deliver, with proof fields)
--   buyer   : delivered -> accepted   (NOT for paid orders: only the server may do that)
--   either  : any open order -> disputed                        (dispute)
--   notes / target_url / anchor_text edits

create or replace function public.protect_order_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_delivering boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  ---------------------------------------------------------------- INSERT
  if tg_op = 'INSERT' then
    if new.seller_id = new.buyer_id then
      raise exception 'You cannot place an order with yourself.' using errcode = '42501';
    end if;

    new.commission_amount := null;
    new.commission_rate := null;
    new.proof_url := null;
    new.proof_screenshot_url := null;
    new.delivered_at := null;
    new.accepted_at := null;
    new.last_link_check_at := null;
    new.last_link_check_ok := null;
    new.archive_url := null;

    if new.order_type::text = 'paid' then
      new.status := 'pending_payment';
    elsif new.status::text not in ('pending_seller_acceptance', 'in_progress', 'awaiting_seller_site') then
      new.status := 'pending_seller_acceptance';
    end if;
    return new;
  end if;

  ---------------------------------------------------------------- UPDATE
  -- never changeable from a client session
  if new.order_type      is distinct from old.order_type
  or new.buyer_id        is distinct from old.buyer_id
  or new.seller_id       is distinct from old.seller_id
  or new.site_id         is distinct from old.site_id
  or new.buyer_site_id   is distinct from old.buyer_site_id
  or new.slot_id         is distinct from old.slot_id
  or new.price_amount    is distinct from old.price_amount
  or new.price_currency  is distinct from old.price_currency
  or new.commission_amount is distinct from old.commission_amount
  or new.commission_rate is distinct from old.commission_rate
  or new.deadline_at     is distinct from old.deadline_at
  or new.accepted_at     is distinct from old.accepted_at
  or new.archive_url     is distinct from old.archive_url
  or new.created_at      is distinct from old.created_at
  then
    raise exception 'These order fields can only be changed by the system or an admin.'
      using errcode = '42501';
  end if;

  v_delivering := new.status::text = 'delivered'
                  and old.status::text in ('awaiting_seller_site', 'in_progress')
                  and v_uid = old.seller_id;

  -- delivery proof fields: only as part of the seller's delivery step
  if (new.proof_url            is distinct from old.proof_url
   or new.proof_screenshot_url is distinct from old.proof_screenshot_url
   or new.delivered_at         is distinct from old.delivered_at
   or new.last_link_check_at   is distinct from old.last_link_check_at
   or new.last_link_check_ok   is distinct from old.last_link_check_ok)
     and not v_delivering then
    raise exception 'Delivery details can only be set when delivering an order.'
      using errcode = '42501';
  end if;

  -- status transitions
  if new.status is distinct from old.status then
    if old.status::text in ('accepted', 'cancelled', 'refunded') then
      raise exception 'This order is already closed.' using errcode = '42501';

    elsif old.status::text = 'pending_seller_acceptance'
          and new.status::text = 'in_progress'
          and v_uid = old.seller_id then
      null;

    elsif v_delivering then
      null;

    elsif new.status::text = 'disputed'
          and old.status::text <> 'disputed'
          and v_uid in (old.buyer_id, old.seller_id) then
      null;

    elsif new.status::text = 'accepted'
          and old.status::text = 'delivered'
          and v_uid = old.buyer_id
          and old.order_type::text <> 'paid' then
      null;

    else
      raise exception 'This status change is not allowed.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_order_columns on public.orders;
create trigger trg_protect_order_columns
  before insert or update on public.orders
  for each row execute function public.protect_order_columns();
