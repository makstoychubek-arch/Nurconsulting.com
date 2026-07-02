import { useMemo, useState } from 'react';
import { RnpTable } from './components/rnp/RnpTable';
import type { ArticleSummary, CabinetOption, RnpColumn, RnpRow } from './lib/types';

const DEMO_CABINETS: CabinetOption[] = [
  { id: 'all', name: 'Все кабинеты (сводка)' },
  { id: 'cab-1', name: 'Кабинет 1' },
  { id: 'cab-2', name: 'Кабинет 2' },
];

const DEMO_COLUMNS: RnpColumn[] = [
  { id: 'w1', label: 'Нед 1', kind: 'week' },
  { id: 'w2', label: 'Нед 2', kind: 'week' },
  { id: 'tot', label: 'ИТОГ', kind: 'total' },
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `d${i + 1}`,
    label: `${String(i + 1).padStart(2, '0')}.06`,
    kind: 'day' as const,
    isToday: i === 13,
  })),
];

function demoRows(): RnpRow[] {
  return [
    { id: 'sec-sales', section: 'Продажи', label: 'Продажи', values: {} },
    { id: 'orders', section: '', label: 'ЗАКАЗЫ', bold: true, hero: true, values: { w1: 202, w2: 269, tot: 471, d1: 12, d2: 18 } },
    { id: 'plan', section: '', label: 'Процент выполнения плана', bold: true, values: { d1: '118%', d2: '170%', d13: '54%' } },
    { id: 'sec-cash', section: 'Сумма продаж в кассе', label: 'Сумма продаж в кассе', values: {} },
    { id: 'os', section: '', label: 'Сумма Заказов', values: { d1: '124 500', d2: '186 200' } },
  ];
}

function SummaryPanel({ items }: { items: ArticleSummary[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      {items.map((a) => (
        <div key={a.nm_id} className="flex gap-2 rounded border border-graphite-border bg-graphite-cell p-2">
          {a.photo_url ? (
            <img src={a.photo_url} alt="" className="h-10 w-8 rounded object-cover bg-black/40" loading="lazy" />
          ) : (
            <div className="h-10 w-8 rounded bg-black/40" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[10px] font-medium">{a.name || a.nm_id}</div>
            <div className="text-[9px] text-sand-muted">
              {a.orders} зак · {Math.round(a.profit).toLocaleString('ru')} ₽
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [cabinet, setCabinet] = useState('all');
  const rows = useMemo(() => demoRows(), []);
  const summary = useMemo<ArticleSummary[]>(
    () => [
      { nm_id: 742905647, name: 'костюм_рубашка_розовый', photo_url: '', orders: 337, profit: 498943, plan_pct: 98 },
    ],
    [],
  );

  return (
    <div className="min-h-screen p-3 md:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sand">РНП · Рука на пульсе</h1>
          <p className="text-[10px] text-sand-muted">Premium dark · dense grid · TanStack Table</p>
        </div>
        <select
          value={cabinet}
          onChange={(e) => setCabinet(e.target.value)}
          className="rounded border border-graphite-border bg-graphite-cell px-2 py-1 text-[11px] text-[#e8e6e3]"
        >
          {DEMO_CABINETS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </header>

      {cabinet === 'all' && <SummaryPanel items={summary} />}

      <RnpTable rows={rows} columns={DEMO_COLUMNS} compact />
    </div>
  );
}
