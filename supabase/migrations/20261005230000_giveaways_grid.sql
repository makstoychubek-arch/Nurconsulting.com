-- Раздачи как Google-таблица: строка = позиция (pos) в сетке на 1000+ строк; пустые строки в базе не хранятся.
alter table public.giveaways add column if not exists pos integer;
alter table public.giveaways alter column kind drop not null;
alter table public.giveaways alter column kind drop default;
create unique index if not exists giveaways_cabinet_pos_uniq on public.giveaways (cabinet_id, pos) where pos is not null;
comment on column public.giveaways.pos is 'Номер строки в таблице раздач (с 0); пустые строки в базе не создаются.';
