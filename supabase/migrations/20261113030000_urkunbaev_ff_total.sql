-- ИП Уркунбаев (Zevina 1): ФФ сам посчитал общий долг 492 443 ₽ на 11.11 (включительно) (с отгрузкой Ozon и формированием коробов, за вычетом оплаты).
-- Это новая точка отсчёта: старые начисления, ручные записи и оплата заменяются одной записью. Штрафы ФФ (зачёты «[auto дата] Штраф ФФ»)
-- с 30.10 остаются и вычитаются из этой суммы. Дни до 11.11 включительно в сумме уже есть, с 12.11 функция ff-shipments-report каждое утро добавляет только отправки FBS (хранение отменено, вакуумирования у Уркунбаева нет).
delete from public.ff_ledger
 where cabinet_id = (select id from public.cabinets where name = 'Zevina 1')
   and (title like 'Старт счёта%' or title = 'Долг по ФФ' or title like 'Отгрузка Ozon 88%' or title like 'Формирование коробов (свитера)%'
        or title like 'Оплата 50 000 сом%' or (title like '[auto %' and kind = 'charge'));

insert into public.ff_ledger (cabinet_id, ff_name, kind, title, amount, entry_date)
select c.id, 'АМАН ФФ', 'charge', 'Расчёт ФФ на 11.11 (с Озоном)', 492443, '2026-11-11'
  from public.cabinets c
 where c.name = 'Zevina 1' and not exists (select 1 from public.ff_ledger l where l.cabinet_id = c.id and l.title like 'Расчёт ФФ на%');

-- Хранение у Уркунбаева заканчивается 11.11: с 12.11 владелец просил добавлять только отправки FBS.
update public.ff_terms set date_to = '2026-11-11'
 where cabinet_id = (select id from public.cabinets where name = 'Zevina 1') and kind = 'storage' and storage_mode = 'fixed';
