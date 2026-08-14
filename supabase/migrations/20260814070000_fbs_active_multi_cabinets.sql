-- FBS-отчёт: включить Baza, Elium, SAAI (Дуйшекеева) рядом с Zevina 1 (Уркунбаев).
-- Раньше в канале FBS уходил только Zevina 1.

update public.fbs_active_cabinets
set
  is_active = true,
  activated_at = coalesce(activated_at, now())
where cabinet in ('Baza', 'Elium', 'SAAI', 'Zevina 1');

insert into public.fbs_active_cabinets (cabinet, is_active, activated_at)
select v.cabinet, v.is_active, v.activated_at
from (
  values
    ('Baza', true, now()),
    ('Elium', true, now()),
    ('SAAI', true, now()),
    ('Zevina 1', true, now()),
    ('Zevina 2', false, null::timestamptz)
) as v(cabinet, is_active, activated_at)
where not exists (
  select 1 from public.fbs_active_cabinets c where c.cabinet = v.cabinet
);
