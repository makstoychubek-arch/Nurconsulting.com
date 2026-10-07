-- Аудит безопасности: rnp_recompute_finance — SECURITY DEFINER без проверки доступа,
-- а EXECUTE был у anon/authenticated. Вызывает её только Edge-функция rnp-finance-sync
-- через service_role, поэтому закрываем остальным.
revoke execute on function public.rnp_recompute_finance(uuid, date, date) from public, anon, authenticated;
grant execute on function public.rnp_recompute_finance(uuid, date, date) to service_role;
