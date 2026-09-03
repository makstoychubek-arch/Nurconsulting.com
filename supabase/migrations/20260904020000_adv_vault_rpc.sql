-- RPC для чтения рекламного токена WB из Vault.
-- Колонки cabinets.adv_token_* создаёт миграция шага 1 (autobidder v2 schema).

create or replace function public.read_adv_vault_secret(secret_id uuid)
returns text
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  val text;
begin
  if secret_id is null then
    return null;
  end if;
  select ds.decrypted_secret
    into val
  from vault.decrypted_secrets as ds
  where ds.id = secret_id;
  return val;
end;
$$;

revoke all on function public.read_adv_vault_secret(uuid) from public, anon, authenticated;
grant execute on function public.read_adv_vault_secret(uuid) to service_role;

comment on function public.read_adv_vault_secret(uuid) is
  'Service-role only. Читает рекламный токен WB из Vault по cabinets.adv_token_secret_id.';
