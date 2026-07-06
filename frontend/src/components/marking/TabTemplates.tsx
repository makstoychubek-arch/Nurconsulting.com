'use client';

import { useEffect, useState } from 'react';
import type { LabelTemplate } from './types';

const DEFAULT: LabelTemplate = {
  name: 'Объединённая 58×40',
  width: 58,
  height: 40,
  showText: true,
  showEAN: true,
  showDM: true,
  dmOnly: false,
  dmExtra: false,
};

const PRESETS = [
  { label: '58×40 мм (стандарт)', w: 58, h: 40 },
  { label: '70×50 мм (увеличенный)', w: 70, h: 50 },
  { label: '40×25 мм (мини)', w: 40, h: 25 },
];

export function TabTemplates() {
  const [tpl, setTpl] = useState<LabelTemplate>(DEFAULT);

  useEffect(() => {
    const saved = localStorage.getItem('label_template');
    if (saved) {
      try {
        setTpl({ ...DEFAULT, ...JSON.parse(saved) });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const save = () => {
    localStorage.setItem('label_template', JSON.stringify(tpl));
    alert('Шаблон сохранён');
  };

  const toggles: Array<[keyof LabelTemplate, string]> = [
    ['showText', 'Текст товара (название, артикул, размер)'],
    ['showEAN', 'Штрихкод EAN-13 (баркод WB)'],
    ['showDM', 'DataMatrix Честного Знака'],
    ['dmOnly', 'Только Честный Знак (без ШК и текста)'],
    ['dmExtra', 'ЧЗ на отдельной наклейке следом'],
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Размер ленты</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setTpl((t) => ({ ...t, width: p.w, height: p.h }))}
              className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${
                tpl.width === p.w && tpl.height === p.h
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Состав этикетки</div>
        <div className="space-y-3">
          {toggles.map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group min-h-[44px]">
              <button
                type="button"
                role="switch"
                aria-checked={!!tpl[key]}
                onClick={() => setTpl((t) => ({ ...t, [key]: !t[key] }))}
                className={`w-11 h-6 rounded-full border transition-colors duration-200 flex-shrink-0 ${
                  tpl[key] ? 'bg-purple-600 border-purple-500' : 'bg-white/5 border-white/10'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white mt-0.5 transition-transform duration-200 ${
                    tpl[key] ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Схема этикетки</div>
        <div
          className="border border-white/10 rounded-xl bg-white/[0.02] p-3 relative max-w-full"
          style={{ width: `${Math.min(tpl.width * 3, 280)}px`, height: `${tpl.height * 3}px` }}
        >
          {tpl.showText && (
            <div className="absolute top-2 left-2 right-2 h-6 rounded bg-white/10 flex items-center px-2">
              <span className="text-[8px] text-white/40">Название / Артикул / Размер</span>
            </div>
          )}
          {tpl.showEAN && !tpl.dmOnly && (
            <div className="absolute top-10 left-2 w-3/5 h-10 rounded bg-white/10 flex items-center justify-center">
              <span className="text-[8px] text-white/40">EAN-13</span>
            </div>
          )}
          {(tpl.showDM || tpl.dmOnly) && !tpl.dmExtra && (
            <div className="absolute top-10 right-2 w-10 h-10 rounded bg-white/10 flex items-center justify-center">
              <span className="text-[8px] text-white/40">DM</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        className="px-6 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
      >
        💾 Сохранить шаблон
      </button>
    </div>
  );
}
