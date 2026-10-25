-- Интеграции: личные ключи для подключения своего ИИ (Claude, ChatGPT) к данным СВОИХ кабинетов через MCP.
-- Ключ хранится только хешем, показывается один раз при создании. Отозвать можно в любой момент.

create table if not exists public.mcp_keys (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    key_hash     text not null unique,
    label        text not null default '',
    created_at   timestamptz not null default now(),
    last_used_at timestamptz,
    revoked_at   timestamptz
);
alter table public.mcp_keys enable row level security;
drop policy if exists mcp_keys_own on public.mcp_keys;
create policy mcp_keys_own on public.mcp_keys for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
revoke all on public.mcp_keys from anon;
revoke insert, update, delete on public.mcp_keys from authenticated;
grant select (id, user_id, label, created_at, last_used_at, revoked_at) on public.mcp_keys to authenticated;

create or replace function public.mcp_key_create(p_label text default '') returns text
language plpgsql security definer set search_path = public as $$
declare k text; n integer;
begin
    if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
    select count(*) into n from public.mcp_keys where user_id = auth.uid() and revoked_at is null;
    if n >= 5 then raise exception 'limit' using errcode = '22023'; end if;
    k := 'nrk_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into public.mcp_keys (user_id, key_hash, label)
    values (auth.uid(), encode(sha256(convert_to(k, 'utf8')), 'hex'), left(coalesce(p_label, ''), 60));
    return k;
end $$;
revoke all on function public.mcp_key_create(text) from public, anon;
grant execute on function public.mcp_key_create(text) to authenticated;

create or replace function public.mcp_key_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
    update public.mcp_keys set revoked_at = now() where id = p_id and user_id = auth.uid() and revoked_at is null;
end $$;
revoke all on function public.mcp_key_revoke(uuid) from public, anon;
grant execute on function public.mcp_key_revoke(uuid) to authenticated;

-- Только для серверной функции: по хешу ключа возвращает владельца ключа и отмечает использование.
create or replace function public.mcp_resolve(p_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
    update public.mcp_keys set last_used_at = now() where key_hash = p_hash and revoked_at is null returning user_id into uid;
    return uid;
end $$;
revoke all on function public.mcp_resolve(text) from public, anon, authenticated;
grant execute on function public.mcp_resolve(text) to service_role;

-- Кабинеты, доступные человеку: свои и выданные ему (владелец или просмотр).
create or replace function public.mcp_user_cabinets(p_user uuid) returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
    select c.id, c.name from public.cabinets c where c.user_id = p_user
    union
    select c.id, c.name from public.cabinets c join public.cabinet_viewers v on v.cabinet_id = c.id where v.user_id = p_user
$$;
revoke all on function public.mcp_user_cabinets(uuid) from public, anon, authenticated;
grant execute on function public.mcp_user_cabinets(uuid) to service_role;
