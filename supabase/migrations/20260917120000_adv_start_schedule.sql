-- Отложенный запуск РК: полки отмечают на сайте, ставят время —
-- крон adv-start-schedule в этот момент вызывает GET /adv/v0/start.
-- Сама миграция кампании не стартует. Bearer копируется с рабочего cron.

create table if not exists public.adv_start_schedule (
    id             uuid primary key default gen_random_uuid(),
    cabinet_id     uuid not null references public.cabinets(id) on delete cascade,
    campaign_id    bigint not null,
    campaign_name  text,
    start_at       timestamptz not null,
    status         text not null default 'pending'
                   check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
    error_text     text,
    created_by     uuid default auth.uid(),
    created_at     timestamptz not null default now(),
    started_at     timestamptz,
    finished_at    timestamptz
);

create index if not exists adv_start_schedule_due_idx
    on public.adv_start_schedule (status, start_at);

create unique index if not exists adv_start_schedule_one_pending
    on public.adv_start_schedule (cabinet_id, campaign_id)
    where status = 'pending';

comment on table public.adv_start_schedule is
    'One-shot WB campaign start at start_at. Insert is pending only; cron adv-start-schedule fires GET /adv/v0/start.';

alter table public.adv_start_schedule enable row level security;

drop policy if exists adv_start_schedule_select on public.adv_start_schedule;
drop policy if exists adv_start_schedule_insert on public.adv_start_schedule;
drop policy if exists adv_start_schedule_update on public.adv_start_schedule;

create policy adv_start_schedule_select on public.adv_start_schedule
    for select
    using (cabinet_id in (select public.current_user_cabinet_ids()));

create policy adv_start_schedule_insert on public.adv_start_schedule
    for insert
    with check (
        cabinet_id in (select public.current_user_cabinet_ids())
        and status = 'pending'
    );

-- Клиент может только сдвинуть время или отменить ещё не взятый тиком ряд.
create policy adv_start_schedule_update on public.adv_start_schedule
    for update
    using (
        cabinet_id in (select public.current_user_cabinet_ids())
        and status = 'pending'
    )
    with check (
        cabinet_id in (select public.current_user_cabinet_ids())
        and status in ('pending', 'cancelled')
    );

grant select, insert, update on public.adv_start_schedule to authenticated;
grant all on public.adv_start_schedule to service_role;

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
      'sync_campaigns',
      'autobidder_tick',
      'rnp-morning-zevina-06-bishkek'
    )
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'adv_start_schedule: нет Bearer у существующих cron — пропускаю schedule';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  for jid in select jobid from cron.job where jobname = 'adv_start_schedule'
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'adv_start_schedule',
    '* * * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/adv-start-schedule',
        headers := %L::jsonb,
        body    := '{}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'adv_start_schedule ready' as status;
