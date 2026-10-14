-- Замеры скорости страниц у реальных пользователей (без персональных данных). Пишет edge-функция perf-sample.
create table if not exists public.perf_samples (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    page text not null,
    lcp_ms integer,
    fcp_ms integer,
    cls numeric(8, 4),
    load_ms integer,
    ttfb_ms integer,
    mobile boolean not null default false,
    net text
);
create index if not exists perf_samples_created_idx on public.perf_samples (created_at desc);
create index if not exists perf_samples_page_idx on public.perf_samples (page, created_at desc);
alter table public.perf_samples enable row level security;
revoke all on public.perf_samples from anon, authenticated;
