-- Группы РНП как в карточке WB: общий imtID (склеенные цвета), название карточки и предмет (категория WB).
alter table public.rnp_articles
  add column if not exists imt_id bigint,
  add column if not exists card_title text,
  add column if not exists subject_name text;

create index if not exists rnp_articles_cab_imt_idx on public.rnp_articles (cabinet_id, imt_id);

-- Журнал изменений цены из РНП (пишет только функция wb-proxy от имени сервиса).
create table if not exists public.price_changes (
  id bigserial primary key,
  cabinet_id uuid not null,
  nm_id bigint not null,
  user_id uuid,
  old_price integer,
  old_discount integer,
  new_price integer,
  new_discount integer,
  seller_delta numeric,
  upload_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists price_changes_cab_idx on public.price_changes (cabinet_id, created_at desc);
alter table public.price_changes enable row level security;
drop policy if exists price_changes_select on public.price_changes;
create policy price_changes_select on public.price_changes for select
  using (cabinet_id in (select current_user_cabinet_ids()));
