-- ============================================================
-- Очередь загрузки истории из WB (финотчёт + платное хранение → РНП).
--
-- Зачем: у большого кабинета (например ИП Уркунбаев: 170+ артикулов, ~330 тыс.
-- строк финотчёта и ~1,5 млн строк хранения за 9 месяцев) история грузится часами:
-- WB отдаёт финотчёт и создание задач хранения не чаще 1 запроса в минуту на токен,
-- а одна Edge-функция живёт 2–7 минут. Одним запросом это не загрузить.
--
-- Как работает:
--   * request_backfill() — владелец кабинета (или команда) просит загрузить историю;
--     планировщик режет её на окна по 8 дней (лимит окна хранения у WB), новые даты
--     идут первыми, чтобы РНП быстро показал свежие дни.
--   * Edge-функция sync-queue-tick раз в минуту берёт по одной задаче на кабинет
--     (claim_sync_jobs), вызывает rnp-finance-sync и записывает результат.
--   * sync_progress() — готовые проценты и «осталось примерно N мин» для экрана.
-- Клиент ничего не пишет в очередь напрямую: только читает свою и просит запуск.
-- Safe to re-run.
-- ============================================================

create table if not exists public.sync_jobs (
    id           uuid primary key default gen_random_uuid(),
    cabinet_id   uuid not null references public.cabinets(id) on delete cascade,
    period_from  date not null,
    period_to    date not null,
    status       text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
    phase        text not null default 'sync' check (phase in ('sync', 'storage_status')),
    priority     int  not null default 0,
    attempts     int  not null default 0,
    next_run_at  timestamptz not null default now(),
    claimed_at   timestamptz,
    started_at   timestamptz,
    finished_at  timestamptz,
    rows         int  not null default 0,
    error        text,                       -- техническая причина, клиенту не показываем
    created_at   timestamptz not null default now(),
    unique (cabinet_id, period_from, period_to)
);

create index if not exists sync_jobs_pick_idx on public.sync_jobs (status, next_run_at, priority);
create index if not exists sync_jobs_cabinet_idx on public.sync_jobs (cabinet_id, status);

alter table public.sync_jobs enable row level security;

drop policy if exists "sync_jobs_read_own" on public.sync_jobs;
create policy "sync_jobs_read_own" on public.sync_jobs
    for select to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()));

-- Записывает только сервер (service role) и функции ниже.
revoke all on public.sync_jobs from anon, authenticated;
grant select on public.sync_jobs to authenticated;

-- ── Планировщик: окна по 8 дней, свежие первыми ───────────────────────────
create or replace function public.plan_cabinet_backfill(p_cabinet uuid, p_days int default 90)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_days   int := least(greatest(coalesce(p_days, 90), 8), 400);
    v_today  date := (now() at time zone 'utc')::date;
    v_to     date;
    v_from   date;
    i        int := 0;
    v_made   int := 0;
    v_fin    record;
    v_sto    record;
begin
    loop
        v_to := v_today - (i * 8);
        v_from := v_to - 7;
        exit when v_to < v_today - v_days;

        select status, rows into v_fin from public.rnp_sync_state
            where cabinet_id::text = p_cabinet::text and source = 'finance' and period_from = v_from and period_to = v_to;
        select status, rows into v_sto from public.rnp_sync_state
            where cabinet_id::text = p_cabinet::text and source = 'storage' and period_from = v_from and period_to = v_to;

        if v_fin.status = 'done' and v_sto.status = 'done' then
            -- Окно уже загружено раньше — отмечаем готовым, чтобы проценты считались честно.
            insert into public.sync_jobs (cabinet_id, period_from, period_to, status, priority, rows, started_at, finished_at)
            values (p_cabinet, v_from, v_to, 'done', i, coalesce(v_fin.rows, 0) + coalesce(v_sto.rows, 0), now(), now())
            on conflict (cabinet_id, period_from, period_to) do nothing;
        else
            insert into public.sync_jobs (cabinet_id, period_from, period_to, status, priority)
            values (p_cabinet, v_from, v_to, 'queued', i)
            on conflict (cabinet_id, period_from, period_to) do nothing;
        end if;
        if found then v_made := v_made + 1; end if;
        i := i + 1;
    end loop;
    return v_made;
end;
$$;

-- ── Воркер берёт задачи: не больше одной на кабинет ───────────────────────
create or replace function public.claim_sync_jobs(p_limit int default 2)
returns setof public.sync_jobs
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    return query
    update public.sync_jobs s
       set status = 'running',
           claimed_at = now(),
           started_at = coalesce(s.started_at, now()),
           attempts = s.attempts + 1
     where s.id in (
            select x.id from (
                select distinct on (j.cabinet_id) j.id, j.priority, j.created_at
                  from public.sync_jobs j
                 where (j.status = 'queued' or (j.status = 'running' and j.claimed_at <= now() - interval '8 minutes'))
                   and j.next_run_at <= now()
                   and j.cabinet_id not in (
                        select b.cabinet_id from public.sync_jobs b
                         where b.status = 'running' and b.claimed_at > now() - interval '8 minutes')
                 order by j.cabinet_id, j.priority, j.created_at
            ) x
            order by x.priority, x.created_at
            limit greatest(coalesce(p_limit, 2), 1)
       )
       and (s.status = 'queued' or (s.status = 'running' and s.claimed_at <= now() - interval '8 minutes'))
    returning s.*;
end;
$$;

-- ── Прогресс для экрана ───────────────────────────────────────────────────
create or replace function public.sync_progress(p_cabinet uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
    v_total   int;
    v_done    int;
    v_err     int;
    v_active  int;
    v_avg     numeric;
    v_state   text;
    v_has     boolean;
begin
    if not (p_cabinet in (select public.current_user_cabinet_ids())) and auth.role() <> 'service_role' then
        return jsonb_build_object('state', 'forbidden');
    end if;

    select count(*),
           count(*) filter (where status = 'done'),
           count(*) filter (where status = 'error'),
           count(*) filter (where status in ('queued', 'running'))
      into v_total, v_done, v_err, v_active
      from public.sync_jobs where cabinet_id = p_cabinet;

    select avg(extract(epoch from (finished_at - started_at)))
      into v_avg
      from public.sync_jobs
     where cabinet_id = p_cabinet and status = 'done' and finished_at - started_at > interval '5 seconds';

    select exists (select 1 from public.rnp_daily_data where cabinet_id::text = p_cabinet::text) into v_has;

    v_state := case
        when v_total = 0 then 'none'
        when v_active > 0 then 'running'
        when v_err > 0 then 'error'
        else 'done'
    end;

    return jsonb_build_object(
        'state', v_state,
        'total', v_total,
        'done', v_done,
        'errors', v_err,
        'percent', case when v_total = 0 then 0 else floor(v_done * 100.0 / v_total)::int end,
        -- Среднее по уже готовым окнам; пока их нет — 4 минуты на окно.
        'eta_minutes', case when v_active = 0 then 0 else ceil(v_active * coalesce(v_avg, 240) / 60.0)::int end,
        'has_data', v_has
    );
end;
$$;

-- ── Запрос загрузки от владельца ──────────────────────────────────────────
create or replace function public.request_backfill(p_cabinet uuid, p_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_days int;
begin
    if auth.uid() is null or not (p_cabinet in (select public.current_user_cabinet_ids())) then
        return jsonb_build_object('state', 'forbidden');
    end if;
    if not exists (select 1 from public.cabinets where id = p_cabinet and coalesce(wb_token, '') <> '') then
        return jsonb_build_object('state', 'no_token');
    end if;

    -- Клиент грузит до 90 дней, команда — до 400.
    v_days := case when public.is_super_admin() or public.is_team_member()
                   then least(greatest(coalesce(p_days, 90), 8), 400)
                   else least(greatest(coalesce(p_days, 90), 8), 90) end;

    -- Повторный запрос: окна, что закончились ошибкой, ставим в очередь заново.
    update public.sync_jobs
       set status = 'queued', attempts = 0, next_run_at = now(), error = null, finished_at = null
     where cabinet_id = p_cabinet and status = 'error';

    perform public.plan_cabinet_backfill(p_cabinet, v_days);
    return public.sync_progress(p_cabinet);
end;
$$;

revoke all on function public.plan_cabinet_backfill(uuid, int) from public, anon, authenticated;
revoke all on function public.claim_sync_jobs(int) from public, anon, authenticated;
grant execute on function public.plan_cabinet_backfill(uuid, int) to service_role;
grant execute on function public.claim_sync_jobs(int) to service_role;

revoke all on function public.sync_progress(uuid) from public, anon;
revoke all on function public.request_backfill(uuid, int) from public, anon;
grant execute on function public.sync_progress(uuid) to authenticated, service_role;
grant execute on function public.request_backfill(uuid, int) to authenticated, service_role;
