-- ============================================================
-- NR Space — Контроль РК: тип ставки кампании (Ручной / Единая)
--
-- WB показывает в ЛК (cmp.wildberries.ru) для каждой кампании подпись
-- под типом ("Ручной" / "Единая ставка") — это поле bid_type из
-- GET /api/advert/v2/adverts. Раньше advertising-sync сохранял только
-- payment_type (cpm/cpc), теперь добавляем bid_type, чтобы карточка
-- кампании на дашборде совпадала 1:1 с тем, что продавец видит в WB.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.
-- ============================================================

alter table public.advertising_campaigns
    add column if not exists bid_type text; -- 'auto' | 'manual' (WB: 'Единая ставка' | 'Ручной')

select 'advertising_campaigns.bid_type ready' as status;
