-- Документы (сертификаты, декларации и т.п.): по кабинетам, обязательно с артикулом, и общая папка «Консалтинг» (cabinet_id is null).
-- Видит и меняет только команда (is_staff). Файлы лежат в закрытом бакете cabinet-docs.

create table if not exists public.cabinet_documents (
    id uuid primary key default gen_random_uuid(),
    cabinet_id uuid references public.cabinets(id) on delete cascade,
    folder text not null check (folder in ('declaration', 'certificate', 'other', 'contract', 'requisites')),
    nm_id bigint,
    seller_article text,
    title text not null,
    file_path text not null unique,
    file_size bigint,
    mime text,
    valid_until date,
    uploaded_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    constraint cabinet_documents_nm_required check (cabinet_id is null or nm_id is not null)
);

create index if not exists cabinet_documents_cabinet_idx on public.cabinet_documents (cabinet_id, folder, created_at desc);
create index if not exists cabinet_documents_valid_idx on public.cabinet_documents (valid_until) where valid_until is not null;

alter table public.cabinet_documents enable row level security;
revoke all on public.cabinet_documents from anon, public;
grant select, insert, update, delete on public.cabinet_documents to authenticated;

drop policy if exists cabinet_documents_staff on public.cabinet_documents;
create policy cabinet_documents_staff on public.cabinet_documents
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('cabinet-docs', 'cabinet-docs', false)
on conflict (id) do update set public = false;

drop policy if exists cabinet_docs_staff_select on storage.objects;
create policy cabinet_docs_staff_select on storage.objects for select to authenticated
    using (bucket_id = 'cabinet-docs' and public.is_staff());
drop policy if exists cabinet_docs_staff_insert on storage.objects;
create policy cabinet_docs_staff_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'cabinet-docs' and public.is_staff());
drop policy if exists cabinet_docs_staff_update on storage.objects;
create policy cabinet_docs_staff_update on storage.objects for update to authenticated
    using (bucket_id = 'cabinet-docs' and public.is_staff())
    with check (bucket_id = 'cabinet-docs' and public.is_staff());
drop policy if exists cabinet_docs_staff_delete on storage.objects;
create policy cabinet_docs_staff_delete on storage.objects for delete to authenticated
    using (bucket_id = 'cabinet-docs' and public.is_staff());
