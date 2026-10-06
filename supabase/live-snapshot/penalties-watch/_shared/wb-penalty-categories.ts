// СНИМОК боевой функции «penalties-watch» (версия 25), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// 5 типов отчётов Analytics API для канала «Штрафы» (TASKS §1+3).
export const PENALTY_REPORT_LABELS = {
  measurement_penalties: 'Занижение габаритов',
  warehouse_measurements: 'Замеры склада',
  deductions: 'Подмены / неверные вложения',
  self_buyout: 'Самовыкупы',
  marking: 'Маркировка'
};
export const PENALTY_REPORT_ORDER = [
  'measurement_penalties',
  'warehouse_measurements',
  'deductions',
  'self_buyout',
  'marking'
];
export function emptyReportTotals() {
  return {
    measurement_penalties: 0,
    warehouse_measurements: 0,
    deductions: 0,
    self_buyout: 0,
    marking: 0
  };
}
export function formatReportBreakdown(totals, measurementCount, fmtNum = (n)=>String(Math.round(n))) {
  const lines = [
    '📂 <b>По типам отчётов:</b>'
  ];
  let any = false;
  for (const kind of PENALTY_REPORT_ORDER){
    const sum = totals[kind] || 0;
    if (kind === 'warehouse_measurements') {
      const cnt = measurementCount ?? 0;
      if (cnt <= 0 && sum <= 0) continue;
      any = true;
      lines.push(`• ${PENALTY_REPORT_LABELS[kind]}: <b>${cnt} замеров</b>${sum > 0 ? `, ${fmtNum(sum)} сом` : ''}`);
      continue;
    }
    if (sum <= 0) continue;
    any = true;
    lines.push(`• ${PENALTY_REPORT_LABELS[kind]}: <b>${fmtNum(sum)} сом</b>`);
  }
  return any ? lines.join('\n') : '';
}
export const PENALTY_CATEGORY_LABELS = PENALTY_REPORT_LABELS;
export const PENALTY_CATEGORY_ORDER = PENALTY_REPORT_ORDER;
export function classifyPenaltyReason(_reason, _operName = '') {
  return 'other';
}
export function aggregateByCategory() {
  return new Map();
}
export function formatCategoryBreakdown() {
  return '';
}
