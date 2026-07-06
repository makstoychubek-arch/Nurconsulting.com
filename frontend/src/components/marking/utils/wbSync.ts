import type { WBProduct } from '../types';
import { saveNomenclature } from './matchBarcode';

type WbProxyFn = (action: string, params: Record<string, unknown>) => Promise<unknown>;

interface WbCard {
  nmID: number;
  vendorCode: string;
  title: string;
  brand: string;
  sizes?: Array<{
    skus?: string[];
    techSize?: string;
    wbSize?: string;
  }>;
}

interface WbCardsResponse {
  cards?: WbCard[];
  cursor?: { nmID?: number; total?: number };
}

function mapCard(c: WbCard): WBProduct {
  return {
    nmId: c.nmID,
    article: c.vendorCode,
    name: c.title,
    brand: c.brand,
    sizes: (c.sizes || []).map((s) => ({
      barcode: s.skus?.[0] || '',
      techSize: s.techSize || '',
      wbSize: s.wbSize || '',
    })),
  };
}

export async function syncNomenclatureFromWB(): Promise<WBProduct[]> {
  const proxy = (window as Window & { callWbProxy?: WbProxyFn }).callWbProxy;

  if (proxy) {
    const all: WBProduct[] = [];
    let cursorNmId: number | undefined;

    while (true) {
      const data = (await proxy('content_cards', {
        limit: 100,
        withPhoto: -1,
        cursorNmId,
      })) as WbCardsResponse | null;

      if (!data) throw new Error('Не удалось загрузить номенклатуру. Проверьте кабинет и токен WB.');

      const cards = data.cards || [];
      if (!cards.length) break;

      cards.forEach((c) => all.push(mapCard(c)));
      cursorNmId = data.cursor?.nmID;
      if (!cursorNmId) break;
    }

    saveNomenclature(all);
    return all;
  }

  const token = localStorage.getItem('wb_token_content') || '';
  if (!token) throw new Error('Токен не задан. Зайдите в Настройки.');

  let cursor = 0;
  const all: WBProduct[] = [];

  while (true) {
    const url = `https://content-api.wildberries.ru/content/v2/get/cards/list?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) throw new Error(`WB API: ${res.status} ${res.statusText}`);

    const json = (await res.json()) as WbCardsResponse;
    const cards = json.cards || [];
    if (!cards.length) break;

    cards.forEach((c) => all.push(mapCard(c)));
    cursor = json.cursor?.nmID || 0;
    if (!cursor) break;
  }

  saveNomenclature(all);
  return all;
}

export function usesWbProxy(): boolean {
  return typeof (window as Window & { callWbProxy?: WbProxyFn }).callWbProxy === 'function';
}
