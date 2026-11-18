-- А/Б-тесты фото для Ozon: тот же тест, что у WB, но фото ставится на карточки Ozon.
-- Тест живёт на «артикуле без размера» (все размеры меняются вместе): nm_id = псевдо-номер группы (ozon_pseudo_nm),
-- список товаров Ozon (product_id и остальные фото карточки) лежит в settings.ozon.
alter table public.ab_tests add column if not exists marketplace text not null default 'wb';
alter table public.ab_tests drop constraint if exists ab_tests_marketplace_chk;
alter table public.ab_tests add constraint ab_tests_marketplace_chk check (marketplace in ('wb', 'ozon'));

-- товары Ozon одного артикула без размера
create or replace function public.ozon_offers_of_base(p_cabinet uuid, p_base text) returns jsonb
language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object('product_id', p.product_id, 'offer_id', p.offer_id, 'name', p.name) order by p.offer_id), '[]'::jsonb)
    from public.ozon_products p
    where public.can_view_cabinet(p_cabinet::text) and p.cabinet_id::text = p_cabinet::text
      and not coalesce(p.archived, false) and public.ozon_base_offer(p.offer_id) = p_base;
$$;
grant execute on function public.ozon_offers_of_base(uuid, text) to authenticated;
