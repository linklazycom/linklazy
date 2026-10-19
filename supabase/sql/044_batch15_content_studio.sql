-- =====================================================================
-- 044_batch15_content_studio.sql  (Batch 15)  — additive only
-- Creates: content_documents (saved AI Content Studio drafts, one row per document)
-- Does NOT change any existing table, policy, trigger or data. Image providers need no SQL
-- (they use the existing api_providers table with kind = 'image').
--
-- PRE-CHECK (run first; expect: NULL):
--   select to_regclass('public.content_documents') as content_documents;
-- If it is NOT null, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch15 code.
-- The site keeps working if you run it before deploying.
--
-- ROLLBACK (saved drafts are lost; nothing else is touched):
--   drop trigger  if exists content_documents_project_owner on public.content_documents;
--   drop function if exists public.content_documents_check_project_owner();
--   drop table if exists public.content_documents;
-- =====================================================================

create table if not exists public.content_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  kind        text not null,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint content_documents_kind  check (kind in ('outreach_email','bio','article_ideas','article_outline','article_draft','title_meta','alt_text','comment_draft')),
  constraint content_documents_title check (char_length(title) between 1 and 120),
  constraint content_documents_body  check (char_length(body) between 1 and 60000)
);

create index if not exists content_documents_user_idx    on public.content_documents (user_id, updated_at desc);
create index if not exists content_documents_project_idx on public.content_documents (project_id) where project_id is not null;

-- A document may only point at a project owned by the SAME user (defence in depth; the server checks too).
create or replace function public.content_documents_check_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.project_id is not null
     and not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'project does not belong to the document owner' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.content_documents_check_project_owner() from public, anon, authenticated;

drop trigger if exists content_documents_project_owner on public.content_documents;
create trigger content_documents_project_owner
  before insert or update of project_id, user_id on public.content_documents
  for each row execute function public.content_documents_check_project_owner();

-- ---------- Row Level Security ----------
alter table public.content_documents enable row level security;

-- Owners (and admins) may READ. All writes go through our server routes (service role).
drop policy if exists content_documents_select on public.content_documents;
create policy content_documents_select on public.content_documents
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.content_documents from anon;
revoke insert, update, delete, truncate on public.content_documents from authenticated;
grant select on public.content_documents to authenticated;  -- explicit, so the policy works whatever the project's default privileges are
