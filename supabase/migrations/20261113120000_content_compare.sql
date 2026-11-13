-- «Сравнение контента»: данные по артикулу, перенесённые из таблицы владельца (конкуренты с выручкой, СЕО: факт и новый вариант,
-- слова, итог для описания, ключевые запросы). Одна строка на артикул кабинета, содержимое в jsonb. Читают те, кто видит кабинет.
create table if not exists public.content_compare (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    nm_id bigint not null,
    period_from date,
    period_to date,
    data jsonb not null default '{}'::jsonb,
    source text not null default 'sheet',
    updated_at timestamptz not null default now(),
    primary key (cabinet_id, nm_id)
);
alter table public.content_compare enable row level security;
drop policy if exists content_compare_sel on public.content_compare;
create policy content_compare_sel on public.content_compare for select to authenticated
    using (public.can_view_cabinet(cabinet_id));
