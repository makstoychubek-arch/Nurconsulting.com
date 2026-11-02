-- Супер-админ видит ключи ИИ всех пользователей (политика mcp_keys_own), но «Отозвать» и «менять цены» работали только для владельца ключа:
-- нажатие молча ничего не делало, после обновления страницы ключ возвращался. Теперь и супер-админ может отозвать ключ и снять/поставить галочку записи.
create or replace function public.mcp_key_revoke(p_id uuid) returns void language plpgsql security definer set search_path to 'public' as $$
begin
    update public.mcp_keys set revoked_at = now() where id = p_id and (user_id = auth.uid() or public.is_super_admin()) and revoked_at is null;
end $$;

create or replace function public.mcp_key_set_write(p_id uuid, p_on boolean) returns void language plpgsql security definer set search_path to 'public' as $$
begin
    update public.mcp_keys set can_write = coalesce(p_on, false) where id = p_id and (user_id = auth.uid() or public.is_super_admin()) and revoked_at is null;
end $$;
