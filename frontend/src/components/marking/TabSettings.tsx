'use client';

import { useEffect, useState } from 'react';
import { clearSessionLogs, getSessionLogs } from './utils/sessionLog';
import { usesWbProxy } from './utils/wbSync';

export function TabSettings() {
  const [tokenContent, setTokenContent] = useState('');
  const [tokenMarketplace, setTokenMarketplace] = useState('');
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState(getSessionLogs());
  const proxyMode = usesWbProxy();

  useEffect(() => {
    setTokenContent(localStorage.getItem('wb_token_content') || '');
    setTokenMarketplace(localStorage.getItem('wb_token_marketplace') || '');
    setLogs(getSessionLogs());
  }, []);

  const save = () => {
    localStorage.setItem('wb_token_content', tokenContent.trim());
    localStorage.setItem('wb_token_marketplace', tokenMarketplace.trim());
    setStatus('✅ Токены сохранены');
    setTimeout(() => setStatus(''), 3000);
  };

  const testToken = async (token: string, type: 'content' | 'marketplace') => {
    setStatus('⏳ Проверка соединения...');
    try {
      const url =
        type === 'content'
          ? 'https://content-api.wildberries.ru/content/v2/get/cards/list?limit=1'
          : 'https://marketplace-api.wildberries.ru/api/v3/supplies?limit=1';
      const res = await fetch(url, { headers: { Authorization: token.trim() } });
      setStatus(res.ok ? '✅ Подключение успешно!' : `❌ Ошибка ${res.status}: ${res.statusText}`);
    } catch (e) {
      setStatus(`❌ Сетевая ошибка: ${(e as Error).message}`);
    }
    setTimeout(() => setStatus(''), 5000);
  };

  const handleClearLogs = () => {
    clearSessionLogs();
    setLogs([]);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {proxyMode ? (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-sm text-white/70">
          NR Space использует защищённый WB Proxy с токеном выбранного кабинета. Ручные токены нужны только при
          автономном запуске модуля.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-white/40 uppercase tracking-widest">Токены WB API</div>

          {[
            {
              label: 'Токен «Контент» (для номенклатуры)',
              key: 'content' as const,
              val: tokenContent,
              set: setTokenContent,
            },
            {
              label: 'Токен «Маркетплейс» (для поставок)',
              key: 'marketplace' as const,
              val: tokenMarketplace,
              set: setTokenMarketplace,
            },
          ].map(({ label, key, val, set }) => (
            <div key={key} className="space-y-2">
              <div className="text-sm text-white/60">{label}</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder="eyJhbGciOiJFUzI1NiIs..."
                  className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white font-mono placeholder-white/20 outline-none focus:border-purple-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => testToken(val, key)}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl border border-white/10 text-white/60 hover:border-white/20 hover:text-white text-sm transition-colors whitespace-nowrap"
                >
                  Проверить
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={save}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
          >
            💾 Сохранить токены
          </button>
        </div>
      )}

      {status && (
        <p
          className={`text-sm ${
            status.startsWith('✅')
              ? 'text-green-400'
              : status.startsWith('❌')
                ? 'text-red-400'
                : 'text-white/60'
          }`}
        >
          {status}
        </p>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-white/40 uppercase tracking-widest">Лог сессий</div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="text-xs text-white/30 hover:text-white/60 transition-colors min-h-[44px] px-2"
            >
              Очистить
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-white/30 py-6 text-center">Сессий ещё не было</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Дата/Время', 'Всего КИЗ', 'Сопоставлено', 'Дублей', 'Ошибок'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-white/40 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="px-4 py-2.5 text-white/60">{new Date(log.ts).toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-2.5 text-white">{log.total}</td>
                    <td className="px-4 py-2.5 text-purple-300">{log.matched}</td>
                    <td className="px-4 py-2.5 text-amber-400">{log.duplicates}</td>
                    <td className="px-4 py-2.5 text-white/50">{log.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
