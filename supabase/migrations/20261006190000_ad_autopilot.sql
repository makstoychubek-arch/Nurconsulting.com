-- ============================================================
-- Автопилот рекламы: сам по крону подгоняет ставки по каждому артикулу под цену заказа.
--
-- Цель по артикулу: цена заказа не выше доли от «предельной» (прибыль на выкуп × доля выкупа)
-- и не выше заданного ДРР. Считает edge-функция ad-autopilot (cron каждые 3 часа), пишет только
-- ставки СРС-кампаний, которые владелец отметил в настройках. Ничего не включает, не выключает и
-- бюджет не пополняет. По умолчанию выключен и в пробном режиме (только журнал, ставки не трогает).
-- Safe to re-run.
-- ============================================================

create table if not exists public.ad_autopilot_settings (
    cabinet_id    uuid primary key references public.cabinets(id) on delete cascade,
    enabled       boolean not null default false,
    dry_run       boolean not null default true,       -- true: только журнал, ставки в WB не меняются
    target_share  numeric not null default 0.7 check (target_share > 0 and target_share <= 1),  -- доля от предельной цены заказа
    max_drr_pct   numeric not null default 15 check (max_drr_pct > 0 and max_drr_pct <= 100),   -- потолок ДРР от заказов
    min_bid_kop   integer not null default 300 check (min_bid_kop >= 100),
    max_bid_kop   integer not null default 1600 check (max_bid_kop >= 100),
    step_pct      integer not null default 10 check (step_pct between 1 and 50),
    min_clicks    integer not null default 60 check (min_clicks >= 10),
    updated_at    timestamptz not null default now()
);

create table if not exists public.ad_autopilot_campaigns (
    cabinet_id    uuid not null references public.cabinets(id) on delete cascade,
    campaign_id   bigint not null,
    primary key (cabinet_id, campaign_id)
);

create table if not exists public.ad_autopilot_log (
    id            bigserial primary key,
    cabinet_id    uuid not null references public.cabinets(id) on delete cascade,
    campaign_id   bigint,
    nm_id         bigint,
    action        text not null,               -- raise / lower / hold / error
    old_bid       integer,
    new_bid       integer,
    reason        text,
    cpo           numeric,
    target_cpo    numeric,
    applied       boolean not null default false,
    created_at    timestamptz not null default now()
);
create index if not exists ad_autopilot_log_cab_idx on public.ad_autopilot_log (cabinet_id, created_at desc);
create index if not exists ad_autopilot_log_nm_idx on public.ad_autopilot_log (cabinet_id, nm_id, created_at desc);

alter table public.ad_autopilot_settings enable row level security;
alter table public.ad_autopilot_campaigns enable row level security;
alter table public.ad_autopilot_log enable row level security;

-- Видеть и менять настройки может тот, у кого есть доступ к кабинету; журнал только читать.
drop policy if exists "cabinet_access" on public.ad_autopilot_settings;
create policy "cabinet_access" on public.ad_autopilot_settings for all to authenticated
    using (public.can_access_cabinet(cabinet_id)) with check (public.can_access_cabinet(cabinet_id));
drop policy if exists "cabinet_access" on public.ad_autopilot_campaigns;
create policy "cabinet_access" on public.ad_autopilot_campaigns for all to authenticated
    using (public.can_access_cabinet(cabinet_id)) with check (public.can_access_cabinet(cabinet_id));
drop policy if exists "cabinet_read" on public.ad_autopilot_log;
create policy "cabinet_read" on public.ad_autopilot_log for select to authenticated
    using (public.can_access_cabinet(cabinet_id));

revoke all on public.ad_autopilot_settings, public.ad_autopilot_campaigns, public.ad_autopilot_log from anon;

-- Cron: прогон каждые 3 часа и суточная сводка в 09:00 по Бишкеку. Команды копируют основное задание штрафов
-- (ключ уже лежит в нём, в репозиторий не кладём).
select cron.unschedule(jobname) from cron.job where jobname in ('ad-autopilot-3h', 'ad-autopilot-report-0900-bishkek');
select cron.schedule('ad-autopilot-3h', '20 */3 * * *', replace(command, 'daily-penalties-report', 'ad-autopilot'))
  from cron.job where jobname = 'daily-penalties-report-07-bishkek';
select cron.schedule('ad-autopilot-report-0900-bishkek', '0 3 * * *',
       replace(replace(command, 'daily-penalties-report', 'ad-autopilot'), '''{}''::jsonb', '''{"action":"report"}''::jsonb'))
  from cron.job where jobname = 'daily-penalties-report-07-bishkek';
