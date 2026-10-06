// СНИМОК боевой функции «daily-fbs-report» (версия 22), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
/** Человекочитаемые ярлыки кабинетов для FBS-отчётов. */ const LABELS = {
  'zevina 1': 'ИП Уркунбаев',
  zevina1: 'ИП Уркунбаев',
  'zevina 2': 'Zevina 2',
  zevina2: 'Zevina 2',
  saai: 'ИП Дуйшекеева',
  elium: 'Elium',
  baza: 'Baza'
};
export function fbsCabinetLabel(cabinet) {
  const key = String(cabinet || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const compact = key.replace(/\s+/g, '');
  return LABELS[key] || LABELS[compact] || cabinet;
}
/** Стабильный порядок кабинетов в отчёте. */ export function sortFbsCabinets(names) {
  const rank = (n)=>{
    const k = n.toLowerCase().replace(/\s+/g, '');
    if (k === 'baza') return 1;
    if (k === 'elium') return 2;
    if (k === 'saai') return 3;
    if (k === 'zevina1' || k === 'zevina') return 4;
    if (k === 'zevina2') return 5;
    return 50;
  };
  return [
    ...names
  ].sort((a, b)=>rank(a) - rank(b) || a.localeCompare(b, 'ru'));
}
