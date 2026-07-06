'use client';

import { useEffect, useRef } from 'react';
import type { KIZRecord } from './types';

interface Props {
  record: KIZRecord;
}

export function LabelPreview({ record }: Props) {
  const eanRef = useRef<HTMLCanvasElement>(null);
  const dmRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const bwipjs = await import('bwip-js');
      if (cancelled) return;

      if (eanRef.current && record.barcode) {
        try {
          await bwipjs.default.toCanvas(eanRef.current, {
            bcid: 'ean13',
            text: record.barcode,
            scale: 2,
            height: 8,
            includetext: true,
          });
        } catch (e) {
          console.warn('EAN render:', e);
        }
      }

      if (dmRef.current && record.kiz) {
        try {
          await bwipjs.default.toCanvas(dmRef.current, {
            bcid: 'datamatrix',
            text: record.kiz.slice(0, 50),
            scale: 3,
          });
        } catch (e) {
          console.warn('DM render:', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [record]);

  return (
    <div className="marking-label border border-white/10 rounded-xl p-3 bg-white print:bg-white print:border-black print:break-after-page print:rounded-none">
      <p className="text-[9px] text-black font-medium leading-tight mb-1 truncate">{record.name}</p>
      <p className="text-[8px] text-gray-600 mb-2">
        Арт: {record.article} · Р: {record.size}
      </p>
      <div className="flex gap-2 items-center">
        <canvas ref={eanRef} className="max-w-[120px]" />
        <canvas ref={dmRef} className="w-12 h-12" />
      </div>
      <p className="text-[6px] text-gray-400 mt-1 break-all">{record.kiz.slice(0, 32)}…</p>
    </div>
  );
}
