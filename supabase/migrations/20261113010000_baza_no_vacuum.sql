-- ИП Бейшеев: со вторника 10.11 куртки отправляют без вакуумирования. Отправка 100 ₽ за штуку, доп. услуга вакуумирования 0.
-- Стартовый счёт 32 229 ₽ был посчитан по 150 ₽ за 27.10–11.11, поэтому вычитаем 50 ₽ за 33 куртки 10.11 (15) и 11.11 (18).
update public.ff_terms set date_to = '2026-11-09'
 where cabinet_id = (select id from public.cabinets where name = 'Baza') and kind = 'ship' and ff_name = 'АМАН ФФ' and value = 150 and date_to is null;

insert into public.ff_terms (cabinet_id, ff_name, kind, value, date_from, date_to)
select c.id, 'АМАН ФФ', 'ship', 100, '2026-11-10', null from public.cabinets c
 where c.name = 'Baza' and not exists (select 1 from public.ff_terms t where t.cabinet_id = c.id and t.kind = 'ship' and t.value = 100 and t.date_from = '2026-11-10');

insert into public.ff_ledger (cabinet_id, ff_name, kind, title, amount, entry_date)
select c.id, 'АМАН ФФ', 'payment', 'Корректировка: без вакуумирования с 10.11 (33 шт × 50)', 1650, '2026-11-11'
  from public.cabinets c
 where c.name = 'Baza' and not exists (select 1 from public.ff_ledger l where l.cabinet_id = c.id and l.title like 'Корректировка: без вакуумирования%');
