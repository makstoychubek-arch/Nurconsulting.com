// СНИМОК боевой функции «morning-digest» (версия 28), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Выбор WB-токена по категории API (Аналитика / Продвижение / общий).
const TOKEN_SELECT = 'id, name, wb_token, wb_token_analytics, wb_token_promotion';
export { TOKEN_SELECT as CABINET_TOKEN_SELECT };
export function sanitizeWbToken(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}
export function isValidWbToken(token) {
  return token.length >= 50;
}
export function pickCabinetToken(cab, category) {
  const fallback = sanitizeWbToken(cab.wb_token);
  if (category === 'analytics') {
    const t = sanitizeWbToken(cab.wb_token_analytics);
    return isValidWbToken(t) ? t : fallback;
  }
  if (category === 'promotion') {
    const t = sanitizeWbToken(cab.wb_token_promotion);
    return isValidWbToken(t) ? t : fallback;
  }
  return fallback;
}
