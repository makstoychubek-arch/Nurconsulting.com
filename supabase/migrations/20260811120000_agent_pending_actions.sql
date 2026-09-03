-- Очередь действий агентов: сначала предложение, потом явное подтверждение владельца.

create table if not exists public.agent_pending_actions (
    id              uuid primary key default gen_random_uuid(),
    chat_id         bigint not null,
    agent_key       text not null,
    action_type     text not null,
    -- advert_start | advert_pause | …
    status          text not null default 'awaiting_selection',
    -- awaiting_selection | awaiting_confirm | executing | done | cancelled | expired
    cabinet_id      uuid,
    cabinet_name    text,
    payload         jsonb not null default '{}'::jsonb,
    -- { campaignIds: number[], campaignNames: Record<string,string>, selectedIds?: number[] }
    proposed_by_tg  bigint,
    confirmed_by_tg bigint,
    result_text     text,
    expires_at      timestamptz not null default (now() + interval '30 minutes'),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists agent_pending_actions_chat_active_idx
    on public.agent_pending_actions (chat_id, status, created_at desc);

alter table public.agent_pending_actions enable row level security;

drop policy if exists "agent_pending_actions_deny" on public.agent_pending_actions;
create policy "agent_pending_actions_deny" on public.agent_pending_actions
    for all using (false) with check (false);
