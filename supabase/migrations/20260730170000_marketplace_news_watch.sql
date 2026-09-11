-- Мониторинг новостей WB/Ozon → Telegram «Триггеры» каждые 2 часа.
-- Перед запуском cron подставьте service_role (или используйте SQL API агента).

create table if not exists public.marketplace_news_sent (
    url_key       text primary key,
    url           text,
    title         text,
    market        text,
    published_at  timestamptz,
    sent_at       timestamptz not null default now()
);

create index if not exists marketplace_news_sent_sent_at_idx
    on public.marketplace_news_sent (sent_at desc);

alter table public.marketplace_news_sent enable row level security;

drop policy if exists "marketplace_news_sent_deny_all" on public.marketplace_news_sent;
create policy "marketplace_news_sent_deny_all" on public.marketplace_news_sent
    for all using (false) with check (false);
