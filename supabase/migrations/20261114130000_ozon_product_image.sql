-- Фото товаров Ozon: главное фото карточки (ozon-sync заполняет при загрузке товаров), РНП показывает его в режиме Ozon.
alter table public.ozon_products add column if not exists image_url text;

create or replace function public.ozon_rnp_articles(p_cabinet uuid) returns jsonb
language sql stable security definer set search_path = public as $$
    with auth as (select public.can_view_cabinet(p_cabinet::text) ok),
    prod as (
        select public.ozon_base_offer(p.offer_id) base, min(p.name) title, min(p.product_id) pid,
               min(p.width_mm) w, min(p.height_mm) h, min(p.depth_mm) d, round(avg(p.weight_g)) g, bool_and(coalesce(p.archived, false)) archived,
               (array_agg(p.image_url order by p.offer_id) filter (where p.image_url is not null))[1] img
        from public.ozon_products p, auth where auth.ok and p.cabinet_id::text = p_cabinet::text group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', 'ozon-' || base, 'cabinet_id', p_cabinet, 'nm_id', public.ozon_pseudo_nm(base), 'name', base, 'card_title', title,
        'category', title, 'subject_name', title, 'photo_url', img, 'is_active', not archived, 'sort_order', 0,
        'cost_price', coalesce((
            select round(avg(a.cost_price))::numeric from public.rnp_articles a
            where a.cabinet_id::text = p_cabinet::text and coalesce(a.cost_price, 0) > 0 and (
                (base like 'свитер%' and lower(a.name) like 'свитер%') or
                (base like 'костюм_укороч%' and lower(a.name) like 'укороч%') or
                (base like 'костюм_оверсайз%' and lower(a.name) like 'костюм_оверсайз%') or
                (base like 'спорт_рич%' and lower(a.name) like 'спорт_костюм_sport_rich%') or
                (base like 'пиджак_оверсайз%' and lower(a.name) like 'пиджак%'))
        ), 0),
        'logistics_unit', 0, 'other_costs', 0, 'other_costs_unit', 0, 'manual_data', '{}'::jsonb,
        'dim_l_cm', round(d / 10.0), 'dim_w_cm', round(w / 10.0), 'dim_h_cm', round(h / 10.0), 'weight_kg', round(g / 1000.0, 2), 'imt_id', null
    ) order by base), '[]'::jsonb)
    from prod;
$$;
