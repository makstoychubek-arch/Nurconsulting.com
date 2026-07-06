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
  cursor?: { nmID?: number; updatedAt?: string; total?: number };
}

interface WbCursor {
  nmID?: number;
  updatedAt?: string;
}

function mapCard(c: WbCard): WBProduct {
  return {
    nmId: c.nmID,
    article: c.vendorCode || '',
    name: c.title || '',
    brand: c.brand || '',
    sizes: (c.sizes || []).map((s) => ({
      barcode: (s.skus || [])[0] || '',
      techSize: s.techSize || '',
      wbSize: s.wbSize || '',
    })),
  };
}

async function syncViaToken(): Promise<WBProduct[]> {
  const token = localStorage.getItem('wb_token_content') || '';
  if (!token) throw new Error('Токен не задан. Зайдите во вкладку "Настройки и Логи".');

  const all: WBProduct[] = [];
  let cursor: WbCursor = {};

  while (true) {
    const body: {
      settings: {
        cursor: { limit: number; nmID?: number; updatedAt?: string };
        filter: { withPhoto: number };
      };
    } = {
      settings: {
        cursor: { limit: 100 },
        filter: { withPhoto: -1 },
      },
    };

    if (cursor.nmID) {
      body.settings.cursor.nmID = cursor.nmID;
      body.settings.cursor.updatedAt = cursor.updatedAt;
    }

    const res = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WB API ${res.status}: ${err}`);
    }

    const json = (await res.json()) as WbCardsResponse;
    const cards = json.cards || [];

    if (cards.length === 0) break;

    cards.forEach((c) => all.push(mapCard(c)));

    if (json.cursor?.nmID) {
      cursor = { nmID: json.cursor.nmID, updatedAt: json.cursor.updatedAt };
    } else {
      break;
    }

    if (all.length > 10000) break;
  }

  return all;
}

async function syncViaProxy(proxy: WbProxyFn): Promise<WBProduct[]> {
  const all: WBProduct[] = [];
  let cursor: WbCursor = {};

  while (true) {
    const data = (await proxy('content_cards', {
      limit: 100,
      withPhoto: -1,
      cursorNmId: cursor.nmID,
      cursorUpdatedAt: cursor.updatedAt,
    })) as WbCardsResponse | null;

    if (!data) throw new Error('Не удалось загрузить номенклатуру. Проверьте кабинет и токен WB.');

    const cards = data.cards || [];
    if (!cards.length) break;

    cards.forEach((c) => all.push(mapCard(c)));

    if (data.cursor?.nmID) {
      cursor = { nmID: data.cursor.nmID, updatedAt: data.cursor.updatedAt };
    } else {
      break;
    }

    if (all.length > 10000) break;
  }

  return all;
}

export async function syncNomenclatureFromWB(): Promise<WBProduct[]> {
  const proxy = (window as Window & { callWbProxy?: WbProxyFn }).callWbProxy;
  const all = proxy ? await syncViaProxy(proxy) : await syncViaToken();
  saveNomenclature(all);
  return all;
}

export function usesWbProxy(): boolean {
  return typeof (window as Window & { callWbProxy?: WbProxyFn }).callWbProxy === 'function';
}
