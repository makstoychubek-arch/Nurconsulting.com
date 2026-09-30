-- ============================================================
-- Признак «кабинет ведёт команда NR» (cabinets.nr_managed).
--
-- Внутренние отчёты команды (штрафы, продажи, реклама, РНП, автоответы на
-- вопросы WB) раньше брали ВСЕ кабинеты с wb_token. Когда админка одобряет
-- клиента, его токен попадает в cabinets.wb_token — и кабинет клиента
-- подхватили бы командные отчёты (данные в командные чаты, автоответы
-- в его кабинете WB без согласия). Теперь эти функции берут только
-- кабинеты с nr_managed = true.
--
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run: разовая расстановка
-- «да» делается только в момент создания колонки, повторный запуск не пометит
-- клиентские кабинеты.
-- ============================================================

do $$
begin
    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'cabinets' and column_name = 'nr_managed'
    ) then
        alter table public.cabinets add column nr_managed boolean not null default false;

        -- Разово: кабинеты, которыми владеет команда (team_staff), ведёт команда.
        update public.cabinets c
           set nr_managed = true
         where exists (
            select 1
              from public.spaces s
              join public.team_staff t on lower(t.email) = lower(s.email)
             where s.user_id = c.user_id
         );
    end if;
end $$;

comment on column public.cabinets.nr_managed is
    'true — кабинет ведёт команда NR: он попадает во внутренние отчёты и автоответы. Клиентские кабинеты — false. Менять может только суперадмин или сервер.';

-- Клиент (RLS разрешает ему править свой кабинет) не должен включить флаг сам.
-- Запросы без пользовательского JWT (service_role, SQL Editor) проходят как есть.
create or replace function public.cabinets_guard_nr_managed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if auth.uid() is not null and not public.is_super_admin() then
        if tg_op = 'INSERT' then
            new.nr_managed := false;
        else
            new.nr_managed := old.nr_managed;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists cabinets_guard_nr_managed on public.cabinets;
create trigger cabinets_guard_nr_managed
    before insert or update on public.cabinets
    for each row execute function public.cabinets_guard_nr_managed();
