-- Тарифы ФФ в рублях (ФФ в России). fx_rate — свой курс ФФ «₽ → сом» (например 1,06); пусто — курс НБКР на день расчёта.
alter table public.ff_terms add column if not exists fx_rate numeric check (fx_rate is null or fx_rate > 0);
