// СНИМОК боевой функции «agent-morning-greeting-runner» (версия 13), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
/**
 * Один Supabase admin-клиент на isolate — меньше аллокаций на hot-path.
 */ import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
let cached = null;
export function getAdminClient() {
  if (cached) return cached;
  cached = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  return cached;
}
