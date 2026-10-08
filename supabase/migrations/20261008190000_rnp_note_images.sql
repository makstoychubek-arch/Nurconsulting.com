-- Фото к заметкам дня в РНП: колонка со ссылкой и публичный bucket (запись только своим кабинетам).
alter table public.rnp_date_notes add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('rnp-note-images', 'rnp-note-images', true)
on conflict (id) do nothing;

drop policy if exists rnp_note_images_select on storage.objects;
create policy rnp_note_images_select on storage.objects for select using (bucket_id = 'rnp-note-images');

drop policy if exists rnp_note_images_insert on storage.objects;
create policy rnp_note_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'rnp-note-images' and split_part(name, '/', 1) in (
    select c.id::text from public.cabinets c where c.id in (select public.current_user_cabinet_ids())));

drop policy if exists rnp_note_images_delete on storage.objects;
create policy rnp_note_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'rnp-note-images' and split_part(name, '/', 1) in (
    select c.id::text from public.cabinets c where c.id in (select public.current_user_cabinet_ids())));
