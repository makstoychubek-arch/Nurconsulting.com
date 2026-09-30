-- ============================================================
-- Акылай — первый агент клиента: ответы на отзывы WB с проверкой в Telegram.
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- Правило доступа:
--   * секреты (токен WB, chat_id, одноразовые коды) — RLS без политик и без
--     грантов: читают и пишут только Edge Functions через service_role;
--   * клиент читает только свой кабинет и только безопасные колонки;
--   * команда (team_staff) и суперадмин читают всё для админки;
--   * клиент ничего не пишет напрямую — только через Edge Functions.
-- ============================================================

-- id продавца WB (поле sid токена): по нему не даём подключить один магазин дважды.
alter table public.cabinets add column if not exists wb_sid text;
create index if not exists cabinets_wb_sid_idx on public.cabinets (wb_sid);

create or replace function public.akylai_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_super_admin() or public.is_team_member();
$$;

-- Строгий владелец: только cabinets.user_id, без команды.
create or replace function public.akylai_owns(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.cabinets c where c.id = cid and c.user_id = auth.uid());
$$;

-- ── Зашифрованный токен WB ───────────────────────────────────
create table if not exists public.cabinet_secrets (
    cabinet_id    uuid primary key references public.cabinets(id) on delete cascade,
    wb_token_enc  text not null,
    wb_sid        text not null,
    token_exp     timestamptz,
    token_broken  boolean not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists cabinet_secrets_sid_idx on public.cabinet_secrets (wb_sid);
alter table public.cabinet_secrets enable row level security;
revoke all on public.cabinet_secrets from anon, authenticated;

-- ── Одноразовые ссылки для подключения Telegram ──────────────
create table if not exists public.akylai_links (
    id          uuid primary key default gen_random_uuid(),
    code_hash   text not null unique,
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    user_id     uuid not null,
    expires_at  timestamptz not null,
    used_at     timestamptz,
    created_at  timestamptz not null default now()
);
create index if not exists akylai_links_cabinet_idx on public.akylai_links (cabinet_id);
alter table public.akylai_links enable row level security;
revoke all on public.akylai_links from anon, authenticated;

-- ── Личный чат клиента с ботом ───────────────────────────────
create table if not exists public.akylai_chats (
    cabinet_id    uuid primary key references public.cabinets(id) on delete cascade,
    chat_id       bigint not null,
    blocked       boolean not null default false,
    connected_at  timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists akylai_chats_chat_idx on public.akylai_chats (chat_id);
alter table public.akylai_chats enable row level security;
revoke all on public.akylai_chats from anon, authenticated;

-- ── Настройки агента по кабинету ─────────────────────────────
create table if not exists public.akylai_settings (
    cabinet_id        uuid primary key references public.cabinets(id) on delete cascade,
    enabled           boolean not null default false,
    auto_publish      boolean not null default false,
    published_count   integer not null default 0,
    auto_offer_sent   boolean not null default false,
    limit_notified_on date,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
alter table public.akylai_settings enable row level security;
revoke all on public.akylai_settings from anon, authenticated;
grant select on public.akylai_settings to authenticated;

drop policy if exists akylai_settings_read on public.akylai_settings;
create policy akylai_settings_read on public.akylai_settings for select
    using (public.akylai_owns(cabinet_id) or public.akylai_is_staff());

-- ── Ответы на отзывы ─────────────────────────────────────────
create table if not exists public.akylai_replies (
    id              uuid primary key default gen_random_uuid(),
    cabinet_id      uuid not null references public.cabinets(id) on delete cascade,
    feedback_id     text not null,
    rating          smallint,
    product_name    text,
    feedback_text   text,
    reply_text      text,
    status          text not null default 'pending'
                    check (status in ('pending', 'editing', 'publishing', 'published', 'skipped', 'failed')),
    tg_message_id   bigint,
    created_at      timestamptz not null default now(),
    published_at    timestamptz,
    unique (cabinet_id, feedback_id)
);
create index if not exists akylai_replies_cabinet_day_idx on public.akylai_replies (cabinet_id, created_at desc);
alter table public.akylai_replies enable row level security;
revoke all on public.akylai_replies from anon, authenticated;
-- Клиенту — только содержательные колонки, без tg_message_id.
grant select (id, cabinet_id, rating, product_name, feedback_text, reply_text, status, created_at, published_at)
    on public.akylai_replies to authenticated;

drop policy if exists akylai_replies_read on public.akylai_replies;
create policy akylai_replies_read on public.akylai_replies for select
    using (public.akylai_owns(cabinet_id) or public.akylai_is_staff());

-- ── Расход токенов OpenAI ────────────────────────────────────
create table if not exists public.ai_usage (
    cabinet_id         uuid not null references public.cabinets(id) on delete cascade,
    day                date not null default (now() at time zone 'utc')::date,
    agent              text not null default 'akylai',
    requests           integer not null default 0,
    prompt_tokens      bigint not null default 0,
    completion_tokens  bigint not null default 0,
    primary key (cabinet_id, day, agent)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

drop policy if exists ai_usage_staff on public.ai_usage;
create policy ai_usage_staff on public.ai_usage for select using (public.akylai_is_staff());

-- ── Подробности ошибок агентов (клиенту не видны) ────────────
create table if not exists public.agent_logs (
    id          bigserial primary key,
    agent       text not null,
    cabinet_id  uuid references public.cabinets(id) on delete set null,
    event       text not null,
    detail      jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);
create index if not exists agent_logs_cabinet_idx on public.agent_logs (cabinet_id, created_at desc);
alter table public.agent_logs enable row level security;
revoke all on public.agent_logs from anon, authenticated;
grant select on public.agent_logs to authenticated;

drop policy if exists agent_logs_staff on public.agent_logs;
create policy agent_logs_staff on public.agent_logs for select using (public.akylai_is_staff());

-- ── Счётчики — только для service_role ───────────────────────
create or replace function public.akylai_add_usage(p_cabinet_id uuid, p_prompt bigint, p_completion bigint)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.ai_usage (cabinet_id, day, agent, requests, prompt_tokens, completion_tokens)
    values (p_cabinet_id, (now() at time zone 'utc')::date, 'akylai', 1, greatest(p_prompt, 0), greatest(p_completion, 0))
    on conflict (cabinet_id, day, agent) do update set
        requests = public.ai_usage.requests + 1,
        prompt_tokens = public.ai_usage.prompt_tokens + excluded.prompt_tokens,
        completion_tokens = public.ai_usage.completion_tokens + excluded.completion_tokens;
$$;

create or replace function public.akylai_bump_published(p_cabinet_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
    update public.akylai_settings
       set published_count = published_count + 1, updated_at = now()
     where cabinet_id = p_cabinet_id
    returning published_count;
$$;

revoke all on function public.akylai_add_usage(uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.akylai_bump_published(uuid) from public, anon, authenticated;
grant execute on function public.akylai_add_usage(uuid, bigint, bigint) to service_role;
grant execute on function public.akylai_bump_published(uuid) to service_role;
