/** Человекочитаемые ярлыки кабинетов для FBS-отчётов. */

const LABELS: Record<string, string> = {
  'zevina 1': 'ИП Уркунбаев',
  zevina1: 'ИП Уркунбаев',
  'zevina 2': 'Zevina 2',
  zevina2: 'Zevina 2',
  saai: 'ИП Дуйшекеева',
  elium: 'Elium',
  baza: 'Baza',
};

export function fbsCabinetLabel(cabinet: string): string {
  const key = String(cabinet || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
  const compact = key.replace(/\s+/g, '');
  return LABELS[key] || LABELS[compact] || cabinet;
}

/** Стабильный порядок кабинетов в отчёте. */
export function sortFbsCabinets(names: string[]): string[] {
  const rank = (n: string): number => {
    const k = n.toLowerCase().replace(/\s+/g, '');
    if (k === 'baza') return 1;
    if (k === 'elium') return 2;
    if (k === 'saai') return 3;
    if (k === 'zevina1' || k === 'zevina') return 4;
    if (k === 'zevina2') return 5;
    return 50;
  };
  return [...names].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ru'),
  );
}
