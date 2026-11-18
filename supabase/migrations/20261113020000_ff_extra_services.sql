-- Доп. услуга ФФ «вакуумирование» с переключателем на сайте: {"on": false, "per_unit": 50, "from": "YYYY-MM-DD"}.
-- Когда включена, ff-shipments-report начисляет per_unit ₽ за каждую отправку, начиная с даты from (сверху цены отправки).
alter table public.ff_settings add column if not exists vacuum jsonb not null default '{"on": false, "per_unit": 50}'::jsonb;
