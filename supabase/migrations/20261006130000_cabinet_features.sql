-- ============================================================
-- Тумблеры функций по кабинету: cabinet_features.
--
-- Одна строка = одна функция одного кабинета. Нет строки = функция включена
-- (так ничего не ломается у существующих кабинетов).
--   enabled      — ручной тумблер («до ручного включения» = enabled false);
--   paused_until — временная пауза («Отключить на 1 час / 6 часов / сутки»):
--                  по истечении срока функция сама снова работает, ничего
--                  включать не надо;
--   last_*       — диагностика: когда функция последний раз запускалась,
--                  чем закончилась и что мешало (токен истёк, нет Telegram-чата...).
--
-- Серверные функции читают состояние через public.feature_active() или
-- _shared/cabinet-features.ts. Запись состояния делает edge-функция
-- cabinet-features (service role); клиенту открыто только чтение своих строк.
-- Safe to re-run.
-- ============================================================

create table if not exists public.cabinet_features (
    cabinet_id    uuid not null references public.cabinets(id) on delete cascade,
    feature       text not null,
    enabled       boolean not null default true,
    paused_until  timestamptz,
    last_run_at   timestamptz,
    last_status   text,
    last_error    text,
    updated_by    uuid,
    updated_at    timestamptz not null default now(),
    primary key (cabinet_id, feature),
    constraint cabinet_features_feature_chk check (feature in (
        'reviews',       -- ответы на отзывы (Акылай и командный ответчик)
        'sync',          -- автосинхронизация данных WB
        'ads',           -- РК и автоставки
        'ab_rotation',   -- ротация А/Б-тестов
        'rnp_morning',   -- утреннее заполнение РНП
        'order_alerts'   -- уведомления о заказах
    )),
    constraint cabinet_features_status_chk check (
        last_status is null or last_status in ('ok', 'error', 'skipped')
    )
);

comment on table public.cabinet_features is
    'Тумблеры и диагностика функций по кабинету. Нет строки = функция включена.';

-- Включена ли функция кабинета прямо сейчас.
create or replace function public.feature_active(p_cabinet uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select f.enabled and (f.paused_until is null or f.paused_until <= now())
           from public.cabinet_features f
          where f.cabinet_id = p_cabinet and f.feature = p_feature),
        true
    );
$$;

revoke all on function public.feature_active(uuid, text) from public, anon;
grant execute on function public.feature_active(uuid, text) to authenticated, service_role;

alter table public.cabinet_features enable row level security;

-- Читать свои кабинеты может владелец, команда и супер-админ (как у остальных таблиц кабинета).
drop policy if exists "cabinet_read" on public.cabinet_features;
create policy "cabinet_read" on public.cabinet_features
    for select to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()));

-- Прямой записи с клиента нет: меняет только edge-функция cabinet-features (service role).
revoke all on public.cabinet_features from anon;
revoke insert, update, delete on public.cabinet_features from authenticated;
grant select on public.cabinet_features to authenticated;
