-- ============================================================
-- Sellego feature-parity, Stage 3: белый список / защищённые фразы кластеров
--
-- Метаданные only — эта миграция не пишет ставки и не ходит в WB. Реальный
-- минус-фраз (adv_cluster_minus в wb-proxy) уже существует и работает
-- напрямую с WB; эти две таблицы — просто список фраз, которые:
--   cluster_whitelist          — никогда не предлагать в минус-фразы;
--   cluster_protected_phrases  — то же самое, для фраз, помеченных явно
--                                 "не трогать" (например, бренд-запросы).
-- Разделены на две таблицы, а не одна с флагом, потому что у них разный
-- источник добавления (whitelist — автоматически из "хороших" кластеров,
-- protected — вручную помечает пользователь) и это может понадобиться
-- различать в аналитике позже.
--
-- RLS — тот же паттерн, что и остальные кабинетные таблицы проекта
-- (см. 20260916220000_rls_fast_cabinet_scope.sql), а не v2-схема
-- user_cabinet_access из docs/autobidder.md §11.2 — она ещё не применена
-- к проду (см. README-autobidder.md).
-- ============================================================

create table if not exists public.cluster_whitelist (
    id bigint generated always as identity primary key,
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    campaign_id bigint not null,           -- wb_campaign_id, как в остальном РК-разделе
    phrase text not null,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    unique (cabinet_id, campaign_id, phrase)
);

create table if not exists public.cluster_protected_phrases (
    id bigint generated always as identity primary key,
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    campaign_id bigint not null,
    phrase text not null,
    note text,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    unique (cabinet_id, campaign_id, phrase)
);

create index if not exists cluster_whitelist_lookup on public.cluster_whitelist (cabinet_id, campaign_id);
create index if not exists cluster_protected_phrases_lookup on public.cluster_protected_phrases (cabinet_id, campaign_id);

alter table public.cluster_whitelist enable row level security;
alter table public.cluster_protected_phrases enable row level security;

create policy cabinet_access on public.cluster_whitelist for all
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

create policy cabinet_access on public.cluster_protected_phrases for all
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

select 'cluster_whitelist / cluster_protected_phrases ready' as status;
