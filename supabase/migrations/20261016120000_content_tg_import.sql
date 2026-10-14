-- Импорт постов из Telegram-канала клиента в очередь Контент-завода (фото, текст, альбомы).
-- Видео не импортируем: их публикуют вручную.

-- Пост из Telegram не привязан к артикулу WB.
alter table public.content_posts alter column article_id drop not null;

create or replace function public.content_posts_article_cabinet()
returns trigger
language plpgsql
as $$
begin
    if new.article_id is not null and not exists (
        select 1
        from public.rnp_articles a
        where a.id = new.article_id
          and a.cabinet_id = new.cabinet_id::text
    ) then
        raise exception 'content_posts: артикул не принадлежит кабинету';
    end if;
    new.updated_at := now();
    return new;
end;
$$;

alter table public.content_posts add column if not exists title text;
alter table public.content_posts add column if not exists source text not null default 'manual';
alter table public.content_posts add column if not exists tg_key text;
alter table public.content_posts add column if not exists tg_note text;
alter table public.content_posts drop constraint if exists content_posts_source_ok;
alter table public.content_posts add constraint content_posts_source_ok check (source in ('manual', 'telegram'));
create unique index if not exists content_posts_tg_key_idx on public.content_posts (cabinet_id, tg_key) where tg_key is not null;

-- Какой Telegram-канал кабинета и как его публиковать
create table if not exists public.content_tg_sources (
    cabinet_id uuid primary key references public.cabinets(id) on delete cascade,
    chat_id bigint not null,
    chat_title text,
    chat_username text,
    mode text not null default 'manual' check (mode in ('manual', 'auto')),
    target text not null default 'feed' check (target in ('feed', 'story', 'both')),
    delay_minutes integer not null default 120 check (delay_minutes between 0 and 10080),
    daily_time text,
    take_text boolean not null default true,
    take_albums boolean not null default true,
    strip_links boolean not null default true,
    add_signature boolean not null default true,
    signature text,
    enabled boolean not null default true,
    bot_ok boolean,
    checked_at timestamptz,
    last_post_at timestamptz,
    updated_at timestamptz not null default now()
);
create unique index if not exists content_tg_sources_chat_idx on public.content_tg_sources (chat_id);
alter table public.content_tg_sources enable row level security;
drop policy if exists content_tg_sources_all on public.content_tg_sources;
create policy content_tg_sources_all on public.content_tg_sources
    for all
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
grant select, insert, update, delete on public.content_tg_sources to authenticated;
grant all on public.content_tg_sources to service_role;

-- Бот контента (одна запись): токен в Vault, доступ только через edge-функции
create table if not exists public.content_tg_bot (
    id boolean primary key default true check (id),
    token_secret_id uuid,
    bot_id bigint,
    username text,
    webhook_secret text,
    updated_at timestamptz not null default now()
);
alter table public.content_tg_bot enable row level security;
revoke all on public.content_tg_bot from anon, authenticated;
grant all on public.content_tg_bot to service_role;
