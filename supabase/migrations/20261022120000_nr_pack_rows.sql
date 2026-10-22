-- Общий механизм «упакованной выгрузки»: вместо десятков страничных запросов PostgREST
-- (по 1000 строк, 60 колонок, ключи в каждой строке) клиент забирает кабинет за период
-- ОДНИМ вызовом в компактном виде {cols, rows:[[...]]}, а локальный кэш устройства
-- сверяется с сервером по маленькой «подписи» (количество строк + сумма хэшей).
--
-- Права: security invoker, значит RLS таблицы действует как при обычном select;
-- чужие кабинеты не попадают. Таблицы — только из белого списка ниже.
-- Safe to re-run.

create or replace function public.nr_pack_allowed(p_table text)
returns text
language sql
immutable
as $$
    -- таблица -> колонка даты, по которой режем период ('' = без периода)
    select case p_table
        when 'rnp_daily_data' then 'date'
        when 'rnp_articles' then ''
        when 'wb_stocks' then ''
        else null
    end
$$;

create or replace function public.nr_pack_version(p_table text, p_cab text, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
    dcol text := public.nr_pack_allowed(p_table);
    q text;
    res jsonb;
begin
    if dcol is null then raise exception 'nr_pack: table % is not allowed', p_table; end if;
    q := format('select jsonb_build_object(''n'', count(*), ''h'', coalesce(sum(hashtextextended(t::text, 0)::numeric), 0)::text) from %I t where t.cabinet_id::text = $1', p_table);
    if dcol <> '' and p_from is not null then q := q || format(' and t.%I >= $2', dcol); end if;
    if dcol <> '' and p_to is not null then q := q || format(' and t.%I <= $3', dcol); end if;
    execute q into res using p_cab, p_from, p_to;
    return res;
end
$$;

create or replace function public.nr_pack_rows(p_table text, p_cab text, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
    dcol text := public.nr_pack_allowed(p_table);
    cols text[];
    collist text;
    q text;
    res jsonb;
begin
    if dcol is null then raise exception 'nr_pack: table % is not allowed', p_table; end if;
    select array_agg(a.attname::text order by a.attnum)
      into cols
      from pg_attribute a
     where a.attrelid = ('public.' || quote_ident(p_table))::regclass and a.attnum > 0 and not a.attisdropped;
    select string_agg(format('t.%I', c), ', ') into collist from unnest(cols) c;
    q := format('select jsonb_build_object(''cols'', $4, ''rows'', coalesce(jsonb_agg(jsonb_build_array(%s)), ''[]''::jsonb), ''n'', count(*), ''h'', coalesce(sum(hashtextextended(t::text, 0)::numeric), 0)::text) from %I t where t.cabinet_id::text = $1', collist, p_table);
    if dcol <> '' and p_from is not null then q := q || format(' and t.%I >= $2', dcol); end if;
    if dcol <> '' and p_to is not null then q := q || format(' and t.%I <= $3', dcol); end if;
    execute q into res using p_cab, p_from, p_to, to_jsonb(cols);
    return res;
end
$$;

grant execute on function public.nr_pack_version(text, text, date, date) to authenticated;
grant execute on function public.nr_pack_rows(text, text, date, date) to authenticated;
