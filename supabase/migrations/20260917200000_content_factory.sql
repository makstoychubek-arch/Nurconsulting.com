-- Контент-завод: календарь публикаций, блогеры/выплаты, слот Instagram Vault.
-- Фото/цена/остатки не дублируются — артикул_id ссылается на rnp_articles.
-- Токен Instagram хранится в Vault (как WB adv_token_secret_id), в таблице только secret_id.

create table if not exists public.bloggers (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    name text not null,
    platforms text[] not null default '{}',
    rate_per_video numeric not null default 0,
    bonus_views_threshold integer not null default 0,
    bonus_amount numeric not null default 0,
    created_at timestamptz not null default now(),
    constraint bloggers_name_len check (char_length(trim(name)) between 1 and 120),
    constraint bloggers_platforms_ok check (
        platforms <@ array['instagram','tiktok','youtube','wibes']::text[]
    )
);

create index if not exists bloggers_cabinet_idx on public.bloggers (cabinet_id);

create table if not exists public.content_posts (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    article_id bigint not null references public.rnp_articles(id) on delete restrict,
    platform text not null
        check (platform in ('instagram', 'tiktok', 'youtube', 'wibes')),
    publish_at timestamptz,
    status text not null default 'draft'
        check (status in ('draft', 'review', 'scheduled', 'published', 'error')),
    blogger_id uuid references public.bloggers(id) on delete set null,
    file_url text,
    post_url text,
    slide_urls jsonb not null default '[]'::jsonb,
    caption text,
    composition_text text,
    brand_name text,
    views integer not null default 0,
    error_text text,
    ig_media_id text,
    approved_at timestamptz,
    approved_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists content_posts_cab_date_idx
    on public.content_posts (cabinet_id, publish_at);
create index if not exists content_posts_cab_status_idx
    on public.content_posts (cabinet_id, status);
create index if not exists content_posts_due_idx
    on public.content_posts (status, publish_at)
    where status = 'scheduled';

comment on table public.content_posts is
    'Календарь публикаций Контент-завода. article_id → rnp_articles, без копии фото/цены.';

create table if not exists public.blogger_payouts (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    blogger_id uuid not null references public.bloggers(id) on delete cascade,
    month date not null,
    post_id uuid references public.content_posts(id) on delete set null,
    actual_views integer not null default 0,
    accrued numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint blogger_payouts_month_first check (date_trunc('month', month::timestamp)::date = month)
);

create unique index if not exists blogger_payouts_one_post
    on public.blogger_payouts (blogger_id, post_id)
    where post_id is not null;
create index if not exists blogger_payouts_cab_month_idx
    on public.blogger_payouts (cabinet_id, month);

create table if not exists public.content_ig_accounts (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null unique references public.cabinets(id) on delete cascade,
    ig_user_id text,
    page_id text,
    ig_username text,
    token_secret_id uuid,
    token_expires_at timestamptz,
    connected_at timestamptz,
    updated_at timestamptz not null default now()
);

comment on column public.content_ig_accounts.token_secret_id is
    'Vault secret_id long-lived Instagram token. Сам токен в таблицу не пишем.';

-- Артикул поста обязан принадлежать тому же кабинету (rnp_articles.cabinet_id — text).
create or replace function public.content_posts_article_cabinet()
returns trigger
language plpgsql
as $$
begin
    if not exists (
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

drop trigger if exists content_posts_article_cabinet_trg on public.content_posts;
create trigger content_posts_article_cabinet_trg
    before insert or update of article_id, cabinet_id
    on public.content_posts
    for each row execute function public.content_posts_article_cabinet();

create or replace function public.compute_blogger_payout_amount(
    p_rate numeric,
    p_views integer,
    p_threshold integer,
    p_bonus numeric
) returns numeric
language sql
immutable
as $$
    select coalesce(p_rate, 0) + case
        when coalesce(p_views, 0) > coalesce(p_threshold, 0) then coalesce(p_bonus, 0)
        else 0
    end;
$$;

create or replace function public.blogger_payouts_accrue()
returns trigger
language plpgsql
as $$
declare
    v_rate numeric;
    v_thr integer;
    v_bonus numeric;
begin
    select rate_per_video, bonus_views_threshold, bonus_amount
      into v_rate, v_thr, v_bonus
    from public.bloggers
    where id = new.blogger_id;

    new.month := date_trunc('month', new.month::timestamp)::date;
    new.accrued := public.compute_blogger_payout_amount(
        v_rate, new.actual_views, v_thr, v_bonus
    );
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists blogger_payouts_accrue_trg on public.blogger_payouts;
create trigger blogger_payouts_accrue_trg
    before insert or update of actual_views, blogger_id, month
    on public.blogger_payouts
    for each row execute function public.blogger_payouts_accrue();

create or replace function public.blogger_payouts_sync_views()
returns trigger
language plpgsql
as $$
begin
    if new.post_id is not null then
        update public.content_posts
           set views = new.actual_views, updated_at = now()
         where id = new.post_id
           and cabinet_id = new.cabinet_id;
    end if;
    return new;
end;
$$;

drop trigger if exists blogger_payouts_sync_views_trg on public.blogger_payouts;
create trigger blogger_payouts_sync_views_trg
    after insert or update of actual_views, post_id
    on public.blogger_payouts
    for each row execute function public.blogger_payouts_sync_views();

alter table public.bloggers enable row level security;
alter table public.content_posts enable row level security;
alter table public.blogger_payouts enable row level security;
alter table public.content_ig_accounts enable row level security;

drop policy if exists bloggers_all on public.bloggers;
create policy bloggers_all on public.bloggers
    for all
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

drop policy if exists content_posts_all on public.content_posts;
create policy content_posts_all on public.content_posts
    for all
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

drop policy if exists blogger_payouts_all on public.blogger_payouts;
create policy blogger_payouts_all on public.blogger_payouts
    for all
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

drop policy if exists content_ig_accounts_all on public.content_ig_accounts;
create policy content_ig_accounts_all on public.content_ig_accounts
    for all
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

grant select, insert, update, delete on public.bloggers to authenticated;
grant select, insert, update, delete on public.content_posts to authenticated;
grant select, insert, update, delete on public.blogger_payouts to authenticated;
grant select, insert, update, delete on public.content_ig_accounts to authenticated;
grant all on public.bloggers to service_role;
grant all on public.content_posts to service_role;
grant all on public.blogger_payouts to service_role;
grant all on public.content_ig_accounts to service_role;
grant execute on function public.compute_blogger_payout_amount(numeric, integer, integer, numeric) to authenticated, service_role;

-- Пишем Instagram-токен только service_role. Чтение — существующий read_adv_vault_secret.
create or replace function public.store_vault_secret(p_name text, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = vault, public
as $$
declare
    sid uuid;
begin
    if p_secret is null or length(trim(p_secret)) < 20 then
        raise exception 'secret too short';
    end if;
    select vault.create_secret(trim(p_secret), left(coalesce(p_name, 'ig-token'), 180), 'instagram graph long-lived token')
      into sid;
    return sid;
end;
$$;

create or replace function public.update_vault_secret(p_id uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = vault, public
as $$
begin
    if p_id is null then
        raise exception 'secret id required';
    end if;
    if p_secret is null or length(trim(p_secret)) < 20 then
        raise exception 'secret too short';
    end if;
    perform vault.update_secret(p_id, trim(p_secret));
end;
$$;

revoke all on function public.store_vault_secret(text, text) from public, anon, authenticated;
revoke all on function public.update_vault_secret(uuid, text) from public, anon, authenticated;
grant execute on function public.store_vault_secret(text, text) to service_role;
grant execute on function public.update_vault_secret(uuid, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'content-factory',
    'content-factory',
    true,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists content_factory_select on storage.objects;
create policy content_factory_select on storage.objects
    for select
    using (bucket_id = 'content-factory');

drop policy if exists content_factory_insert on storage.objects;
create policy content_factory_insert on storage.objects
    for insert
    with check (
        bucket_id = 'content-factory'
        and split_part(name, '/', 1) in (
            select id::text from public.cabinets
            where id in (select public.current_user_cabinet_ids())
        )
    );

drop policy if exists content_factory_update on storage.objects;
create policy content_factory_update on storage.objects
    for update
    using (
        bucket_id = 'content-factory'
        and split_part(name, '/', 1) in (
            select id::text from public.cabinets
            where id in (select public.current_user_cabinet_ids())
        )
    );

drop policy if exists content_factory_delete on storage.objects;
create policy content_factory_delete on storage.objects
    for delete
    using (
        bucket_id = 'content-factory'
        and split_part(name, '/', 1) in (
            select id::text from public.cabinets
            where id in (select public.current_user_cabinet_ids())
        )
    );

-- Крон отложенной публикации Instagram. Само тело {} ничего не публикует,
-- пока нет due-постов со статусом scheduled. Bearer копируется с рабочего cron.
do $block$
declare
    tok text;
    hdr jsonb;
    jid bigint;
begin
    select (regexp_match(command, 'Bearer ([A-Za-z0-9._-]+)'))[1]
      into tok
    from cron.job
    where command like '%Bearer%'
      and jobname in (
        'auto-sync-4h',
        'sync_campaigns',
        'autobidder_tick',
        'adv_start_schedule',
        'rnp-morning-zevina-06-bishkek'
      )
    limit 1;

    if tok is null or length(tok) < 20 then
        raise notice 'content_publish_tick: нет Bearer у существующих cron — пропускаю schedule';
        return;
    end if;

    hdr := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || tok
    );

    for jid in select jobid from cron.job where jobname = 'content_publish_tick'
    loop
        perform cron.unschedule(jid);
    end loop;

    perform cron.schedule(
        'content_publish_tick',
        '*/5 * * * *',
        format($c$
            select net.http_post(
                url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/content-publish-tick',
                headers := %L::jsonb,
                body    := '{}'::jsonb
            );
        $c$, hdr::text)
    );
end
$block$;

select 'content_factory ready' as status;
