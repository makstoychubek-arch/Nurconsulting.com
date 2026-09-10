-- Колонка дня = остаток после закрытия продаж.
-- 03:00 Бишкек = 00:00 МСК следующего дня. Пишем вчера по Москве.
-- Ранний снимок 10.09 (с экрана) снимаем — перепишется в 03:00 11.09.

create or replace function public.snapshot_goods_daily_stocks(
    p_date date default null,
    p_cabinet_id uuid default null,
    p_nm_ids bigint[] default null
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
    v_closed date := (timezone('Europe/Moscow', now()))::date - 1;
    v_start date := date '2026-09-10';
begin
    d := coalesce(p_date, v_closed);
    if d < v_start or d > v_closed then
        return jsonb_build_object('date', d, 'inserted', 0, 'skipped', true, 'closed', v_closed);
    end if;

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
        union
        select x.id, u.nm_id
        from cabs x
        cross join unnest(coalesce(p_nm_ids, '{}'::bigint[])) as u(nm_id)
        where u.nm_id is not null
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
    return jsonb_build_object('date', d, 'inserted', n, 'closed', v_closed);
end;
$$;

comment on function public.snapshot_goods_daily_stocks(date, uuid, bigint[]) is
    'Пишет FBO+FBS за закрытый день продаж (вчера 00:00 МСК = 03:00 Бишкек). Сегодняшний день RPC не пишет.';

delete from public.goods_daily_stocks where date = date '2026-09-10';

do $block$
declare
  tok text;
  hdr jsonb;
  jid bigint;
begin
  select (regexp_match(command, 'Bearer ([A-Za-z0-9._-]+)'))[1]
    into tok
  from cron.job
  where command like '%Bearer%'
    and jobname in (
      'auto-sync-4h',
      'cleanup_snapshots',
      'rnp-morning-zevina-06-bishkek'
    )
  limit 1;

  for jid in select jobid from cron.job
    where jobname in (
      'goods-daily-stocks-11-bishkek',
      'goods-daily-stocks-03-bishkek'
    )
  loop
    perform cron.unschedule(jid);
  end loop;

  if tok is null or length(tok) < 20 then
    raise notice 'goods-daily-eod: нет Bearer — cron не поставил';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  -- 03:00 Бишкек = 00:00 МСК = 21:00 UTC
  perform cron.schedule(
    'goods-daily-stocks-03-bishkek',
    '0 21 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/goods-daily-eod',
        headers := %L::jsonb,
        body    := '{}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'goods-daily-stocks-03-bishkek scheduled at 03:00 Bishkek / 00:00 MSK' as status;
