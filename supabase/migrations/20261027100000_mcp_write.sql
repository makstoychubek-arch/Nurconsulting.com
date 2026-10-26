-- Изменения цен через свой ИИ (MCP): отдельное разрешение на ключе, журнал и безопасное двухшаговое применение.
-- По умолчанию ключ только читает. Писать может ключ с can_write и только в кабинетах, где человек владелец.

alter table public.mcp_keys add column if not exists can_write boolean not null default false;

-- Журнал предложенных и применённых изменений (видны только владельцу ключа).
create table if not exists public.mcp_changes (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    cabinet_id  uuid not null,
    kind        text not null default 'prices',
    items       jsonb not null default '[]'::jsonb,
    summary     text not null default '',
    status      text not null default 'pending' check (status in ('pending', 'applied', 'failed', 'cancelled', 'expired')),
    error       text,
    upload_id   bigint,
    created_at  timestamptz not null default now(),
    applied_at  timestamptz
);
create index if not exists mcp_changes_user_idx on public.mcp_changes (user_id, created_at desc);
alter table public.mcp_changes enable row level security;
drop policy if exists mcp_changes_own on public.mcp_changes;
create policy mcp_changes_own on public.mcp_changes for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
revoke all on public.mcp_changes from anon;
revoke insert, update, delete on public.mcp_changes from authenticated;

-- Переключатель «Разрешить ИИ менять цены» для своего ключа.
create or replace function public.mcp_key_set_write(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
    update public.mcp_keys set can_write = coalesce(p_on, false) where id = p_id and user_id = auth.uid() and revoked_at is null;
end $$;
revoke all on function public.mcp_key_set_write(uuid, boolean) from public, anon;
grant execute on function public.mcp_key_set_write(uuid, boolean) to authenticated;

-- Для серверной функции: владелец ключа и разрешение на запись (отмечает использование).
create or replace function public.mcp_resolve_key(p_hash text) returns table (user_id uuid, key_id uuid, can_write boolean)
language plpgsql security definer set search_path = public as $$
begin
    return query update public.mcp_keys k set last_used_at = now() where k.key_hash = p_hash and k.revoked_at is null returning k.user_id, k.id, k.can_write;
end $$;
revoke all on function public.mcp_resolve_key(text) from public, anon, authenticated;
grant execute on function public.mcp_resolve_key(text) to service_role;

-- Кабинеты, где человек может менять цены: свои и те, где он владелец (не гость «только смотреть»).
create or replace function public.mcp_writable_cabinets(p_user uuid) returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
    select c.id, c.name from public.cabinets c where c.user_id = p_user
    union
    select c.id, c.name from public.cabinets c join public.cabinet_viewers v on v.cabinet_id = c.id where v.user_id = p_user and v.role = 'owner'
$$;
revoke all on function public.mcp_writable_cabinets(uuid) from public, anon, authenticated;
grant execute on function public.mcp_writable_cabinets(uuid) to service_role;

grant select (id, user_id, label, created_at, last_used_at, revoked_at, can_write) on public.mcp_keys to authenticated;
