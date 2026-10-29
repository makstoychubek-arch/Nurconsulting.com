-- Сверка новой dashboard_summary со старой (dashboard_summary_slow): должны совпасть для всех кабинетов и периодов.
-- Запускать под ролью с доступом (внутри проверка can_view_cabinet): set local role authenticated + jwt суперадмина.
select c.name, r.f, r.t,
       public.dashboard_summary(c.id, r.f, r.t, r.pf, r.pt) = public.dashboard_summary_slow(c.id, r.f, r.t, r.pf, r.pt) as same
from public.cabinets c
cross join (values
    (date '2026-10-01', date '2026-10-29', date '2026-09-01', date '2026-09-30'),
    (date '2026-10-22', date '2026-10-28', date '2026-10-15', date '2026-10-21'),
    (date '2026-08-01', date '2026-08-31', date '2026-07-01', date '2026-07-31'),
    (date '2026-10-29', date '2026-10-29', date '2026-10-28', date '2026-10-28')
) as r(f, t, pf, pt)
order by c.name, r.f;
