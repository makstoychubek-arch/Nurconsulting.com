-- Хранение у ФФ бывает двух видов: за штуку в сутки (unit, с лимитом) и фиксированная сумма в сутки (fixed).
-- Для fixed value — ₽ в сутки за весь склад ФФ, пока там есть остаток. Safe to re-run.
alter table public.ff_terms add column if not exists storage_mode text not null default 'unit' check (storage_mode in ('unit', 'fixed'));
-- WIN WIN МСК берёт фиксированно 315 ₽ в сутки (300 + НДС 5%): переводим уже внесённые тарифы.
update public.ff_terms set storage_mode = 'fixed', daily_cap = null where kind = 'storage' and ff_name = 'WIN WIN МСК' and value = 315;
