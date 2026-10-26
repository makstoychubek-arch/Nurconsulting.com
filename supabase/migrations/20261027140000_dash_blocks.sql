-- Дашборд: записи Фулфилмента (начислено и оплачено вручную) и история выплат за прошлый год для подписи под выводом.

create table if not exists public.ff_ledger (
    id          uuid primary key default gen_random_uuid(),
    cabinet_id  uuid not null,
    ff_name     text not null default '',
    kind        text not null check (kind in ('charge', 'payment')),
    title       text not null default '',
    boxes       integer,
    amount      numeric(14, 2) not null check (amount >= 0),
    entry_date  date not null default current_date,
    created_by  uuid default auth.uid(),
    created_at  timestamptz not null default now()
);
create index if not exists ff_ledger_cab_idx on public.ff_ledger (cabinet_id, entry_date desc);
alter table public.ff_ledger enable row level security;
drop policy if exists ff_ledger_sel on public.ff_ledger;
drop policy if exists ff_ledger_ins on public.ff_ledger;
drop policy if exists ff_ledger_upd on public.ff_ledger;
drop policy if exists ff_ledger_del on public.ff_ledger;
create policy ff_ledger_sel on public.ff_ledger for select to authenticated using (cabinet_id in (select current_user_view_cabinet_ids()));
create policy ff_ledger_ins on public.ff_ledger for insert to authenticated with check (cabinet_id in (select current_user_cabinet_ids()));
create policy ff_ledger_upd on public.ff_ledger for update to authenticated using (cabinet_id in (select current_user_cabinet_ids())) with check (cabinet_id in (select current_user_cabinet_ids()));
create policy ff_ledger_del on public.ff_ledger for delete to authenticated using (cabinet_id in (select current_user_cabinet_ids()));
revoke all on public.ff_ledger from anon;

-- Выплаты по неделям (сумма «к выводу»), без сырых строк отчёта: хранится одна строка в неделю на кабинет.
create table if not exists public.payout_history (
    cabinet_id  uuid not null,
    week_start  date not null,
    week_end    date not null,
    pay_date    date not null,
    to_withdraw numeric(14, 2) not null,
    source      text not null default 'wb',
    updated_at  timestamptz not null default now(),
    primary key (cabinet_id, week_start)
);
alter table public.payout_history enable row level security;
drop policy if exists payout_history_sel on public.payout_history;
create policy payout_history_sel on public.payout_history for select to authenticated using (cabinet_id in (select current_user_view_cabinet_ids()));
revoke all on public.payout_history from anon;
revoke insert, update, delete on public.payout_history from authenticated;
