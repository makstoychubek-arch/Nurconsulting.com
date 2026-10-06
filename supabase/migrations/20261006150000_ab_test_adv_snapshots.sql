-- ============================================================
-- А/Б-тест: замеры накопленной статистики РК раз в 10 минут.
--
-- Проблема: показы и клики варианта считались из advertising_daily_stats. Эта таблица
-- обновляется раз в 6 часов и хранит итоги ЗА ДЕНЬ (WB отдаёт по дню, без часов), а код делил
-- суточный итог между вариантами пропорционально времени. В итоге в отчёте оказывались
-- утренние показы за время ДО старта теста.
--
-- Решение: ab-test-rotate каждые 10 минут снимает у WB накопленные за сегодня показы, клики,
-- корзины, заказы и расход по товару теста и кладёт сюда. Показы окна варианта = разница между
-- замерами на его границах. Данные пишет только edge-функция (service role).
-- Safe to re-run.
-- ============================================================

create table if not exists public.ab_test_adv_snapshots (
    id          uuid primary key default gen_random_uuid(),
    test_id     uuid not null references public.ab_tests(id) on delete cascade,
    cabinet_id  uuid not null,
    campaign_id bigint not null,
    nm_id       bigint not null,
    taken_at    timestamptz not null default now(),
    stat_date   date not null,         -- день WB (Москва), к которому относятся накопленные числа
    views       integer not null default 0,
    clicks      integer not null default 0,
    atbs        integer not null default 0,
    orders      integer not null default 0,
    spend       numeric(12, 2) not null default 0
);

comment on table public.ab_test_adv_snapshots is
    'Замеры накопленной за день статистики РК по товару А/Б-теста (раз в 10 минут). Показы окна = разница замеров.';

create index if not exists ab_test_adv_snapshots_test_time_idx
    on public.ab_test_adv_snapshots (test_id, campaign_id, taken_at);

alter table public.ab_test_adv_snapshots enable row level security;

drop policy if exists "cabinet_read" on public.ab_test_adv_snapshots;
create policy "cabinet_read" on public.ab_test_adv_snapshots
    for select to authenticated
    using (test_id in (
        select id from public.ab_tests
        where cabinet_id in (select public.current_user_cabinet_ids())
    ));

revoke all on public.ab_test_adv_snapshots from anon;
revoke insert, update, delete on public.ab_test_adv_snapshots from authenticated;
grant select on public.ab_test_adv_snapshots to authenticated;
