-- ============================================================
-- Support column for auto-sync orders fix (see supabase/functions/
-- auto-sync/index.ts): the full-history WB orders pull (flag=0,
-- fetching everything since DATE_FROM in one request) is expensive
-- and was previously re-run on EVERY 4h cron tick forever, re-
-- downloading and re-writing months of order history every time.
-- That was the root cause of intermittent under-counts on recent
-- days (large unpaginated payload + delete-all-then-reinsert-all,
-- with the newest/most-recently-changed rows processed last and
-- therefore most likely to be lost to a timeout).
--
-- auto-sync now only re-runs that full historical pull once per
-- ~20h per cabinet, tracked via this timestamp. Recent days (today
-- + last few days) are instead resynced precisely on EVERY cron
-- tick via a small, cheap, single-day flag=1 query per day — see
-- the "Pass B" comments in auto-sync/index.ts.
--
-- Safe to re-run.
-- ============================================================

alter table public.cabinets
    add column if not exists last_full_orders_sync_at timestamptz;

select 'cabinets.last_full_orders_sync_at ready' as status;
