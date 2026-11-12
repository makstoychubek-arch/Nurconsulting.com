-- Общий счёт ФФ (АМАН): стартовые записи и новая ставка хранения.
-- Уркунбаев (Zevina 1): на 30.10 «мы должны ФФ» 491 512 ₽ (151 419 отправки и хранение 11–29.10 − 18 160 подмены + 358 253 запись журнала);
-- запись 358 253 уже лежит в ff_ledger, добавляем остальные 133 259 на 29.10. С 30.10 хранение фикс 1 000 ₽ в сутки, по 12.11 включительно.
-- Во вторник 10.11 оплачено 50 000 сом (курс 1,057 = 47 304 ₽).
-- Бейшеев (Baza): оплачен до 26.10, счёт за 27.10–11.11 равен 32 229 ₽; дальше начисления пишет ff-shipments-report каждое утро.

update public.ff_terms set date_to = '2026-10-29'
 where cabinet_id = (select id from public.cabinets where name = 'Zevina 1') and kind = 'storage' and date_to = '2026-11-13';

insert into public.ff_terms (cabinet_id, ff_name, kind, value, date_from, date_to, storage_mode)
select c.id, 'АМАН ФФ', 'storage', 1000, '2026-10-30', '2026-11-12', 'fixed'
  from public.cabinets c
 where c.name = 'Zevina 1'
   and not exists (select 1 from public.ff_terms t where t.cabinet_id = c.id and t.kind = 'storage' and t.storage_mode = 'fixed');

insert into public.ff_ledger (cabinet_id, ff_name, kind, title, amount, entry_date)
select c.id, 'АМАН ФФ', 'charge', 'Старт счёта: отправки и хранение 11–29.10 минус подмены', 133259, '2026-10-29'
  from public.cabinets c
 where c.name = 'Zevina 1' and not exists (select 1 from public.ff_ledger l where l.cabinet_id = c.id and l.title like 'Старт счёта%');

insert into public.ff_ledger (cabinet_id, ff_name, kind, title, amount, entry_date)
select c.id, 'АМАН ФФ', 'payment', 'Оплата 50 000 сом (курс 1,057)', 47304, '2026-11-10'
  from public.cabinets c
 where c.name = 'Zevina 1' and not exists (select 1 from public.ff_ledger l where l.cabinet_id = c.id and l.title like 'Оплата 50 000 сом%');

insert into public.ff_ledger (cabinet_id, ff_name, kind, title, amount, entry_date)
select c.id, 'АМАН ФФ', 'charge', 'Старт счёта: отправки и хранение 27.10–11.11', 32229, '2026-11-11'
  from public.cabinets c
 where c.name = 'Baza' and not exists (select 1 from public.ff_ledger l where l.cabinet_id = c.id and l.title like 'Старт счёта%');
