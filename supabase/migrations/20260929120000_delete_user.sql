-- ============================================================
-- NR Space — удаление пользователя из админки
--
-- Кабинеты и их данные при удалении пользователя НЕ трогаем: только снимаем
-- владельца (cabinets.user_id = null). Поэтому колонка должна допускать null.
--
-- admin_detach_user() делает всё, что нужно ДО auth.admin.deleteUser(), одной
-- транзакцией, чтобы не остаться в полуудалённом состоянии:
--   * убирает пользователя из team_staff и allowed_users (по email);
--   * убирает его права в user_cabinet_access (там нет внешнего ключа);
--   * отвязывает его кабинеты (user_id = null), данные кабинетов остаются;
--   * обнуляет created_by в списках фраз: внешний ключ на auth.users без
--     каскада, иначе deleteUser упадёт.
-- Вызывать её может только service_role (edge-функция delete-user).
-- Safe to re-run.
-- ============================================================

alter table public.cabinets alter column user_id drop not null;

create or replace function public.admin_detach_user(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email    text := lower(trim(coalesce(p_email, '')));
    v_detached integer := 0;
begin
    if p_user_id is null then
        raise exception 'user id required';
    end if;

    if v_email <> '' then
        if to_regclass('public.team_staff') is not null then
            delete from public.team_staff where lower(email) = v_email;
        end if;
        if to_regclass('public.allowed_users') is not null then
            delete from public.allowed_users where lower(email) = v_email;
        end if;
    end if;

    if to_regclass('public.user_cabinet_access') is not null then
        delete from public.user_cabinet_access where user_id = p_user_id;
    end if;

    update public.cabinets set user_id = null where user_id = p_user_id;
    get diagnostics v_detached = row_count;

    if to_regclass('public.cluster_whitelist') is not null then
        update public.cluster_whitelist set created_by = null where created_by = p_user_id;
    end if;
    if to_regclass('public.cluster_protected_phrases') is not null then
        update public.cluster_protected_phrases set created_by = null where created_by = p_user_id;
    end if;

    return v_detached;
end;
$$;

revoke all on function public.admin_detach_user(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_detach_user(uuid, text) to service_role;

comment on function public.admin_detach_user(uuid, text) is
    'Service-role only. Готовит пользователя к удалению: снимает права и владение кабинетами, данные кабинетов не удаляет.';
