-- ============================================================
-- Проверка изоляции Акылай двумя тестовыми клиентами.
-- Запуск: Supabase Dashboard → SQL Editor → вставить целиком → Run.
-- Всё внутри транзакции с ROLLBACK в конце — в базе ничего не остаётся.
-- Успех: в выводе «AKYLAI RLS CHECK: OK». Любая утечка — ошибка с описанием.
--
-- Что проверяется:
--  1. После регистрации клиент НЕ попадает в team_staff и allowed_users,
--     не считается сотрудником.
--  2. Клиент A не получает ни одной строки клиента B ни из одной таблицы.
--  3. Клиент не читает токены, chat_id, одноразовые коды, логи и расход —
--     даже свои.
--  4. Клиент не может ничего записать в таблицы Акылай напрямую.
-- ============================================================

begin;

-- ── Два тестовых клиента (триггер регистрации создаст им spaces) ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-00000000000a', 'authenticated', 'authenticated',
   'akylai-test-a@example.com', '', now(), '{"provider":"email"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-00000000000b', 'authenticated', 'authenticated',
   'akylai-test-b@example.com', '', now(), '{"provider":"email"}', '{}', now(), now());

-- Кабинеты и данные Акылай обоих клиентов (от имени postgres, в обход RLS).
insert into public.cabinets (id, name, user_id, wb_sid) values
  ('aaaaaaaa-1111-4000-8000-00000000000a', 'Магазин A', 'aaaaaaaa-0000-4000-8000-00000000000a', 'sid-a'),
  ('bbbbbbbb-1111-4000-8000-00000000000b', 'Магазин B', 'bbbbbbbb-0000-4000-8000-00000000000b', 'sid-b');

insert into public.cabinet_secrets (cabinet_id, wb_token_enc, wb_sid) values
  ('aaaaaaaa-1111-4000-8000-00000000000a', 'v1.test.a', 'sid-a'),
  ('bbbbbbbb-1111-4000-8000-00000000000b', 'v1.test.b', 'sid-b');
insert into public.akylai_links (code_hash, cabinet_id, user_id, expires_at) values
  ('hash-a', 'aaaaaaaa-1111-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000a', now() + interval '1 day'),
  ('hash-b', 'bbbbbbbb-1111-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-00000000000b', now() + interval '1 day');
insert into public.akylai_chats (cabinet_id, chat_id) values
  ('aaaaaaaa-1111-4000-8000-00000000000a', 111), ('bbbbbbbb-1111-4000-8000-00000000000b', 222);
insert into public.akylai_settings (cabinet_id, enabled) values
  ('aaaaaaaa-1111-4000-8000-00000000000a', true), ('bbbbbbbb-1111-4000-8000-00000000000b', true);
insert into public.akylai_replies (cabinet_id, feedback_id, reply_text, tg_message_id) values
  ('aaaaaaaa-1111-4000-8000-00000000000a', 'fb-a', 'ответ A', 1),
  ('bbbbbbbb-1111-4000-8000-00000000000b', 'fb-b', 'ответ B', 2);
insert into public.ai_usage (cabinet_id, requests) values
  ('aaaaaaaa-1111-4000-8000-00000000000a', 1), ('bbbbbbbb-1111-4000-8000-00000000000b', 1);
insert into public.agent_logs (agent, cabinet_id, event) values
  ('akylai', 'aaaaaaaa-1111-4000-8000-00000000000a', 'test'), ('akylai', 'bbbbbbbb-1111-4000-8000-00000000000b', 'test');

-- ── 1. Регистрация не делает клиента сотрудником ──
do $$
begin
  if exists (select 1 from public.team_staff where lower(email) like 'akylai-test-%@example.com') then
    raise exception 'LEAK: test client landed in team_staff after signup';
  end if;
  if exists (select 1 from public.allowed_users where lower(email) like 'akylai-test-%@example.com') then
    raise exception 'LEAK: test client landed in allowed_users after signup';
  end if;
  if (select count(*) from public.spaces where user_id in
      ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b') and status = 'pending') <> 2 then
    raise exception 'signup trigger did not create pending spaces for both test clients';
  end if;
end $$;

-- ── 2–4. Смотрим глазами клиента A ──
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","email":"akylai-test-a@example.com","role":"authenticated"}', true);

do $$
declare
  cnt bigint;
  q text;
  -- Таблицы, где клиенту B не должно быть видно ни строки.
  cross_checks text[] := array[
    'select count(*) from public.cabinets where user_id = ''bbbbbbbb-0000-4000-8000-00000000000b''',
    'select count(*) from public.spaces where user_id = ''bbbbbbbb-0000-4000-8000-00000000000b''',
    'select count(*) from public.akylai_settings where cabinet_id = ''bbbbbbbb-1111-4000-8000-00000000000b''',
    'select count(*) from public.akylai_replies where cabinet_id = ''bbbbbbbb-1111-4000-8000-00000000000b''',
    'select count(*) from public.sync_log where cabinet_id = ''bbbbbbbb-1111-4000-8000-00000000000b'''
  ];
  -- Таблицы, где клиенту не видно вообще ничего, даже своего.
  secret_checks text[] := array[
    'select count(*) from public.cabinet_secrets',
    'select count(*) from public.akylai_links',
    'select count(*) from public.akylai_chats',
    'select count(*) from public.agent_logs',
    'select count(*) from public.ai_usage',
    'select count(*) from public.team_staff',
    'select count(*) from public.allowed_users'
  ];
  writes text[] := array[
    'insert into public.akylai_settings (cabinet_id, enabled) values (''aaaaaaaa-1111-4000-8000-00000000000a'', false) on conflict (cabinet_id) do update set enabled = false',
    'update public.akylai_settings set auto_publish = true',
    'insert into public.akylai_replies (cabinet_id, feedback_id) values (''aaaaaaaa-1111-4000-8000-00000000000a'', ''x'')',
    'update public.akylai_replies set status = ''published''',
    'insert into public.cabinet_secrets (cabinet_id, wb_token_enc, wb_sid) values (''aaaaaaaa-1111-4000-8000-00000000000a'', ''x'', ''x'')',
    'insert into public.akylai_chats (cabinet_id, chat_id) values (''bbbbbbbb-1111-4000-8000-00000000000b'', 333)',
    'insert into public.agent_logs (agent, event) values (''akylai'', ''x'')',
    'select public.akylai_add_usage(''aaaaaaaa-1111-4000-8000-00000000000a'', 1, 1)',
    'select public.akylai_bump_published(''aaaaaaaa-1111-4000-8000-00000000000a'')'
  ];
  affected bigint;
begin
  if auth.uid() <> 'aaaaaaaa-0000-4000-8000-00000000000a' then
    raise exception 'impersonation failed: auth.uid() = %', auth.uid();
  end if;
  if public.akylai_is_staff() or public.is_team_member() or public.is_super_admin() then
    raise exception 'LEAK: test client is treated as staff';
  end if;

  foreach q in array cross_checks loop
    begin
      execute q into cnt;
    exception when insufficient_privilege then cnt := 0;
    end;
    if cnt <> 0 then raise exception 'LEAK: client A sees % row(s) of client B: %', cnt, q; end if;
  end loop;

  foreach q in array secret_checks loop
    begin
      execute q into cnt;
    exception when insufficient_privilege then cnt := 0;
    end;
    if cnt <> 0 then raise exception 'LEAK: client sees % secret/log row(s): %', cnt, q; end if;
  end loop;

  -- Колонка tg_message_id клиенту закрыта.
  begin
    execute 'select tg_message_id from public.akylai_replies limit 1';
    raise exception 'LEAK: client can read akylai_replies.tg_message_id';
  exception when insufficient_privilege then null;
  end;

  -- Своё клиент видит: иначе проверка выше ничего не доказывает.
  select count(*) into cnt from public.akylai_settings where cabinet_id = 'aaaaaaaa-1111-4000-8000-00000000000a';
  if cnt <> 1 then raise exception 'client A cannot see own akylai_settings (policy too strict?)'; end if;
  select count(*) into cnt from public.akylai_replies where cabinet_id = 'aaaaaaaa-1111-4000-8000-00000000000a';
  if cnt <> 1 then raise exception 'client A cannot see own akylai_replies'; end if;

  foreach q in array writes loop
    begin
      execute q;
      get diagnostics affected = row_count;
      if affected > 0 then raise exception 'LEAK: client wrote directly: %', q; end if;
    exception when insufficient_privilege or check_violation then null;
    end;
  end loop;

  raise notice 'AKYLAI RLS CHECK: OK — client A sees nothing of client B, no secrets, no direct writes';
end $$;

reset role;
rollback;
