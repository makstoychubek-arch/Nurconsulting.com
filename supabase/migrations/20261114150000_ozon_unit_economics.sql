-- Юнит-экономика Ozon «точно»: настоящие расходы из финотчёта Ozon (cash-flow по полумесяцам: комиссия, логистика, возвраты,
-- эквайринг, услуги) делятся на артикулы без размера: комиссия по ставке товара (сведена с итогом отчёта), логистика по объёму товара,
-- остальное по выручке. Реклама Ozon (за заказ, за клик) в расчёт не входит, как и у WB. Итоги по кабинету совпадают с финотчётом Ozon.

create table if not exists public.ozon_cashflow (
    cabinet_id uuid not null,
    period_begin date not null,
    period_end date not null,
    summary jsonb not null,
    detail jsonb not null,
    synced_at timestamptz not null default now(),
    primary key (cabinet_id, period_begin)
);
alter table public.ozon_cashflow enable row level security;
drop policy if exists ozon_cashflow_read on public.ozon_cashflow;
create policy ozon_cashflow_read on public.ozon_cashflow for select using (public.can_view_cabinet(cabinet_id::text));

create or replace function public.ozon_unit_rows(p_cabinet uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
    res jsonb;
begin
    if not public.can_view_cabinet(p_cabinet::text) then return '[]'::jsonb; end if;
    with cf as (
        -- периоды отчёта, пересекающие окно; доля периода = дни пересечения / дни периода
        select c.*, greatest(0, least(c.period_end - 1, p_to) - greatest(c.period_begin, p_from) + 1)::numeric / greatest(1, c.period_end - c.period_begin) w
        from public.ozon_cashflow c where c.cabinet_id = p_cabinet and c.period_begin <= p_to and c.period_end > p_from
    ),
    pool as (
        select
            sum(w * (summary->>'orders_amount')::numeric) orders,
            sum(w * abs((summary->>'commission_amount')::numeric)) comm,
            sum(w * abs(coalesce((summary->>'returns_amount')::numeric, 0))) retmoney,
            sum(w * abs(coalesce((detail->'delivery'->'delivery_services'->>'total')::numeric, 0)) + w * abs(coalesce((detail->'return'->'return_services'->>'total')::numeric, 0))) logi,
            -- эквайринг: строки с Acquiring в «прочем» и в услугах (расход положительным)
            sum(w * (select coalesce(sum(abs((i->>'price')::numeric)), 0) from (select jsonb_array_elements(coalesce(detail->'others'->'items', '[]'::jsonb)) i union all select jsonb_array_elements(coalesce(detail->'services'->'items', '[]'::jsonb))) x(i) where i->>'name' ilike '%Acquiring%' and (i->>'price')::numeric < 0)) acq,
            sum(w * (select coalesce(sum(abs((i->>'price')::numeric)), 0) from jsonb_array_elements(coalesce(detail->'services'->'items', '[]'::jsonb)) i where i->>'name' ilike '%Storage%' and (i->>'price')::numeric < 0)) stor,
            -- прочие услуги по итогу финотчёта (services_amount учитывает и приходы Ozon): без рекламы, хранения и эквайринга
            sum(w * (-(summary->>'services_amount')::numeric
                     - (select coalesce(sum(abs((i->>'price')::numeric)), 0) from jsonb_array_elements(coalesce(detail->'services'->'items', '[]'::jsonb)) i
                        where (i->>'name' ilike '%Promotion%' or i->>'name' ilike '%CostPerClick%' or i->>'name' ilike '%CostPerOrder%' or i->>'name' ilike '%Storage%' or i->>'name' ilike '%Acquiring%') and (i->>'price')::numeric < 0))) svc
        from cf
    ),
    items as (
        select public.ozon_base_offer(i.item->>'offer_id') base, coalesce((i.item->>'quantity')::int, 1) q,
               coalesce(case when jsonb_typeof(i.item->'price') = 'object' then (i.item->'price'->>'amount')::numeric else (i.item->>'price')::numeric end, 0) price
        from public.ozon_postings o cross join lateral (select jsonb_array_elements(o.items) item) i
        where o.cabinet_id::text = p_cabinet::text and o.status <> 'cancelled' and o.created_at::date between p_from and p_to
    ),
    sold as (select base, sum(q) n, sum(q * price) ss from items group by base),
    prod as (
        select public.ozon_base_offer(offer_id) base, min(name) title, avg(commission_fbo_pct) comm_pct, avg(coalesce(volume_weight, 1)) vw,
               (array_agg(image_url order by offer_id) filter (where image_url is not null))[1] img
        from public.ozon_products where cabinet_id::text = p_cabinet::text group by 1
    ),
    j as (select s.base, s.n, s.ss, p.title, p.img, coalesce(p.comm_pct, 21) comm_pct, coalesce(p.vw, 1) vw from sold s left join prod p on p.base = s.base),
    tot as (
        select sum(ss) ss, sum(n * vw) nvw, sum(ss * comm_pct / 100.0) comm_est from j
    ),
    rate as (
        select
            case when pool.orders > 0 then pool.comm / pool.orders else null end comm_rate,
            case when pool.orders > 0 then pool.retmoney / pool.orders else 0 end ret_rate,
            case when pool.orders > 0 then pool.logi / pool.orders else 0 end logi_rate,
            case when pool.orders > 0 then pool.acq / pool.orders else 0 end acq_rate,
            case when pool.orders > 0 then pool.stor / pool.orders else 0 end stor_rate,
            case when pool.orders > 0 then pool.svc / pool.orders else 0 end svc_rate
        from pool
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'nm_id', public.ozon_pseudo_nm(j.base), 'name', j.base, 'card_title', j.title, 'subject_name', j.title, 'photo_url', j.img,
        'n', round(j.n), 'r', round(j.n * rate.ret_rate),
        'ss', round(j.ss, 2),
        'cm', round(j.ss * (case when rate.comm_rate is not null and tot.comm_est > 0 then j.comm_pct * (rate.comm_rate * tot.ss / tot.comm_est) else j.comm_pct end), 2),
        'tt', round(j.ss * (1 - (case when rate.comm_rate is not null and tot.comm_est > 0 then (j.comm_pct / 100.0) * (rate.comm_rate * tot.ss / tot.comm_est) else j.comm_pct / 100.0 end) - rate.acq_rate - rate.ret_rate), 2),
        'dl', round(case when tot.nvw > 0 then rate.logi_rate * tot.ss * (j.n * j.vw) / tot.nvw else 0 end, 2),
        'st', round(j.ss * rate.stor_rate, 2),
        'pn', round(j.ss * rate.svc_rate, 2)
    ) order by j.ss desc), '[]'::jsonb) into res
    from j, tot, rate;
    return res;
end;
$$;
grant execute on function public.ozon_unit_rows(uuid, date, date) to authenticated;

-- Финотчёт Ozon обновляется раз в 6 часов (расшифровка по полумесяцам для юнит-экономики)
select cron.schedule('ozon-sync-finance-6h', '27 */6 * * *',
  replace(replace((select command from cron.job where jobname = 'orders-rescan-10m'),
    '/functions/v1/orders-rescan', '/functions/v1/ozon-sync'),
    'body := ''{}''::jsonb', 'body := ''{"parts":["finance"],"days":60}''::jsonb'));
