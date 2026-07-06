import type { KIZRecord, WBProduct } from '../types';
import { extractGTIN } from './parseKIZ';

const NOMENCLATURE_KEY = 'wb_nomenclature';

export function getNomenclature(): WBProduct[] {
  try {
    const raw = localStorage.getItem(NOMENCLATURE_KEY);
    return raw ? (JSON.parse(raw) as WBProduct[]) : [];
  } catch {
    return [];
  }
}

export function saveNomenclature(products: WBProduct[]) {
  localStorage.setItem(NOMENCLATURE_KEY, JSON.stringify(products));
}

export async function matchBarcodes(kizList: string[]): Promise<KIZRecord[]> {
  const products = getNomenclature();
  if (products.length === 0) {
    console.warn('Номенклатура пуста — синхронизируйте данные во вкладке "Номенклатура"');
  }

  const byBarcode = new Map<string, { product: WBProduct; size: WBProduct['sizes'][0] }>();
  const byBarcode12 = new Map<string, string>();

  for (const p of products) {
    for (const s of p.sizes) {
      const bc = s.barcode?.trim();
      if (!bc) continue;
      byBarcode.set(bc, { product: p, size: s });
      if (bc.length >= 12) byBarcode12.set(bc.slice(0, 12), bc);
    }
  }

  return kizList.map((kiz) => {
    const gtin = extractGTIN(kiz);
    const base: Omit<KIZRecord, 'matched' | 'barcode' | 'article' | 'name' | 'color' | 'size'> = {
      kiz,
      gtin,
    };

    if (!gtin) {
      return { ...base, barcode: '', article: '', name: '', color: '', size: '', matched: false };
    }

    if (byBarcode.has(gtin)) {
      const e = byBarcode.get(gtin)!;
      return {
        ...base,
        barcode: gtin,
        article: e.product.article,
        name: `${e.product.brand} ${e.product.name}`,
        color: '',
        size: e.size.techSize,
        matched: true,
      };
    }

    const ean13 = gtin.replace(/^0/, '');
    if (byBarcode.has(ean13)) {
      const e = byBarcode.get(ean13)!;
      return {
        ...base,
        barcode: ean13,
        article: e.product.article,
        name: `${e.product.brand} ${e.product.name}`,
        color: '',
        size: e.size.techSize,
        matched: true,
      };
    }

    const key12 = gtin.slice(1, 13);
    const bc12 = byBarcode12.get(key12);
    if (bc12) {
      const e = byBarcode.get(bc12)!;
      return {
        ...base,
        barcode: bc12,
        article: e.product.article,
        name: `${e.product.brand} ${e.product.name}`,
        color: '',
        size: e.size.techSize,
        matched: true,
      };
    }

    const key12b = ean13.slice(0, 12);
    const bc12b = byBarcode12.get(key12b);
    if (bc12b) {
      const e = byBarcode.get(bc12b)!;
      return {
        ...base,
        barcode: bc12b,
        article: e.product.article,
        name: `${e.product.brand} ${e.product.name}`,
        color: '',
        size: e.size.techSize,
        matched: true,
      };
    }

    return { ...base, barcode: '', article: '', name: '', color: '', size: '', matched: false };
  });
}
