-- ============================================================
-- NR Space — крон финансового отчёта никогда не работал
--
-- Задача rnp-finance-sync-night вызывала функцию с заголовком
--   Authorization: Bearer REPLACE_ME_SERVICE_ROLE_KEY
-- то есть с незаменённой заглушкой. Функция отвечала 401, а cron.job_run_details
-- показывал «succeeded», потому что net.http_post лишь ставит запрос в очередь
-- и не смотрит на код ответа. Из-за этого raw_finance_report не обновлялся
-- с 3 сентября, а дашборд каждый раз ходил за отчётом в WB напрямую — где
-- лимит один запрос в минуту на продавца.
--
-- Ключ в репозиторий не кладём: задача читает его из Vault во время вызова,
-- поэтому ротация ключа не ломает расписание. Секрет service_role_key должен
-- существовать в vault.secrets; если его нет, берём рабочий заголовок из любой
-- уже настроенной задачи проекта.
-- Safe to re-run.
-- ============================================================

do $$
declare
    v_has_vault boolean;
    v_auth text;
    v_url text := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-finance-sync';
    v_cmd text;
begin
    select exists (
        select 1 from vault.decrypted_secrets where name = 'service_role_key'
    ) into v_has_vault;

    if v_has_vault then
        v_cmd := format(
            $cmd$
  select net.http_post(
    url     := %L,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body    := '{"mode":"sync"}'::jsonb
  );
  $cmd$,
            v_url
        );
    else
        -- Рабочие задачи проекта передают headers json-строкой:
        --   '{"Content-Type":"application/json","Authorization":"Bearer eyJ..."}'::jsonb
        select (regexp_match(command, '"Authorization"\s*:\s*"(Bearer [^"]+)"'))[1]
        into v_auth
        from cron.job
        where command like '%Bearer eyJ%'
          and command not like '%REPLACE_ME%'
        limit 1;

        if v_auth is null then
            raise notice 'Нет ни секрета в Vault, ни рабочего Authorization — расписание не изменено';
            return;
        end if;

        v_cmd := format(
            $cmd$
  select net.http_post(
    url     := %L,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
    body    := '{"mode":"sync"}'::jsonb
  );
  $cmd$,
            v_url,
            v_auth
        );
    end if;

    perform cron.unschedule('rnp-finance-sync-night');
    perform cron.schedule('rnp-finance-sync-night', '10 1,2,3 * * *', v_cmd);
end $$;
