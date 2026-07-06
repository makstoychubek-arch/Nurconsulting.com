'use client';

import { useCallback, useRef, useState } from 'react';
import { LabelPreview } from './LabelPreview';
import type { KIZRecord } from './types';
import { matchBarcodes } from './utils/matchBarcode';
import { parseKIZFromFile } from './utils/parseKIZ';
import { generatePDFRoll } from './utils/generatePDF';
import { saveSessionLog } from './utils/sessionLog';

export function TabPrintStick() {
  const [records, setRecords] = useState<KIZRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    setWarnings([]);
    try {
      const rawKIZ = await parseKIZFromFile(file);
      if (!rawKIZ.length) throw new Error('КИЗ не найдены в файле.');

      const unique = [...new Set(rawKIZ)];
      const dupCount = rawKIZ.length - unique.length;
      const warnList: string[] = [];
      if (dupCount > 0) warnList.push(`⚠️ Удалено дублей: ${dupCount}`);

      const matched = await matchBarcodes(unique);
      const unmatched = matched.filter((r) => !r.matched).length;
      if (unmatched > 0) warnList.push(`⚠️ Не найдено в номенклатуре: ${unmatched} кодов`);

      setWarnings(warnList);
      setRecords(matched);

      saveSessionLog({
        total: matched.length,
        matched: matched.filter((r) => r.matched).length,
        duplicates: dupCount,
        errors: unmatched,
      });
    } catch (err) {
      setWarnings([`❌ Ошибка обработки: ${(err as Error).message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      await generatePDFRoll(records);
    } finally {
      setLoading(false);
    }
  };

  const matchedCount = records.filter((r) => r.matched).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
          isDragOver
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
        }`}
      >
        <input ref={fileRef} type="file" accept=".csv,.pdf" className="hidden" onChange={handleFileChange} />
        <div className="text-4xl mb-3">📂</div>
        <p className="text-white font-medium">Перетащите CSV или PDF с КИЗ сюда</p>
        <p className="text-white/40 text-sm mt-1">Поддерживаются файлы выгрузки Честного Знака &quot;Текшер&quot;</p>
        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-purple-400">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Обработка файла...</span>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-400">
              {w}
            </p>
          ))}
        </div>
      )}

      {records.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-2xl font-bold text-white">{records.length}</div>
            <div className="text-xs text-white/40 mt-1">Всего КИЗ</div>
          </div>
          <div className="flex-1 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-2xl font-bold text-purple-300">{matchedCount}</div>
            <div className="text-xs text-white/40 mt-1">Сопоставлено</div>
          </div>
          <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-2xl font-bold text-white/70">{records.length - matchedCount}</div>
            <div className="text-xs text-white/40 mt-1">Не найдено</div>
          </div>
        </div>
      )}

      {matchedCount > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-semibold transition-colors duration-200"
          >
            🖨️ Массовая печать
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] text-white text-sm font-medium transition-colors duration-200 disabled:opacity-50"
          >
            📥 Скачать PDF-ленту
          </button>
        </div>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 print:grid-cols-1">
          {records
            .filter((r) => r.matched)
            .map((rec, i) => (
              <LabelPreview key={`${rec.kiz}-${i}`} record={rec} />
            ))}
        </div>
      )}
    </div>
  );
}
