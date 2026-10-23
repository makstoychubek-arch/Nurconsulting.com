-- Журнал действий администраторов и настройки оповещений владельцу.
-- Журнал пишут триггеры (доступы, сотрудники, кабинеты, токены без значений, функции кабинета) и страница админа.
-- Читать и менять может только супер-админ. Safe to re-run.

create table if not exists public.admin_audit (
    id          bigint generated always as identity primary key,
    at          timestamptz not null default now(),
    actor       uuid,
    actor_email text,
    action      text not null,
    target      text,
    detail      text
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;
drop policy if exists admin_audit_read on public.admin_audit;
create policy admin_audit_read on public.admin_audit for select to authenticated using (public.is_super_admin());
revoke all on public.admin_audit from anon;
grant select on public.admin_audit to authenticated;

-- Запись из страницы админа (например «переподключил бота»).
create or replace function public.admin_log(p_action text, p_target text default null, p_detail text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    insert into public.admin_audit (actor, actor_email, action, target, detail)
    values (auth.uid(), (select email from auth.users where id = auth.uid()), left(p_action, 60), left(p_target, 200), left(p_detail, 500));
end $$;
revoke all on function public.admin_log(text, text, text) from public, anon;
grant execute on function public.admin_log(text, text, text) to authenticated;

-- Триггер: сбой записи в журнал никогда не ломает основное действие.
create or replace function public.admin_audit_trigger() returns trigger language plpgsql security definer set search_path = public as $$
declare a text; t text; d text; uid uuid := auth.uid(); mail text;
begin
    begin
        select email into mail from auth.users where id = uid;
        if tg_table_name = 'cabinet_viewers' then
            if tg_op = 'INSERT' then
                a := 'access_granted'; t := (select name from public.cabinets where id = new.cabinet_id); d := (select email from auth.users where id = new.user_id);
            else
                a := 'access_revoked'; t := (select name from public.cabinets where id = old.cabinet_id); d := (select email from auth.users where id = old.user_id);
            end if;
        elsif tg_table_name = 'team_staff' then
            if tg_op = 'INSERT' then a := 'staff_added'; d := new.email; else a := 'staff_removed'; d := old.email; end if;
        elsif tg_table_name = 'cabinets' then
            if tg_op = 'INSERT' then a := 'cabinet_added'; t := new.name;
            elsif tg_op = 'DELETE' then a := 'cabinet_deleted'; t := old.name;
            elsif new.wb_token is distinct from old.wb_token then a := 'wb_token_changed'; t := new.name;
            elsif new.adv_token_secret_id is distinct from old.adv_token_secret_id then a := 'adv_token_changed'; t := new.name;
            end if;
        elsif tg_table_name = 'cabinet_features' then
            if new.enabled is distinct from old.enabled then
                a := 'feature_toggled'; t := (select name from public.cabinets where id = new.cabinet_id);
                d := new.feature || ': ' || case when new.enabled then 'включена' else 'выключена' end;
            end if;
        end if;
        if a is not null then
            insert into public.admin_audit (actor, actor_email, action, target, detail) values (uid, coalesce(mail, 'система'), a, t, d);
        end if;
    exception when others then
        raise warning 'admin_audit_trigger: %', sqlerrm;
    end;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;

drop trigger if exists admin_audit_viewers on public.cabinet_viewers;
create trigger admin_audit_viewers after insert or delete on public.cabinet_viewers for each row execute function public.admin_audit_trigger();
drop trigger if exists admin_audit_staff on public.team_staff;
create trigger admin_audit_staff after insert or delete on public.team_staff for each row execute function public.admin_audit_trigger();
drop trigger if exists admin_audit_cab_ins on public.cabinets;
create trigger admin_audit_cab_ins after insert or delete on public.cabinets for each row execute function public.admin_audit_trigger();
drop trigger if exists admin_audit_cab_upd on public.cabinets;
create trigger admin_audit_cab_upd after update of wb_token, adv_token_secret_id on public.cabinets for each row execute function public.admin_audit_trigger();
drop trigger if exists admin_audit_features on public.cabinet_features;
create trigger admin_audit_features after update on public.cabinet_features for each row execute function public.admin_audit_trigger();

-- Настройки оповещений владельцу (порог и включено). value/value_at: введённое вручную значение (остаток ИИ).
create table if not exists public.admin_alert_settings (
    key        text primary key,
    enabled    boolean not null default true,
    threshold  numeric,
    value      numeric,
    value_at   timestamptz,
    updated_at timestamptz not null default now()
);
alter table public.admin_alert_settings enable row level security;
drop policy if exists admin_alert_settings_all on public.admin_alert_settings;
create policy admin_alert_settings_all on public.admin_alert_settings for all to authenticated
    using (public.is_super_admin()) with check (public.is_super_admin());
revoke all on public.admin_alert_settings from anon;
insert into public.admin_alert_settings (key, enabled, threshold) values
    ('ai_balance', true, 5), ('tokens', true, null), ('sync', true, 36), ('jobs', true, null),
    ('bots', true, null), ('db_full', true, 80), ('traffic', false, 3), ('access', true, null)
on conflict (key) do nothing;

-- Что уже отправили: чтобы не слать одно и то же каждые 15 минут. Только сервер.
create table if not exists public.admin_alert_state (
    key         text primary key,
    fingerprint text not null default '',
    last_sent   timestamptz
);
alter table public.admin_alert_state enable row level security;
revoke all on public.admin_alert_state from anon, authenticated;

-- Размер базы для проверки «база заполнена» (сервер и супер-админ).
create or replace function public.admin_db_bytes() returns bigint language plpgsql stable security definer set search_path = public as $$
begin
    if auth.uid() is not null and not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    return pg_database_size(current_database());
end $$;
revoke all on function public.admin_db_bytes() from public, anon;
grant execute on function public.admin_db_bytes() to authenticated, service_role;

-- Проверка раз в 15 минут. Функция открыта без ключа и пишет только владельцу в Telegram.
select cron.unschedule('admin-alerts-15min') where exists (select 1 from cron.job where jobname = 'admin-alerts-15min');
select cron.schedule('admin-alerts-15min', '*/15 * * * *', $$
    select net.http_post(
        url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/admin-alerts',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
$$);
