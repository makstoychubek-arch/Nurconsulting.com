-- Кеш позиций из официального отчёта поисковых запросов WB
-- (POST /api/v2/search-report/product/orders).
--
-- Зачем: отчёт отдаёт 30 фраз за запрос, не чаще 3 запросов в минуту на кабинет
-- и обновляется примерно раз в час. Тик автобиддера ходит каждые 5 минут, то
-- есть без кеша он сжёг бы лимит и получал бы одни и те же цифры.
--
-- Позицию не сканируем из публичной выдачи search.wb.ru: она обрывается на 300
-- товарах, не показывает наши рекламные места и упирается в 429.

create table if not exists public.adv_position_cache (
  campaign_id uuid not null references public.adv_campaigns(id) on delete cascade,
  cluster_key text not null,
  -- Позиция за самый свежий день, где WB её дал, и дата этого дня.
  position int,
  position_date date,
  -- Частота запроса за период: 0 значит, что кластер не ищут.
  frequency int not null default 0,
  orders_in_period int not null default 0,
  fetched_at timestamptz not null default now(),
  primary key (campaign_id, cluster_key)
);

create index if not exists adv_position_cache_fetched_idx
  on public.adv_position_cache (campaign_id, fetched_at desc);

alter table public.adv_position_cache enable row level security;

-- Читать может тот, у кого есть доступ к кабинету кампании.
drop policy if exists adv_position_cache_select on public.adv_position_cache;
create policy adv_position_cache_select on public.adv_position_cache
  for select to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_has_cabinet(c.cabinet_id)
    )
  );

-- Пишет только тик (service_role); владельцу кабинета тоже разрешаем, чтобы
-- ручной прогон из интерфейса не падал на RLS.
drop policy if exists adv_position_cache_write on public.adv_position_cache;
create policy adv_position_cache_write on public.adv_position_cache
  for all to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  )
  with check (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

comment on table public.adv_position_cache is
  'Позиции по кластерам из отчёта поисковых запросов WB. Живёт ~3 часа, см. POSITION_CACHE_TTL_MIN.';
