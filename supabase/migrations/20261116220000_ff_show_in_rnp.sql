-- Один ползунок «Показывать в РНП» в разделе ФФ: пока выключен, расходы ФФ в РНП не попадают (на дашборде учитываются всегда).
alter table public.ff_settings add column if not exists rnp_show_ff boolean not null default false;
