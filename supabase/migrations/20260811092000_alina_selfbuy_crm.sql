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

drop policy if exists "alina_selfbuy_leads_deny" on public.alina_selfbuy_leads;
create policy "alina_selfbuy_leads_deny" on public.alina_selfbuy_leads
    for all using (false) with check (false);

drop policy if exists "alina_selfbuy_events_deny" on public.alina_selfbuy_events;
create policy "alina_selfbuy_events_deny" on public.alina_selfbuy_events
    for all using (false) with check (false);
