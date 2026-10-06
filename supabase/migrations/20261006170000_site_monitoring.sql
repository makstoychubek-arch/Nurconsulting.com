-- ============================================================
-- Мониторинг сайта: ошибки из браузера и проверка «сайт жив».
-- Пишет только сервер (edge-функции client-error и site-uptime, service role);
-- читать может супер-админ. Safe to re-run.
-- ============================================================

create table if not exists public.client_errors (
    id           uuid primary key default gen_random_uuid(),
    fingerprint  text not null unique,           -- хэш «страница + сообщение + место», одинаковые ошибки копятся в счётчик
    page         text,
    message      text not null,
    source       text,
    line         integer,
    col          integer,
    stack        text,
    user_agent   text,
    user_id      uuid,
    count        integer not null default 1,
    first_seen   timestamptz not null default now(),
    last_seen    timestamptz not null default now()
);
create index if not exists client_errors_last_seen_idx on public.client_errors (last_seen desc);

create table if not exists public.site_uptime (
    id            integer primary key default 1 check (id = 1),
    status        text not null default 'up' check (status in ('up', 'down')),
    failures      integer not null default 0,    -- подряд неудачных проверок
    since         timestamptz not null default now(),
    last_checked  timestamptz,
    last_alert_at timestamptz,
    details       jsonb not null default '{}'::jsonb
);
insert into public.site_uptime (id) values (1) on conflict (id) do nothing;

alter table public.client_errors enable row level security;
alter table public.site_uptime enable row level security;

drop policy if exists "super_admin_read" on public.client_errors;
create policy "super_admin_read" on public.client_errors for select to authenticated using (public.is_super_admin());
drop policy if exists "super_admin_read" on public.site_uptime;
create policy "super_admin_read" on public.site_uptime for select to authenticated using (public.is_super_admin());

revoke all on public.client_errors, public.site_uptime from anon;

-- Проверка «сайт жив» раз в 5 минут. Функция открыта без ключа и ничего секретного не делает.
select cron.unschedule('site-uptime-5min') where exists (select 1 from cron.job where jobname = 'site-uptime-5min');
select cron.schedule('site-uptime-5min', '*/5 * * * *', $$
    select net.http_post(
        url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/site-uptime',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
$$);
