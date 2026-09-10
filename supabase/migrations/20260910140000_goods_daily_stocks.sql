-- Остатки по дням: снимок FBO+FBS один раз на дату, дальше не меняется.
-- В путь WB / in_way_* сюда не входят — только quantity со складов.

create table if not exists public.goods_daily_stocks (
    id          bigint generated always as identity primary key,
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    nm_id       bigint not null,
    date        date not null,
    qty         int not null default 0,
    fbo         int not null default 0,
    fbs         int not null default 0,
    created_at  timestamptz not null default now(),
    unique (cabinet_id, nm_id, date)
);

create index if not exists goods_daily_stocks_cab_date_idx
    on public.goods_daily_stocks (cabinet_id, date);

create index if not exists goods_daily_stocks_cab_nm_idx
    on public.goods_daily_stocks (cabinet_id, nm_id);

comment on table public.goods_daily_stocks is
    'Write-once daily warehouse stock (FBO+FBS). No WB in-way. Inserts never update.';

alter table public.goods_daily_stocks enable row level security;

drop policy if exists goods_daily_stocks_select on public.goods_daily_stocks;
create policy goods_daily_stocks_select on public.goods_daily_stocks
    for select to authenticated
    using (public.can_access_cabinet(cabinet_id));

-- Нет политик INSERT/UPDATE/DELETE: пишет только security definer RPC.
-- delete_cabinet и ON DELETE CASCADE снимают строки при удалении кабинета.

create or replace function public.goods_daily_stocks_no_update()
returns trigger
language plpgsql
as $$
begin
    raise exception 'goods_daily_stocks is write-once and cannot be updated';
end;
$$;

drop trigger if exists goods_daily_stocks_no_update on public.goods_daily_stocks;
create trigger goods_daily_stocks_no_update
    before update on public.goods_daily_stocks
    for each row execute function public.goods_daily_stocks_no_update();

create or replace function public.snapshot_goods_daily_stocks(
    p_date date default null,
    p_cabinet_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    d date;
    n int;
    v_all boolean;
begin
    d := coalesce(p_date, (timezone('Asia/Bishkek', now()))::date);
    -- JWT пользователя: только свои кабинеты.
    -- service_role / SQL-консоль (uid пустой): все кабинеты.
    v_all := auth.uid() is null;

    if p_cabinet_id is not null and not v_all and not public.can_access_cabinet(p_cabinet_id) then
        raise exception 'нет доступа к кабинету';
    end if;

    with cabs as (
        select c.id
        from public.cabinets c
        where (p_cabinet_id is null or c.id = p_cabinet_id)
          and (v_all or public.can_access_cabinet(c.id))
    ),
    qty as (
        select
            s.cabinet_id,
            s.nm_id,
            coalesce(sum(s.quantity), 0)::int as qty,
            coalesce(sum(case
                when lower(coalesce(s.stock_scheme, 'fbo')) = 'fbs' then s.quantity
                else 0
            end), 0)::int as fbs,
            coalesce(sum(case
                when lower(coalesce(s.stock_scheme, 'fbo')) = 'fbs' then 0
                else s.quantity
            end), 0)::int as fbo
        from public.wb_stocks s
        join cabs x on x.id = s.cabinet_id
        where s.nm_id is not null
        group by s.cabinet_id, s.nm_id
    ),
    nms as (
        select cabinet_id, nm_id from qty
        union
        select a.cabinet_id::uuid, a.nm_id
        from public.rnp_articles a
        join cabs x on x.id::text = a.cabinet_id
        where a.nm_id is not null
          and a.cabinet_id ~ '^[0-9a-fA-F-]{36}$'
    )
    insert into public.goods_daily_stocks (cabinet_id, nm_id, date, qty, fbo, fbs)
    select
        n.cabinet_id,
        n.nm_id,
        d,
        coalesce(q.qty, 0),
        coalesce(q.fbo, 0),
        coalesce(q.fbs, 0)
    from nms n
    left join qty q on q.cabinet_id = n.cabinet_id and q.nm_id = n.nm_id
    on conflict (cabinet_id, nm_id, date) do nothing;

    get diagnostics n = row_count;
    return jsonb_build_object('date', d, 'inserted', n);
end;
$$;

revoke all on function public.snapshot_goods_daily_stocks(date, uuid) from public;
grant execute on function public.snapshot_goods_daily_stocks(date, uuid) to authenticated;
grant execute on function public.snapshot_goods_daily_stocks(date, uuid) to service_role;

comment on function public.snapshot_goods_daily_stocks(date, uuid) is
    'Пишет FBO+FBS на дату. Повторный вызов ту же дату не меняет (ON CONFLICT DO NOTHING).';

create or replace function public.delete_cabinet(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if cid is null then
        raise exception 'cabinet id required';
    end if;
    if not public.can_access_cabinet(cid) then
        raise exception 'нет доступа к кабинету';
    end if;

    update public.cabinets
        set wb_token = null,
            wb_content_token = null,
            wb_token_analytics = null,
            wb_token_promotion = null,
            ozon_client_id = null,
            ozon_api_key = null
        where id = cid;

    delete from public.rnp_daily_data where cabinet_id = cid::text;
    delete from public.rnp_date_notes where cabinet_id = cid::text;
    delete from public.rnp_articles where cabinet_id = cid::text;
    delete from public.rnp_settings where cabinet_id = cid::text;
    delete from public.goods_daily_stocks where cabinet_id = cid;

    delete from public.cabinets where id = cid;
end;
$$;

revoke all on function public.delete_cabinet(uuid) from public;
grant execute on function public.delete_cabinet(uuid) to authenticated;
