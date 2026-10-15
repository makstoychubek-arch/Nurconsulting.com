/** Авторизация cron/ручных вызовов edge functions (service_role key или JWT service_role с проверенной подписью). */
import { isServiceAuthorized as sharedServiceAuthorized } from '../../_shared/service-auth.ts';

export async function isServiceAuthorized(req: Request, serviceKey: string, allowSetup = false): Promise<boolean> {
  if (await sharedServiceAuthorized(req, serviceKey)) return true;
  if (!allowSetup) return false;
  // Значения по умолчанию нет: пока NR_SETUP_SECRET не задан в секретах, этот путь закрыт.
  const secret = (Deno.env.get('NR_SETUP_SECRET') ?? '').trim();
  if (!secret) return false;
  return (req.headers.get('X-NR-Setup-Key') ?? '').trim() === secret;
}
