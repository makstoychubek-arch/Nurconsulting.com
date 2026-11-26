// Выбор своего фото модели по формату (2в1 / 3в1) и цвету. Главное фото WB не используется.
import { PAJAMA_PHOTOS, type PajamaPhoto } from './alina-pajama-photo-assets.ts';
import { normModel } from './alina-razdachi.ts';

export type PajamaShot = { caption: string; bytes: Uint8Array; mime: string; filename: string };

const COLORS: [string, RegExp][] = [
  ['chocolate', /шоколад|шоко/], ['burgundy', /бордо/], ['white', /(?:^|\s)бел/], ['milk', /молоч/], ['cherry', /лапш|вишн|розов|меланж/],
];

export function parseModel(name: string): { format: '2' | '3' | null; color: string | null } {
  const n = ' ' + normModel(name) + ' ';
  const f = n.match(/([23])в1/)?.[1] as '2' | '3' | undefined;
  return { format: f ?? null, color: COLORS.find(([, re]) => re.test(n))?.[0] ?? null };
}

function decode(p: PajamaPhoto): PajamaShot {
  const bin = atob(p.b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { caption: p.caption, bytes, mime: 'image/jpeg', filename: `${p.format}v1-${p.color}.jpg` };
}

/** Фото именно этой модели (формат и цвет совпали). null, если своего фото нет. */
export function pajamaPhotoFor(modelName: string): PajamaShot | null {
  const { format, color } = parseModel(modelName);
  if (!format || !color) return null;
  const p = PAJAMA_PHOTOS.find((x) => x.format === format && x.color === color);
  return p ? decode(p) : null;
}

/** Фото всех моделей из списка названий (без повторов). */
export function pajamaPhotosFor(modelNames: string[]): PajamaShot[] {
  const seen = new Set<string>();
  const out: PajamaShot[] = [];
  for (const m of modelNames) {
    const s = pajamaPhotoFor(m);
    if (s && !seen.has(s.caption)) { seen.add(s.caption); out.push(s); }
  }
  return out;
}

/** Модели, у которых есть свои фото (названия как в листе). */
export const PAJAMA_MODEL_NAMES: string[] = PAJAMA_PHOTOS.map((p) => p.caption);
