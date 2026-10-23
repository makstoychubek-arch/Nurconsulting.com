-- Сводка для страницы супер-админа: кабинеты, размер данных, последняя синхронизация, доступы, сотрудники.
-- Читает только супер-админ (проверка внутри функции), анонимам и обычным пользователям доступа нет.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    res jsonb;
begin
    if not public.is_super_admin() then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    select jsonb_build_object(
        'db_bytes', pg_database_size(current_database()),
        'cabinets', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'user_id', c.user_id,
                'owner_email', (select u.email from auth.users u where u.id = c.user_id),
                'nr_managed', coalesce(c.nr_managed, false),
                'has_wb', coalesce(c.wb_token, '') <> '',
                'adv_ok', c.adv_token_valid,
                'articles', (select count(*) from public.rnp_articles a where a.cabinet_id = c.id::text),
                'daily_rows', (select count(*) from public.rnp_daily_data d where d.cabinet_id = c.id::text),
                'daily_bytes', (select coalesce(sum(pg_column_size(d.*)), 0) from public.rnp_daily_data d where d.cabinet_id = c.id::text),
                'last_sync', (select max(j.finished_at) from public.sync_jobs j where j.cabinet_id = c.id and j.status = 'done'),
                'sync_error', (select j.error from public.sync_jobs j where j.cabinet_id = c.id and j.status = 'error' order by j.finished_at desc nulls last limit 1),
                'features', (select coalesce(jsonb_agg(jsonb_build_object(
                    'feature', f.feature, 'enabled', f.enabled, 'status', f.last_status, 'error', f.last_error, 'at', f.last_run_at
                )), '[]'::jsonb) from public.cabinet_features f where f.cabinet_id = c.id)
            ) order by c.name)
            from public.cabinets c
        ), '[]'::jsonb),
        'viewers', coalesce((
            select jsonb_agg(jsonb_build_object(
                'cabinet_id', v.cabinet_id, 'user_id', v.user_id, 'email', u.email,
                'sections', v.sections, 'created_at', v.created_at
            ))
            from public.cabinet_viewers v
            join auth.users u on u.id = v.user_id
        ), '[]'::jsonb),
        'staff', coalesce((
            select jsonb_agg(jsonb_build_object(
                'email', s.email, 'note', s.note, 'created_at', s.created_at,
                'last_sign_in', (select u.last_sign_in_at from auth.users u where lower(u.email) = lower(s.email) limit 1)
            ) order by s.created_at)
            from public.team_staff s
        ), '[]'::jsonb)
    ) into res;

    return res;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
