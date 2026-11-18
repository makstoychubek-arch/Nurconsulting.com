-- «Сравнение контента → Медиа»: задачи генерации кадров. Одна задача = одна расцветка (артикул) за 1 000 сом.
-- Пишет только функция content-media (service role); читать могут те, кто видит кабинет.
create table if not exists public.content_media_jobs (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    nm_id bigint not null,
    status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'generating', 'ready', 'failed', 'sent')),
    price_som integer not null default 1000,
    focus text,
    slides jsonb not null default '[]'::jsonb,
    provider text,
    error text,
    created_by uuid,
    paid_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create unique index if not exists content_media_jobs_one_active on public.content_media_jobs (cabinet_id, nm_id) where status in ('awaiting_payment', 'paid', 'generating', 'ready');
create index if not exists content_media_jobs_cab on public.content_media_jobs (cabinet_id, updated_at desc);
alter table public.content_media_jobs enable row level security;
drop policy if exists content_media_jobs_sel on public.content_media_jobs;
create policy content_media_jobs_sel on public.content_media_jobs for select to authenticated using (public.can_view_cabinet(cabinet_id));

-- Хранилище готовых кадров (публичное чтение: картинки показываются на сайте и забираются WB по ссылке)
insert into storage.buckets (id, name, public) values ('content-media', 'content-media', true) on conflict (id) do nothing;
