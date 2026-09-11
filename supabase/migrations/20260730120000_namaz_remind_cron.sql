-- Namaz bot (Карина): состояние отправленных напоминаний + pg_cron каждую минуту.
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role
-- из Dashboard → Settings → API.

create table if not exists public.namaz_bot_events (
    event_key   text primary key,
    payload     jsonb,
    sent_at     timestamptz not null default now()
);

alter table public.namaz_bot_events enable row level security;

-- Только service_role (edge function); клиентам доступ не нужен.
drop policy if exists "namaz_bot_events_deny_all" on public.namaz_bot_events;
create policy "namaz_bot_events_deny_all" on public.namaz_bot_events
    for all using (false) with check (false);

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'namaz-remind-bishkek'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'namaz-remind-bishkek',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/namaz-remind',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
