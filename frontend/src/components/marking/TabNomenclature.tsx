'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WBProduct } from './types';
import { getNomenclature } from './utils/matchBarcode';
import { syncNomenclatureFromWB } from './utils/wbSync';

export function TabNomenclature() {
  const [products, setProducts] = useState<WBProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrand] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setProducts(getNomenclature());
  }, []);

  const syncFromWB = async () => {
    setLoading(true);
    try {
      const all = await syncNomenclatureFromWB();
      setProducts(all);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          p.article.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.sizes.some((s) => s.barcode.includes(q));
        const matchBrand = !brandFilter || p.brand === brandFilter;
        return matchSearch && matchBrand;
      }),
    [products, search, brandFilter],
  );

  const toggle = (id: number) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const goToPrint = (barcode: string) => {
    localStorage.setItem('selected_barcode', barcode);
    document.dispatchEvent(new CustomEvent('switch-tab', { detail: 'print' }));
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по артикулу, баркоду, названию..."
          className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50 transition-colors"
        />
        <select
          value={brandFilter}
          onChange={(e) => setBrand(e.target.value)}
          className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
        >
          <option value="">Все бренды</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={syncFromWB}
          disabled={loading}
          className="px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '⏳ Синхронизация...' : '🔄 Синхронизировать с WB'}
        </button>
      </div>

      <p className="text-sm text-white/40">
        Найдено: {filtered.length} товаров
        {products.length > 0 && ` из ${products.length}`}
      </p>

      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.nmId} className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02]">
            <button
              type="button"
              onClick={() => toggle(p.nmId)}
              className="w-full flex items-center gap-4 px-5 py-4 min-h-[44px] text-left hover:bg-white/[0.03] transition-colors duration-150"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm">{p.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300">{p.brand}</span>
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  Арт: {p.article} · {p.sizes.length} размеров
                </div>
              </div>
              <span className={`text-white/30 transition-transform duration-200 ${expanded.has(p.nmId) ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {expanded.has(p.nmId) && (
              <div className="border-t border-white/5 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-5 py-2.5 text-white/40 font-medium">Размер</th>
                      <th className="text-left px-5 py-2.5 text-white/40 font-medium">WB-размер</th>
                      <th className="text-left px-5 py-2.5 text-white/40 font-medium">Баркод</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.sizes.map((s, i) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-5 py-2.5 text-white">{s.techSize}</td>
                        <td className="px-5 py-2.5 text-white/60">{s.wbSize}</td>
                        <td className="px-5 py-2.5">
                          <button
                            type="button"
                            onClick={() => goToPrint(s.barcode)}
                            className="font-mono text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                          >
                            {s.barcode}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/30">
            {products.length === 0
              ? '📦 Нажмите «Синхронизировать с WB» чтобы загрузить номенклатуру'
              : '🔍 Ничего не найдено'}
          </div>
        )}
      </div>
    </div>
  );
}
