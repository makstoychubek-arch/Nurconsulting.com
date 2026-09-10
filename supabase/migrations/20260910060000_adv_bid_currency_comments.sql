-- Валюта ставок/бюджетов Advertising API = валюта кабинета продавца, не обязательно RUB.
-- Zevina 1: KGS (проверено get-bids 10.09.2026). Логику колонок не меняем.

comment on column public.autobidder_rules.max_bid is
  'Потолок ставки в валюте кабинета продавца WB (не обязательно RUB). Zevina 1 — KGS.';
comment on column public.autobidder_rules.min_bid_floor is
  'Нижний пол ставки в валюте кабинета продавца WB (не обязательно RUB).';
comment on column public.autobidder_rules.outbid_step is
  'Шаг перебивки в валюте кабинета продавца WB (не обязательно 1 RUB).';
comment on column public.bid_history.old_bid is
  'Ставка до тика, валюта кабинета продавца WB.';
comment on column public.bid_history.new_bid is
  'Ставка после тика, валюта кабинета продавца WB.';
comment on column public.adv_daily_stats.spend is
  'Расход рекламы. Единица — как отдаёт WB fullstats для этого кабинета; не предполагать RUB.';
comment on column public.adv_daily_stats.revenue is
  'Выручка в ряду статистики. Может быть в другой валюте, чем ставка — сверять перед target_drr.';
