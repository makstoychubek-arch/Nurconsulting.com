/**
 * Один Supabase admin-клиент на isolate — меньше аллокаций на hot-path.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  return cached;
}
