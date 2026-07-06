import type { KIZRecord, WBProduct } from '../types';
import { extractGTIN } from './parseKIZ';

const NOMENCLATURE_KEY = 'wb_nomenclature';

export function getNomenclature(): WBProduct[] {
  try {
    const raw = localStorage.getItem(NOMENCLATURE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNomenclature(products: WBProduct[]) {
  localStorage.setItem(NOMENCLATURE_KEY, JSON.stringify(products));
}

export async function matchBarcodes(kizList: string[]): Promise<KIZRecord[]> {
  const products = getNomenclature();
  const barcodeIndex = new Map<string, { product: WBProduct; size: WBProduct['sizes'][0] }>();

  for (const p of products) {
    for (const s of p.sizes) {
      if (s.barcode) barcodeIndex.set(s.barcode, { product: p, size: s });
    }
  }

  const gtinToBarcodeIndex = new Map<string, string>();
  for (const [barcode] of barcodeIndex) {
    const key = barcode.slice(0, 12);
    gtinToBarcodeIndex.set(key, barcode);
  }

  return kizList.map((kiz) => {
    const gtin = extractGTIN(kiz);
    if (!gtin) {
      return { kiz, gtin: '', barcode: '', article: '', name: '', color: '', size: '', matched: false };
    }

    const gtinKey = gtin.slice(1, 13);
    const barcode = gtinToBarcodeIndex.get(gtinKey) || '';
    const entry = barcode ? barcodeIndex.get(barcode) : undefined;

    if (entry) {
      return {
        kiz,
        gtin,
        barcode: entry.size.barcode,
        article: entry.product.article,
        name: `${entry.product.brand} ${entry.product.name}`.trim(),
        color: '',
        size: entry.size.techSize,
        matched: true,
      };
    }

    return { kiz, gtin, barcode: '', article: '', name: '', color: '', size: '', matched: false };
  });
}
