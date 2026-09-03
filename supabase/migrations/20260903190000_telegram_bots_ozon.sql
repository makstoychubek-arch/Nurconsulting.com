-- Реестр Telegram-ботов, мьюты каналов по кабинету, токены Ozon.

create table if not exists public.telegram_bots (
    id text primary key,
    kind text not null check (kind in ('notify', 'agent', 'utility')),
    title text not null,
    username text,
    token_env text,
    webhook_path text,
    is_enabled boolean not null default true,
    deleted_at timestamptz,
    notes text,
    updated_at timestamptz not null default now()
);

insert into public.telegram_bots (id, kind, title, username, token_env, webhook_path, notes) values
    ('notify', 'notify', 'NR уведомления', null, 'TELEGRAM_BOT_TOKEN', null, 'Ежедневные отчёты, штрафы, РК, А/Б'),
    ('karina', 'agent', 'Карина', null, 'KARINA_BOT_TOKEN', 'telegram-router?bot=karina', 'Координатор команды'),
    ('saule', 'agent', 'Сауле', 'saulexxx_bot', 'SAULE_BOT_TOKEN', 'telegram-router?bot=saule', 'Продажи и цены'),
    ('amina', 'agent', 'Амина', 'aminaakd_bot', 'AMINA_BOT_TOKEN', 'telegram-router?bot=amina', 'Реклама и ставки'),
    ('anton', 'agent', 'Антон', 'antonnnxx_bot', 'ANTON_BOT_TOKEN', 'telegram-router?bot=anton', 'FBS и склады'),
    ('alina', 'agent', 'Алина', 'alinaaaxx_bot', 'ALINA_BOT_TOKEN', 'telegram-router?bot=alina', 'Раздачи и CRM'),
    ('alina2', 'agent', 'Алина (второй)', null, 'ALINA_SECOND_BOT_TOKEN', 'telegram-router?bot=alina', 'Второй токен CRM'),
    ('muha', 'agent', 'Муха', 'muxxxha_bot', 'MUHA_BOT_TOKEN', 'telegram-router?bot=muha', 'Креативы и фото')
on conflict (id) do nothing;

create table if not exists public.telegram_channel_mutes (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    channel text not null,
    muted boolean not null default true,
    updated_at timestamptz not null default now(),
    primary key (cabinet_id, channel)
);

alter table public.cabinets add column if not exists ozon_client_id text;
alter table public.cabinets add column if not exists ozon_api_key text;

alter table public.telegram_bots enable row level security;
alter table public.telegram_channel_mutes enable row level security;

drop policy if exists telegram_bots_select on public.telegram_bots;
create policy telegram_bots_select on public.telegram_bots
    for select using (auth.uid() is not null);

drop policy if exists telegram_bots_write on public.telegram_bots;
create policy telegram_bots_write on public.telegram_bots
    for all using (public.is_super_admin())
    with check (public.is_super_admin());

drop policy if exists telegram_mutes_all on public.telegram_channel_mutes;
create policy telegram_mutes_all on public.telegram_channel_mutes
    for all using (public.can_access_cabinet(cabinet_id))
    with check (public.can_access_cabinet(cabinet_id));

grant select on public.telegram_bots to authenticated;
grant select, insert, update, delete on public.telegram_channel_mutes to authenticated;
grant all on public.telegram_bots to service_role;
grant all on public.telegram_channel_mutes to service_role;
