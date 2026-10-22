# Рекламный токен WB в Vault

Postgres Vault (`vault.secrets`), не секреты Edge Functions.
Джобы читают так: `cabinets.adv_token_secret_id` → RPC `read_adv_vault_secret` → `vault.decrypted_secrets`.
В таблицу сам токен не пишется.

Нужен **отдельный** токен WB с правом **«Продвижение»**. Обычный `wb_token` кабинета сюда не подходит.

## 1. Взять токен в WB

1. [seller.wildberries.ru](https://seller.wildberries.ru) → **Настройки → Доступ к API**.
2. Создать токен, категория **Продвижение**.
3. Скопировать строку один раз — WB её больше не покажет.

## 2. SQL Editor в Supabase

Проект: [fiukyfyhotctvfdidktx](https://supabase.com/dashboard/project/fiukyfyhotctvfdidktx)

**SQL Editor** → **New query**  
https://supabase.com/dashboard/project/fiukyfyhotctvfdidktx/sql/new

| Кабинет   | `id` |
|-----------|------|
| Baza      | `dac666b6-88e7-4eae-997e-6d8519ba779c` |
| Elium     | `cc14ccd5-454d-46d3-87cc-adc2ffcd84fc` |
| Zevina 1  | `21cffafa-bca2-4984-b5f8-5c426e6f538b` |
| Zevina 2  | `b4cbdc16-a121-40fe-8fdd-051fbdab6712` |

## 3. Положить токен и проставить `adv_token_secret_id`

Один кабинет — один запрос. Подставьте токен и при необходимости другой `id` / имя.

```sql
-- Baza
with s as (
  select vault.create_secret(
    'ВСТАВЬ_ТОКЕН_ПРОДВИЖЕНИЕ',
    'wb-adv-baza',
    'WB Advertising API, Baza'
  ) as id
)
update public.cabinets c
set
  adv_token_secret_id = s.id,
  adv_token_valid = true,
  adv_token_checked_at = now()
from s
where c.id = 'dac666b6-88e7-4eae-997e-6d8519ba779c';
```

То же для остальных: имя секрета уникальное (`wb-adv-elium`, `wb-adv-zevina-1`, `wb-adv-zevina-2`), в `where` — uuid из таблицы.

`Run`. В `cabinets` должен оказаться только UUID секрета, не сам токен.

## 4. Проверить связь (без печати токена)

```sql
select
  c.name,
  c.adv_token_secret_id,
  c.adv_token_valid,
  v.name as vault_name,
  length(v.decrypted_secret) as token_len
from public.cabinets c
left join vault.decrypted_secrets v on v.id = c.adv_token_secret_id
order by c.name;
```

Ожидание: есть `adv_token_secret_id`, `token_len` > 20. Если `token_len` пустой — UUID не попал в Vault.

## 5. Обновить токен, если секрет уже есть

```sql
select vault.update_secret(
  (select adv_token_secret_id from public.cabinets where name = 'Baza'),
  'НОВЫЙ_ТОКЕН_ПРОДВИЖЕНИЕ'
);

update public.cabinets
set adv_token_valid = true, adv_token_checked_at = now()
where name = 'Baza';
```

## 6. Через UI Vault

**Integrations → Vault** (или `Cmd/Ctrl+K` → Vault)  
https://supabase.com/dashboard/project/fiukyfyhotctvfdidktx/integrations/vault

1. **Add new secret**.
2. Name: `wb-adv-baza`, Value: токен.
3. Скопировать **UUID** секрета (это `id`, не имя).
4. В SQL Editor только привязка:

```sql
update public.cabinets
set
  adv_token_secret_id = 'UUID_ИЗ_VAULT',
  adv_token_valid = true,
  adv_token_checked_at = now()
where name = 'Baza';
```

Не путать с **Project Settings → Edge Functions → Secrets** — джобы оттуда токен не читают.

## 7. Прогнать синк вручную

```bash
curl -sS -X POST \
  'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/sync-campaigns' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer СЮДА_SERVICE_ROLE" \
  -d '{"cabinet_id":"dac666b6-88e7-4eae-997e-6d8519ba779c"}'
```

`service_role`: **Project Settings → API → service_role** (не anon).

В ответе должны быть `campaigns` / `clusters`, не `ADV_TOKEN_MISSING`.
Если WB ответит 401 — функция сама поставит `adv_token_valid=false`.

Дальше `sync_campaigns` подхватит кабинет каждые 30 минут.
