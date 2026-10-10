-- 012_protect_sites_and_verifications.sql
-- !! Deploy the code in this batch FIRST (app/api/sites/route.ts and
-- !! app/api/sites/[id]/verify/route.ts now use the service client for the
-- !! trusted writes), THEN run this file. Safe to re-run.
--
-- Problem: owners can update ANY column of their own sites row from the browser:
-- status ('approved' without review), dr_verified (fake "verified" DR),
-- is_featured, admin_notes... Same for site_verifications.status ('verified').
--
-- Fix: triggers that restrict direct client sessions only. Admins, server code
-- (service_role) and SQL editor are unaffected. Seller-entered fields
-- (url, niche, price, guidelines, self-reported da/pa/dr/traffic, pay-per-view...)
-- stay editable.

create or replace function public.protect_site_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.dr_verified := null;
    new.dr_verified_at := null;
    new.dr_check_status := 'pending';
    new.is_featured := false;
    new.admin_notes := null;
    new.rejection_reason := null;
    return new;
  end if;

  if new.status          is distinct from old.status
  or new.dr_verified     is distinct from old.dr_verified
  or new.dr_verified_at  is distinct from old.dr_verified_at
  or new.dr_check_status is distinct from old.dr_check_status
  or new.is_featured     is distinct from old.is_featured
  or new.admin_notes     is distinct from old.admin_notes
  or new.rejection_reason is distinct from old.rejection_reason
  or new.owner_id        is distinct from old.owner_id
  then
    raise exception 'These site fields can only be changed by an admin or the system.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_site_columns on public.sites;
create trigger trg_protect_site_columns
  before insert or update on public.sites
  for each row execute function public.protect_site_columns();

create or replace function public.protect_site_verifications()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.verified_at := null;
    new.last_checked_at := null;
    return new;
  end if;

  if new.status          is distinct from old.status
  or new.verified_at     is distinct from old.verified_at
  or new.last_checked_at is distinct from old.last_checked_at
  or new.token           is distinct from old.token
  or new.site_id         is distinct from old.site_id
  or new.method          is distinct from old.method
  then
    raise exception 'Verification can only be updated by the system.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_site_verifications on public.site_verifications;
create trigger trg_protect_site_verifications
  before insert or update on public.site_verifications
  for each row execute function public.protect_site_verifications();
