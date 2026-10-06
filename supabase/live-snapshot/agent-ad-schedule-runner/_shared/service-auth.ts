// СНИМОК боевой функции «agent-ad-schedule-runner» (версия 9), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
/** Авторизация cron/ручных вызовов edge functions (service_role key или legacy JWT). */ const PROJECT_REF = 'fiukyfyhotctvfdidktx';
export function isServiceAuthorized(req, serviceKey, allowSetup = false) {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (serviceKey && bearer === serviceKey) return true;
  if (isLegacyServiceRoleJwt(bearer)) return true;
  if (!allowSetup) return false;
  const secret = (Deno.env.get('NR_SETUP_SECRET') ?? '<ЗНАЧЕНИЕ УБРАНО>').trim();
  return (req.headers.get('X-NR-Setup-Key') ?? '').trim() === secret;
}
function isLegacyServiceRoleJwt(token) {
  if (!token.startsWith('eyJ')) return false;
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role' && payload?.ref === PROJECT_REF;
  } catch  {
    return false;
  }
}
