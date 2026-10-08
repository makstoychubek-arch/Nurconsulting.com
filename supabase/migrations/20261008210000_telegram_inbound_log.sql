create table if not exists public.telegram_inbound_log (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    bot_id text,
    chat_id text,
    message_id bigint,
    reply_to_ids bigint[],
    from_username text,
    text_head text,
    result text
);
alter table public.telegram_inbound_log enable row level security;
