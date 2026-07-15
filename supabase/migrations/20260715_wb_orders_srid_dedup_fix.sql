-- ============================================================
-- Fix wb_orders under-counting bug:
-- auto-sync upserted orders with onConflict = (cabinet_id, order_date,
-- nm_id, barcode) + ignoreDuplicates:true. WB legitimately returns
-- MULTIPLE distinct orders for the same product+barcode on the same
-- day (different buyers/units) — each has its own unique WB order id
-- ("srid" in the orders/sales API payload). The old conflict target
-- silently dropped every order after the first one that shared
-- (date, nm_id, barcode) within a cabinet, undercounting real order
-- counts (e.g. WB Partners showing 136 orders for a day vs. our
-- dashboard showing 48 for the same cabinet/day).
--
-- This migration adds a dedicated `srid` column (the real unique WB
-- order-line id, already present inside the raw `data` jsonb for every
-- row synced so far) and a unique index on (cabinet_id, srid) so future
-- syncs can dedupe correctly by upserting on that instead.
--
-- Safe to re-run.
-- ============================================================

alter table wb_orders add column if not exists srid text;

-- Backfill from the raw WB payload already stored in `data` for
-- existing rows (auto-sync always stores the full order object there).
update wb_orders
set srid = data->>'srid'
where srid is null and data ? 'srid';

-- Drop the old overly-narrow unique constraint/index that was used as
-- the upsert conflict target (cabinet_id, order_date, nm_id, barcode) —
-- name is looked up dynamically since it wasn't created via a tracked
-- migration in this repo.
do $$
declare
    rec record;
begin
    for rec in
        select pc.conname
        from pg_constraint pc
        join pg_class rel on rel.oid = pc.conrelid
        where rel.relname = 'wb_orders'
          and pc.contype = 'u'
          and (
              select array_agg(a.attname order by a.attname)
              from unnest(pc.conkey) k
              join pg_attribute a on a.attnum = k and a.attrelid = pc.conrelid
          ) = array['barcode', 'cabinet_id', 'nm_id', 'order_date']::name[]
    loop
        execute format('alter table wb_orders drop constraint %I', rec.conname);
    end loop;

    for rec in
        select ic.relname as idxname
        from pg_index i
        join pg_class ic on ic.oid = i.indexrelid
        join pg_class tc on tc.oid = i.indrelid
        where tc.relname = 'wb_orders'
          and i.indisunique
          and not i.indisprimary
          and (
              select array_agg(a.attname order by a.attname)
              from unnest(i.indkey) k
              join pg_attribute a on a.attnum = k and a.attrelid = tc.oid
          ) = array['barcode', 'cabinet_id', 'nm_id', 'order_date']::name[]
    loop
        execute format('drop index if exists %I', rec.idxname);
    end loop;
end $$;

-- New correct dedup key: one row per real WB order line per cabinet.
-- Partial (srid is not null) since virtually all WB orders carry srid,
-- and NULL-srid rows are naturally treated as distinct by Postgres
-- anyway (never collide), so no data loss for the rare row without it.
create unique index if not exists idx_wb_orders_cab_srid_uniq
    on wb_orders (cabinet_id, srid)
    where srid is not null;

select 'wb_orders srid dedup fix ready' as status;
