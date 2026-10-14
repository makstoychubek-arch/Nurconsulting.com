-- Собственный календарь публикаций NR Space (@nurcon.kg): не привязан к кабинетам и артикулам WB.
-- Доступ только у супер-админа; публикация идёт через те же функции content-ig-publish / content-publish-tick.
create table if not exists public.nr_content_posts (
    id uuid primary key default gen_random_uuid(),
    platform text not null default 'instagram' check (platform in ('instagram')),
    post_kind text not null default 'feed' check (post_kind in ('feed', 'story')),
    status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'published', 'error')),
    title text,
    caption text,
    file_url text,
    slide_urls jsonb not null default '[]'::jsonb,
    publish_at timestamptz,
    approved_at timestamptz,
    error_text text,
    post_url text,
    ig_media_id text,
    views integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists nr_content_posts_publish_idx on public.nr_content_posts (status, publish_at);

alter table public.nr_content_posts enable row level security;
drop policy if exists nr_content_posts_super on public.nr_content_posts;
create policy nr_content_posts_super on public.nr_content_posts
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());
revoke all on public.nr_content_posts from anon;
grant select, insert, update, delete on public.nr_content_posts to authenticated;
grant all on public.nr_content_posts to service_role;

-- Картинки собственных постов: папка nr/ в том же бакете, писать может только супер-админ.
drop policy if exists content_factory_nr_insert on storage.objects;
create policy content_factory_nr_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'content-factory' and split_part(name, '/', 1) = 'nr' and public.is_super_admin());
drop policy if exists content_factory_nr_update on storage.objects;
create policy content_factory_nr_update on storage.objects
    for update to authenticated
    using (bucket_id = 'content-factory' and split_part(name, '/', 1) = 'nr' and public.is_super_admin());
drop policy if exists content_factory_nr_delete on storage.objects;
create policy content_factory_nr_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'content-factory' and split_part(name, '/', 1) = 'nr' and public.is_super_admin());
