-- Рекламный токен WB: в таблицах только Vault secret_id (docs/autobidder.md §5, §11.1).
-- Сам токен на фронт не отдаётся — его читает только Edge Function wb-proxy /adv/*.

alter table public.cabinets
  add column if not exists adv_token_secret_id uuid,
  add column if not exists adv_token_valid boolean not null default true,
  add column if not exists adv_token_checked_at timestamptz;

comment on column public.cabinets.adv_token_secret_id is
  'id секрета в supabase_vault с токеном категории «Продвижение». Значение секрета в таблицах не хранится.';
comment on column public.cabinets.adv_token_valid is
  'false после 401/403 от advert-api.wildberries.ru; check_tokens / прокси выставляют флаг.';
comment on column public.cabinets.adv_token_checked_at is
  'Когда последний раз проверяли рекламный токен (успех или 401/403).';

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
