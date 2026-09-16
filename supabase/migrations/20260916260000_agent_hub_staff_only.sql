-- ============================================================
-- Хаб агентов — внутренняя страница команды, а не клиента.
--
-- Две проблемы, которые здесь закрываются:
--
-- 1. Миграция 20260914120000_agent_hub.sql до базы не доехала: таблиц
--    whatsapp_agents и agent_brain нет, поэтому вкладка «Агенты» у любого
--    пользователя сыпала 404 в консоль. Создаём их здесь заново.
--
-- 2. Политики на telegram_bots (и предложенные в той миграции политики
--    агент-хаба) пускали к строкам ЛЮБОГО авторизованного. То есть новый
--    клиент видел реестр наших ботов: id, username, имена env-переменных с
--    токенами и заметки по каждому. Читать это должна только команда.
--
-- Safe to re-run.
-- ============================================================

-- Сотрудник = супер-админ или активный team_staff. Отдельная функция нужна,
-- чтобы фронт мог одним RPC узнать, показывать ли внутренние вкладки.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    -- auth.uid() у service_role пустой, поэтому без coalesce получается NULL.
    select coalesce(public.is_super_admin(), false) or coalesce(public.is_team_member(), false);
$$;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_staff() to service_role;

create table if not exists public.whatsapp_agents (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    phone text,
    is_enabled boolean not null default true,
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists public.agent_brain (
    id text primary key,
    provider text not null default 'chatgpt',
    model text not null default 'gpt-4o-mini',
    updated_at timestamptz not null default now()
);

insert into public.agent_brain (id, provider, model)
values ('default', 'chatgpt', 'gpt-4o-mini')
on conflict (id) do nothing;

-- Токены ботов не видит никто из authenticated — только сервисные функции.
create table if not exists public.telegram_bot_secrets (
    bot_id text primary key references public.telegram_bots(id) on delete cascade,
    token text not null,
    updated_at timestamptz not null default now()
);

alter table public.whatsapp_agents enable row level security;
alter table public.agent_brain enable row level security;
alter table public.telegram_bot_secrets enable row level security;

drop policy if exists whatsapp_agents_select on public.whatsapp_agents;
drop policy if exists whatsapp_agents_write on public.whatsapp_agents;
create policy whatsapp_agents_staff on public.whatsapp_agents for all
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists agent_brain_select on public.agent_brain;
drop policy if exists agent_brain_write on public.agent_brain;
create policy agent_brain_staff on public.agent_brain for all
    using (public.is_staff())
    with check (public.is_staff());

-- У telegram_bot_secrets политик нет вообще: с включённым RLS и без grant'ов
-- для authenticated строки доступны только service_role.
drop policy if exists telegram_bot_secrets_select on public.telegram_bot_secrets;
revoke all on public.telegram_bot_secrets from authenticated;

drop policy if exists telegram_bots_select on public.telegram_bots;
create policy telegram_bots_select on public.telegram_bots for select
    using (public.is_staff());

drop policy if exists telegram_bots_write on public.telegram_bots;
create policy telegram_bots_write on public.telegram_bots for all
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- Мьюты каналов остаются per-cabinet (can_access_cabinet), их не трогаем.

grant select, insert, update, delete on public.whatsapp_agents to authenticated;
grant select, insert, update, delete on public.agent_brain to authenticated;
grant select on public.telegram_bots to authenticated;
grant all on public.whatsapp_agents to service_role;
grant all on public.agent_brain to service_role;
grant all on public.telegram_bot_secrets to service_role;
