create table if not exists agent_chat_history (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  sender text not null,
  text text not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_agent_chat_history_chat_id
  on agent_chat_history (chat_id, created_at);

create table if not exists agent_standing_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null,
  task_description text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);
