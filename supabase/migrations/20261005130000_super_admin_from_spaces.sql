-- ============================================================
-- Супер-админ: владелец + аккаунты с флагом spaces.is_super_admin.
--
-- Раньше is_super_admin() знала только global.pro.1004@gmail.com, а флаг в spaces
-- ничего не давал. Теперь функция дополнительно смотрит флаг у активного space
-- вызывающего пользователя.
--
-- Эскалации прав нет: клиент не может поставить флаг себе —
--   * spaces_insert_own разрешает вставку только с is_super_admin = false и status = pending;
--   * spaces_update_admin разрешает UPDATE только тому, для кого is_super_admin() уже true.
-- Владелец (global) остаётся жёстко прописанным и не зависит от таблицы.
-- Safe to re-run.
-- ============================================================

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
    select
        lower(coalesce(auth.jwt() ->> 'email', '')) = 'global.pro.1004@gmail.com'
        or auth.uid() = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e'::uuid
        or exists (
            select 1 from public.spaces s
            where s.user_id = auth.uid()
              and s.is_super_admin = true
              and s.status = 'active'
        );
$$;

update public.spaces
   set is_super_admin = true, updated_at = now()
 where lower(email) = 'makstoychubek@gmail.com' and status = 'active';
