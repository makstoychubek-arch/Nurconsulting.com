-- Хаб агентов: WhatsApp, секреты TG-ботов, мозг ChatGPT.

create table if not exists public.whatsapp_agents (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    phone text,
    is_enabled boolean not null default true,
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists public.agent_brain (
    id text primary key,
    provider text not null default 'chatgpt',
    model text not null default 'gpt-4o-mini',
    updated_at timestamptz not null default now()
);

insert into public.agent_brain (id, provider, model)
values ('default', 'chatgpt', 'gpt-4o-mini')
on conflict (id) do nothing;

create table if not exists public.telegram_bot_secrets (
    bot_id text primary key references public.telegram_bots(id) on delete cascade,
    token text not null,
    updated_at timestamptz not null default now()
);

alter table public.whatsapp_agents enable row level security;
alter table public.agent_brain enable row level security;
alter table public.telegram_bot_secrets enable row level security;

drop policy if exists whatsapp_agents_select on public.whatsapp_agents;
create policy whatsapp_agents_select on public.whatsapp_agents
    for select using (auth.uid() is not null);

drop policy if exists whatsapp_agents_write on public.whatsapp_agents;
create policy whatsapp_agents_write on public.whatsapp_agents
    for all using (public.is_super_admin())
    with check (public.is_super_admin());

drop policy if exists agent_brain_select on public.agent_brain;
create policy agent_brain_select on public.agent_brain
    for select using (auth.uid() is not null);

drop policy if exists agent_brain_write on public.agent_brain;
create policy agent_brain_write on public.agent_brain
    for all using (public.is_super_admin())
    with check (public.is_super_admin());

grant select on public.whatsapp_agents to authenticated;
grant select, insert, update, delete on public.whatsapp_agents to authenticated;
grant select on public.agent_brain to authenticated;
grant select, insert, update, delete on public.agent_brain to authenticated;
grant all on public.whatsapp_agents to service_role;
grant all on public.agent_brain to service_role;
grant all on public.telegram_bot_secrets to service_role;
