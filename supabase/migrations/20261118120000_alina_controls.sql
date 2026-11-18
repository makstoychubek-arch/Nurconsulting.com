-- Управление Алиной с сайта: лимит новых клиентов из настроек (0 = без лимита), учёт расхода ChatGPT, оповещения.
-- Идемпотентно. Без значений в alina_settings поведение прежнее: 30 клиентов за 3 часа.

create or replace function public.alina_admit_chat(p_scope text, p_chat bigint)
returns text
language plpgsql
set search_path = ''
as $function$
declare
    previous_admission timestamptz;
    already_waiting boolean;
    admitted_count integer;
    checked_at timestamptz;
    admit_limit integer;
    admit_hours integer;
begin
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('alina-admissions:' || p_scope, 0)
    );

    select case when pg_catalog.jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric::integer end
        into admit_limit from public.alina_settings where key = 'admitLimit';
    select case when pg_catalog.jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric::integer end
        into admit_hours from public.alina_settings where key = 'admitHours';
    admit_limit := greatest(0, least(100000, coalesce(admit_limit, 30)));
    admit_hours := greatest(1, least(72, coalesce(admit_hours, 3)));

    select admitted_at into previous_admission
    from public.alina_admissions
    where bot_scope = p_scope and chat_id = p_chat;
    already_waiting := found;
    if previous_admission is not null then
        return 'admitted';
    end if;

    checked_at := pg_catalog.clock_timestamp();
    select count(*) into admitted_count
    from public.alina_admissions
    where bot_scope = p_scope and admitted_at > checked_at - pg_catalog.make_interval(hours => admit_hours);

    if admit_limit > 0 and admitted_count >= admit_limit then
        if already_waiting then
            return 'waiting';
        end if;
        insert into public.alina_admissions (bot_scope, chat_id) values (p_scope, p_chat);
        return 'wait_notice';
    end if;

    insert into public.alina_admissions (bot_scope, chat_id, admitted_at)
    values (p_scope, p_chat, checked_at)
    on conflict (bot_scope, chat_id) do update set admitted_at = excluded.admitted_at;
    return 'admitted';
end;
$function$;

-- Расход ChatGPT по дням и моделям (по ответам OpenAI, суммы считаются в долларах по цене модели оценочно).
create table if not exists public.llm_usage (
    day               date not null,
    model             text not null,
    calls             integer not null default 0,
    prompt_tokens     bigint not null default 0,
    completion_tokens bigint not null default 0,
    errors            integer not null default 0,
    last_error        text,
    last_error_at     timestamptz,
    primary key (day, model)
);
alter table public.llm_usage enable row level security;
revoke all on public.llm_usage from public, anon, authenticated;
grant all on public.llm_usage to service_role;

create or replace function public.llm_usage_add(p_model text, p_prompt integer, p_completion integer, p_error text)
returns void
language sql
set search_path = ''
as $$
    insert into public.llm_usage as u (day, model, calls, prompt_tokens, completion_tokens, errors, last_error, last_error_at)
    values ((pg_catalog.now() at time zone 'Europe/Moscow')::date, p_model,
            case when p_error is null then 1 else 0 end, coalesce(p_prompt, 0), coalesce(p_completion, 0),
            case when p_error is null then 0 else 1 end, p_error, case when p_error is null then null else pg_catalog.now() end)
    on conflict (day, model) do update set
        calls = u.calls + case when p_error is null then 1 else 0 end,
        prompt_tokens = u.prompt_tokens + coalesce(p_prompt, 0),
        completion_tokens = u.completion_tokens + coalesce(p_completion, 0),
        errors = u.errors + case when p_error is null then 0 else 1 end,
        last_error = coalesce(p_error, u.last_error),
        last_error_at = case when p_error is null then u.last_error_at else pg_catalog.now() end;
$$;
revoke all on function public.llm_usage_add(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.llm_usage_add(text, integer, integer, text) to service_role;

-- Новые темы оповещений владельцу (включены; пороги задаются на странице оповещений).
insert into public.admin_alert_settings (key, enabled) values
    ('giveaway_sync', true), ('llm', true), ('alina_hook', true)
on conflict (key) do nothing;
