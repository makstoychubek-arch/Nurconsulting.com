-- Аудит перед запуском.
-- 1) Тарифы ФФ и объединение ФФ меняются одной транзакцией: раньше клиент слал удаление, обновление и вставку
--    отдельными запросами, и сбой посреди операции оставлял кабинет без тарифа.
-- 2) Суточная квота на вызовы OpenAI из генератора каруселей: раньше лимита не было.
-- Функции ff_* работают с правами вызывающего (security invoker): RLS на ff_terms и ff_groups сохраняется.

create or replace function public.ff_terms_apply(
    p_cabinet uuid,
    p_remove  uuid[],
    p_updates jsonb,
    p_inserts jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    if p_cabinet is null then
        raise exception 'cabinet required';
    end if;
    if coalesce(array_length(p_remove, 1), 0) > 0 then
        delete from public.ff_terms where cabinet_id = p_cabinet and id = any(p_remove);
    end if;
    update public.ff_terms t
       set date_to = nullif(u.date_to, '')::date
      from jsonb_to_recordset(coalesce(p_updates, '[]'::jsonb)) as u(id uuid, date_to text)
     where t.id = u.id and t.cabinet_id = p_cabinet;
    insert into public.ff_terms (cabinet_id, ff_name, kind, value, daily_cap, fx_rate, date_from, date_to, storage_mode)
    select p_cabinet, r.ff_name, r.kind, r.value, r.daily_cap, r.fx_rate, r.date_from, r.date_to, coalesce(r.storage_mode, 'unit')
      from jsonb_to_recordset(coalesce(p_inserts, '[]'::jsonb))
        as r(ff_name text, kind text, value numeric, daily_cap numeric, fx_rate numeric, date_from date, date_to date, storage_mode text);
end;
$$;
revoke all on function public.ff_terms_apply(uuid, uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.ff_terms_apply(uuid, uuid[], jsonb, jsonb) to authenticated, service_role;

create or replace function public.ff_merge_member(
    p_cabinet uuid,
    p_member  text,
    p_group   text,
    p_on      boolean
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
    k text;
begin
    if p_cabinet is null or coalesce(p_member, '') = '' then
        raise exception 'cabinet and member required';
    end if;
    if not p_on then
        delete from public.ff_groups where cabinet_id = p_cabinet and ff_name = p_member;
        return;
    end if;
    if coalesce(p_group, '') = '' then
        raise exception 'group required';
    end if;
    insert into public.ff_groups (cabinet_id, ff_name, group_name)
    values (p_cabinet, p_member, p_group)
    on conflict (cabinet_id, ff_name) do update set group_name = excluded.group_name;
    -- тарифы участника: если у группы такой вид уже есть, дубль убираем, иначе переносим группе
    for k in select distinct kind from public.ff_terms where cabinet_id = p_cabinet and ff_name = p_member loop
        if exists (select 1 from public.ff_terms where cabinet_id = p_cabinet and ff_name = p_group and kind = k) then
            delete from public.ff_terms where cabinet_id = p_cabinet and ff_name = p_member and kind = k;
        else
            update public.ff_terms set ff_name = p_group where cabinet_id = p_cabinet and ff_name = p_member and kind = k;
        end if;
    end loop;
end;
$$;
revoke all on function public.ff_merge_member(uuid, text, text, boolean) from public, anon;
grant execute on function public.ff_merge_member(uuid, text, text, boolean) to authenticated, service_role;

-- Квота OpenAI: счётчик вызовов на пользователя в сутки (только service_role).
create table if not exists public.content_ai_usage (
    user_id uuid not null,
    day     date not null default (now() at time zone 'utc')::date,
    calls   int  not null default 0,
    primary key (user_id, day)
);
alter table public.content_ai_usage enable row level security;
revoke all on public.content_ai_usage from anon, authenticated;
grant all on public.content_ai_usage to service_role;

create or replace function public.content_ai_take(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    n int;
begin
    insert into public.content_ai_usage (user_id, day, calls)
    values (p_user, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set calls = public.content_ai_usage.calls + 1
    returning calls into n;
    delete from public.content_ai_usage where day < (now() at time zone 'utc')::date - 14;
    return n <= p_limit;
end;
$$;
revoke all on function public.content_ai_take(uuid, int) from public, anon, authenticated;
grant execute on function public.content_ai_take(uuid, int) to service_role;
