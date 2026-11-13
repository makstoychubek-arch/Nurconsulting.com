-- CRM самовыкупов Алины: лиды + лог сообщений.
-- Google Sheet синхронизируется из edge-функции при наличии секретов.

create table if not exists public.alina_selfbuy_leads (
    id                uuid primary key default gen_random_uuid(),
    telegram_user_id  bigint not null,
    chat_id           bigint not null,
    username          text,
    full_name         text,
    phone             text,
    order_received_at text,          -- когда получат/получили заказ (как сказал клиент)
    review_planned_at text,          -- когда напишет отзыв
    bank_details      text,          -- реквизиты
    status            text not null default 'new',
    -- new | ask_order | ask_review | ask_bank | done | paused
    source_account    text not null default 'main', -- main | second
    sheet_row         int,
    notes             text,
    last_client_text  text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create unique index if not exists alina_selfbuy_leads_user_chat_uidx
    on public.alina_selfbuy_leads (telegram_user_id, chat_id);

create index if not exists alina_selfbuy_leads_status_idx
    on public.alina_selfbuy_leads (status);

create table if not exists public.alina_selfbuy_events (
    id         uuid primary key default gen_random_uuid(),
    lead_id    uuid references public.alina_selfbuy_leads(id) on delete set null,
    chat_id    bigint,
    event_type text not null,
    payload    jsonb,
    created_at timestamptz not null default now()
);

create index if not exists alina_selfbuy_events_created_idx
    on public.alina_selfbuy_events (created_at desc);

alter table public.alina_selfbuy_leads enable row level security;
alter table public.alina_selfbuy_events enable row level security;

-- Алина: бартер / кэшбек — расширенные поля лида + активный оффер (слоты, ключ).

alter table public.alina_selfbuy_leads
  add column if not exists sheet_target text,
  add column if not exists deal_type text,
  add column if not exists keyword text,
  add column if not exists cashback_pct int,
  add column if not exists product_name text,
  add column if not exists order_price text,
  add column if not exists pickup_at text,
  add column if not exists review_note text,
  add column if not exists reels_url text,
  add column if not exists screens_done text default '';

create table if not exists public.alina_campaign (
  id              uuid primary key default gen_random_uuid(),
  is_open         boolean not null default false,
  deal_type       text not null default 'cashback', -- cashback | barter | both
  product_name    text,
  keyword         text,
  cashback_pct    int default 70,
  slots_left      int default 0,
  order_deadline  text,
  notes           text,
  updated_at      timestamptz not null default now()
);

alter table public.alina_campaign enable row level security;

-- Стартовый оффер (закрыт, пока не откроете командой)
insert into public.alina_campaign (is_open, deal_type, product_name, cashback_pct, slots_left)
select false, 'cashback', null, 70, 0
where not exists (select 1 from public.alina_campaign);

-- Таблицы раздач по кабинетам (у каждого кабинета свой Google Sheet).

create table if not exists public.alina_cabinet_sheets (
  id           uuid primary key default gen_random_uuid(),
  cabinet_key  text not null unique,  -- elium | baza | saai | zevina1 ...
  cabinet_name text,
  sheet_id     text not null,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.alina_cabinet_sheets enable row level security;

-- Текущий активный кабинет для ответов клиентам (один «сейчас в раздаче»)
alter table public.alina_campaign
  add column if not exists cabinet_key text,
  add column if not exists sheet_id text;

revoke all on public.alina_selfbuy_leads, public.alina_selfbuy_events,
    public.alina_campaign, public.alina_cabinet_sheets from public, anon, authenticated;
grant all on public.alina_selfbuy_leads, public.alina_selfbuy_events,
    public.alina_campaign, public.alina_cabinet_sheets to service_role;

create unique index if not exists alina_telegram_delivery_uidx
    on public.alina_selfbuy_events ((payload->>'bot_id'), (payload->>'update_id'))
    where event_type = 'telegram_delivery';

insert into public.telegram_bots (id, kind, title, username, token_env, webhook_path, notes)
values
    ('alina', 'agent', 'Алина', 'alinaaaxx_bot', 'ALINA_BOT_TOKEN', 'telegram-router?bot=alina', 'Раздачи и CRM'),
    ('alina2', 'agent', 'Алина (второй)', null, 'ALINA_SECOND_BOT_TOKEN', 'telegram-router?bot=alina2', 'Второй токен CRM')
on conflict (id) do nothing;

update public.telegram_bots
set webhook_path = 'telegram-router?bot=alina2'
where id = 'alina2' and webhook_path = 'telegram-router?bot=alina';
