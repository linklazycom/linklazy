-- 065_batch20_backlink_notice.sql (Batch 20) — additive only, safe to run twice.
-- Remembers that the owner was already told a backlink was lost (so they get one email, not one per day).
-- Run BEFORE deploying the batch20 code. The monitor keeps working without it (no emails are sent until it exists).
-- ROLLBACK: alter table public.backlinks drop column if exists lost_notified_at;
alter table public.backlinks add column if not exists lost_notified_at timestamptz;
