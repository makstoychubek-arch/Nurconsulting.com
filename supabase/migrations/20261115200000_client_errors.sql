-- Ошибки консоли сайта (красные ошибки и ошибки API) от вошедших пользователей: чтобы чинить до скрина владельца.
-- Без персональных данных: только текст ошибки без адресов с параметрами, страница, режим площадки, кабинет.
-- Читает только супер-админ; хранится 14 дней.
create table if not exists public.client_errors (
    id bigserial primary key,
    user_id uuid default auth.uid(),
    cabinet_id uuid,
    mp text,
    page text,
    msg text not null,
    src text,
    n int not null default 1,
    ts timestamptz not null default now()
);
create index if not exists client_errors_at_idx on public.client_errors (ts desc);
alter table public.client_errors enable row level security;
drop policy if exists client_errors_staff_read on public.client_errors;
create policy client_errors_staff_read on public.client_errors for select to authenticated using (public.is_super_admin());

create or replace function public.log_client_errors(p_rows jsonb, p_cabinet uuid default null, p_mp text default null, p_page text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then return; end if;
    insert into public.client_errors (user_id, cabinet_id, mp, page, msg, src, n)
    select auth.uid(), p_cabinet, left(p_mp, 12), left(p_page, 40), left(r->>'msg', 400), left(r->>'src', 160), least(greatest(coalesce((r->>'n')::int, 1), 1), 1000)
    from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end) with ordinality as t(r, i)
    where i <= 20 and coalesce(r->>'msg', '') <> '';
    if random() < 0.02 then delete from public.client_errors where ts < now() - interval '14 days'; end if;
end;
$$;
grant execute on function public.log_client_errors(jsonb, uuid, text, text) to authenticated;
