-- Вопросы WB «когда поступит?»: карточка в Telegram (отзывы) и ответ реплаем.
-- Cron */10. Bearer копируется с рабочего cron, ключ в git не кладём.
-- Notify-бот принимает реплаи через telegram-router?bot=notify.

create table if not exists public.wb_restock_questions (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    question_id text not null,
    nm_id bigint,
    article text,
    product text,
    question_text text,
    telegram_chat_id text,
    telegram_message_id bigint,
    status text not null default 'pending' check (status in ('pending', 'answered', 'skipped', 'failed')),
    when_text text,
    wb_answer text,
    error_text text,
    answered_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (cabinet_id, question_id)
);

create index if not exists wb_restock_questions_status_idx
    on public.wb_restock_questions (status, created_at desc);
create index if not exists wb_restock_questions_tg_idx
    on public.wb_restock_questions (telegram_chat_id, telegram_message_id);

alter table public.wb_restock_questions enable row level security;

drop policy if exists wb_restock_questions_select on public.wb_restock_questions;
create policy wb_restock_questions_select on public.wb_restock_questions
    for select to authenticated
    using (public.can_access_cabinet(cabinet_id));

grant select on public.wb_restock_questions to authenticated;
grant all on public.wb_restock_questions to service_role;

update public.telegram_bots
set webhook_path = 'telegram-router?bot=notify',
    notes = coalesce(nullif(notes, ''), 'Ежедневные отчёты, штрафы, РК, А/Б') || '; реплаи на вопросы о поступлении',
    updated_at = now()
where id = 'notify'
  and (webhook_path is null or webhook_path = '');

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
      'rnp-morning-zevina-06-bishkek',
      'autobidder_tick'
    )
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'wb_restock_poll: нет Bearer у существующих cron — пропускаю schedule';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  for jid in select jobid from cron.job where jobname = 'wb_restock_poll'
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'wb_restock_poll',
    '*/10 * * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/wb-restock-poll',
        headers := %L::jsonb,
        body    := '{}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'wb_restock_questions + cron scheduled' as status;
