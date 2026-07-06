'use client';

import { useEffect, useState } from 'react';
import { TabNomenclature } from './TabNomenclature';
import { TabPrintStick } from './TabPrintStick';
import { TabSettings } from './TabSettings';
import { TabTemplates } from './TabTemplates';

const TABS = [
  { id: 'print', label: '🖨️ Печать и Склейка' },
  { id: 'nomen', label: '📦 Номенклатура' },
  { id: 'tpl', label: '🎨 Конструктор шаблонов' },
  { id: 'settings', label: '⚙️ Настройки и Логи' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function MarkingModule() {
  const [activeTab, setActiveTab] = useState<TabId>('print');

  useEffect(() => {
    const onSwitch = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (TABS.some((t) => t.id === detail)) setActiveTab(detail as TabId);
    };
    document.addEventListener('switch-tab', onSwitch);
    return () => document.removeEventListener('switch-tab', onSwitch);
  }, []);

  return (
    <div className="marking-module min-h-[60vh] text-white">
      <div className="border-b border-white/5 px-4 sm:px-6 py-5">
        <h1 className="text-xl font-bold text-white">Маркировка и Штрихкоды</h1>
        <p className="text-sm text-white/40 mt-1">Zero-Storage — вся обработка в браузере, данные не хранятся на сервере</p>
      </div>

      <div className="border-b border-white/5 px-4 sm:px-6">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 min-h-[44px] text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'print' && <TabPrintStick />}
        {activeTab === 'nomen' && <TabNomenclature />}
        {activeTab === 'tpl' && <TabTemplates />}
        {activeTab === 'settings' && <TabSettings />}
      </div>
    </div>
  );
}
