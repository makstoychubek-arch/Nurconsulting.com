-- «Пульт РК»: изменения ставок и товаров сначала показываются на сайте сразу, а в WB их отправляет очередь.
-- Клиент пишет строку в adv_ops и ничего не ждёт; функция adv-ops-run (и cron adv-ops-tick) отправляет в WB с повторами.
create table if not exists public.adv_ops (
    id          uuid primary key default gen_random_uuid(),
    seq         bigint generated always as identity,
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    advert_id   bigint,
    kind        text not null check (kind in ('set_bid', 'add_nm', 'remove_nm', 'create')),
    payload     jsonb not null default '{}'::jsonb,
    status      text not null default 'pending' check (status in ('pending', 'sending', 'done', 'error')),
    attempts    int  not null default 0,
    last_error  text,
    result      jsonb,
    next_at     timestamptz not null default now(),
    created_by  uuid default auth.uid(),
    created_at  timestamptz not null default now(),
    done_at     timestamptz
);
create index if not exists adv_ops_queue_idx on public.adv_ops (status, next_at, seq);
create index if not exists adv_ops_cab_idx on public.adv_ops (cabinet_id, created_at desc);

alter table public.adv_ops enable row level security;
drop policy if exists adv_ops_sel on public.adv_ops;
create policy adv_ops_sel on public.adv_ops for select to authenticated using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists adv_ops_ins on public.adv_ops;
create policy adv_ops_ins on public.adv_ops for insert to authenticated with check (cabinet_id in (select public.current_user_cabinet_ids()));
revoke all on public.adv_ops from anon;
revoke update, delete on public.adv_ops from authenticated;
grant select, insert on public.adv_ops to authenticated;
grant all on public.adv_ops to service_role;

-- Забирает записи на отправку: по порядку, без гонок между функцией и cron; застрявшие в sending дольше 3 минут берутся заново.
create or replace function public.adv_ops_claim(p_cabinet uuid, p_ids uuid[], p_limit int)
returns setof public.adv_ops
language sql
security definer
set search_path = public
as $$
    update public.adv_ops o
       set status = 'sending', attempts = o.attempts + 1, next_at = now() + interval '3 minutes'
     where o.id in (
        select id from public.adv_ops
         where (p_cabinet is null or cabinet_id = p_cabinet)
           and (p_ids is null or id = any(p_ids))
           and ((status = 'pending' and next_at <= now()) or (status = 'sending' and next_at <= now()))
         order by seq
         limit greatest(1, least(coalesce(p_limit, 50), 200))
         for update skip locked
     )
    returning o.*;
$$;
revoke all on function public.adv_ops_claim(uuid, uuid[], int) from public, anon, authenticated;
grant execute on function public.adv_ops_claim(uuid, uuid[], int) to service_role;
