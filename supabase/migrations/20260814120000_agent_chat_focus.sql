-- Фокус разговора в тимчате: пока активен — отвечает только этот агент
-- (короткие реплики вроде «лапша белая» не уходят Карине по умолчанию).

create table if not exists public.agent_chat_focus (
    chat_id     bigint primary key,
    agent_key   text not null,
    reason      text,
    expires_at  timestamptz not null,
    updated_at  timestamptz not null default now()
);

create index if not exists agent_chat_focus_expires_idx
    on public.agent_chat_focus (expires_at);

alter table public.agent_chat_focus enable row level security;

drop policy if exists "agent_chat_focus_deny" on public.agent_chat_focus;
create policy "agent_chat_focus_deny" on public.agent_chat_focus
    for all using (false) with check (false);
