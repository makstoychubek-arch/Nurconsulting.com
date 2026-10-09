-- Отчёты WB, загруженные вручную (раздел «Оцифровка → Отчёты WB»).
-- report_uploads: один файл = одна запись (кабинет + вид отчёта + день + номер склада для ФБС).
-- report_rows: разобранные строки файла. Повторная загрузка за тот же день заменяет прошлую.
-- Видов пять: fin (финансовый), sales (продажи по баркодам), dynamics (динамика по дням),
-- stock_fbo (остатки на складах WB), stock_fbs (остатки на складах продавца, slot 1..5).

create table if not exists public.report_uploads (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    report_type text not null check (report_type in ('fin', 'sales', 'dynamics', 'stock_fbo', 'stock_fbs')),
    slot int not null default 1 check (slot between 1 and 5),
    report_date date not null,
    file_name text,
    rows_count int not null default 0,
    summary jsonb not null default '{}'::jsonb,
    uploaded_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    unique (cabinet_id, report_type, slot, report_date)
);

create table if not exists public.report_rows (
    id bigserial primary key,
    upload_id uuid not null references public.report_uploads(id) on delete cascade,
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    report_type text not null,
    report_date date not null,
    slot int not null default 1,
    article text,
    nm_id bigint,
    barcode text,
    size text,
    warehouse text,
    qty numeric not null default 0,
    amount numeric not null default 0,
    extra jsonb not null default '{}'::jsonb
);

create index if not exists report_rows_cab_type_date_idx on public.report_rows (cabinet_id, report_type, report_date);
create index if not exists report_rows_upload_idx on public.report_rows (upload_id);
create index if not exists report_uploads_cab_date_idx on public.report_uploads (cabinet_id, report_date);

alter table public.report_uploads enable row level security;
alter table public.report_rows enable row level security;

drop policy if exists report_uploads_access on public.report_uploads;
create policy report_uploads_access on public.report_uploads for all to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

drop policy if exists report_rows_access on public.report_rows;
create policy report_rows_access on public.report_rows for all to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
