// СНИМОК боевой функции «penalties-watch» (версия 25), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Сторож штрафов: абсолютный порог и % от оборота (выкупы за день).
export function getGuardConfig() {
  return {
    absThreshold: Number(Deno.env.get('PENALTY_GUARD_ABS')) || 0,
    pctThreshold: Number(Deno.env.get('PENALTY_GUARD_PCT')) || 0,
    instantThreshold: Number(Deno.env.get('PENALTY_INSTANT_THRESHOLD')) || 500
  };
}
export function checkPenaltyGuard(penaltyTotal, turnover, config = getGuardConfig()) {
  const reasons = [];
  const penaltyPct = turnover > 0 ? penaltyTotal / turnover * 100 : penaltyTotal > 0 ? 100 : 0;
  if (config.instantThreshold > 0 && penaltyTotal >= config.instantThreshold) {
    reasons.push('instant');
  }
  if (config.absThreshold > 0 && penaltyTotal >= config.absThreshold) {
    reasons.push('abs');
  }
  if (config.pctThreshold > 0 && turnover > 0 && penaltyPct >= config.pctThreshold) {
    reasons.push('pct');
  }
  return {
    triggered: reasons.length > 0,
    reasons,
    penaltyTotal,
    turnover,
    penaltyPct
  };
}
export function formatGuardAlert(cabinetName, date, guard, alertUser) {
  const fmt = (n)=>Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  const [y, m, d] = date.split('-');
  const pretty = `${d}.${m}.${y}`;
  const lines = [
    `🚨 <b>Сторож штрафов · ${esc(cabinetName)}</b>`,
    `📅 ${pretty}`,
    `💸 Штрафы: <b>${fmt(guard.penaltyTotal)} сом</b>`
  ];
  if (guard.turnover > 0) {
    lines.push(`📊 Оборот (выкупы): ${fmt(guard.turnover)} сом · <b>${guard.penaltyPct.toFixed(1)}%</b> от оборота`);
  }
  const tags = [];
  if (guard.reasons.includes('instant')) tags.push(`≥ ${fmt(getGuardConfig().instantThreshold)} сом`);
  if (guard.reasons.includes('abs')) tags.push(`≥ ${fmt(getGuardConfig().absThreshold)} сом (лимит)`);
  if (guard.reasons.includes('pct')) tags.push(`≥ ${getGuardConfig().pctThreshold}% от оборота`);
  if (tags.length) lines.push(`⚠️ Триггер: ${tags.join(', ')}`);
  if (alertUser) lines.push(`@${esc(alertUser.replace(/^@/, ''))} — <b>нужно разобраться</b>`);
  return lines.join('\n');
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
