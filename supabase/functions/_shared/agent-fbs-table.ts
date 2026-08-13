/**
 * PNG сводная остатков FBS — стиль образца:
 * зелёная шапка, бежевые строки, красный «ОБЩИЙ ИТОГ».
 * Колонки: Артикул продавца | Наименование | Остаток, шт
 */
import { createCanvas } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

export type FbsSizeTableRow = {
  /** Артикул продавца (vendorCode) */
  article: string;
  /** Наименование */
  name: string;
  /** @deprecated alias для совместимости — article или name */
  title?: string;
  sizes: Record<string, number>;
  total: number;
};

let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;

async function ensureFonts(): Promise<void> {
  if (fontRegular && fontBold) return;
  const base = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf";
  const [reg, bold] = await Promise.all([
    fetch(`${base}/DejaVuSans.ttf`, { signal: AbortSignal.timeout(20000) }).then((r) => {
      if (!r.ok) throw new Error(`font regular HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch(`${base}/DejaVuSans-Bold.ttf`, { signal: AbortSignal.timeout(20000) }).then((r) => {
      if (!r.ok) throw new Error(`font bold HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);
  fontRegular = new Uint8Array(reg);
  fontBold = new Uint8Array(bold);
}

// deno-lint-ignore no-explicit-any
function drawCell(
  ctx: any,
  text: string,
  x: number,
  y: number,
  w: number,
  align: "left" | "center" | "right",
) {
  if (align === "right") {
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + w - 10 - tw, y);
  } else if (align === "center") {
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + (w - tw) / 2, y);
  } else {
    ctx.fillText(text, x + 10, y);
  }
}

// deno-lint-ignore no-explicit-any
function fitText(ctx: any, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

function normalizeRows(rows: FbsSizeTableRow[]): Array<{
  article: string;
  name: string;
  total: number;
}> {
  return rows
    .filter((r) => r.total > 0)
    .map((r) => ({
      article: (r.article || r.title || "—").trim() || "—",
      name: (r.name || r.title || "—").trim() || "—",
      total: r.total,
    }));
}

/**
 * Сводная таблица как на образце:
 * шапка #1F5C3A белый текст, строки #F5E6C8, итог #B71C1C.
 */
export async function renderFbsSizeTablePng(opts: {
  title: string;
  subtitle?: string;
  rows: FbsSizeTableRow[];
}): Promise<Uint8Array> {
  await ensureFonts();
  const drawRows = normalizeRows(opts.rows);
  const rows = drawRows.length
    ? drawRows
    : [{ article: "—", name: "нет данных", total: 0 }];

  const S = 2;
  const PAD = 0;
  const articleW = 260;
  const nameW = 420;
  const stockW = 120;
  const width = articleW + nameW + stockW;
  const headerH = 44;
  const rowH = 36;
  const totalH = 42;
  const height = headerH + rows.length * rowH + totalH;

  const canvas = createCanvas(width * S, height * S);
  canvas.loadFont(fontRegular!, { family: "DejaVu" });
  canvas.loadFont(fontBold!, { family: "DejaVu", weight: "bold" });
  const ctx = canvas.getContext("2d");
  ctx.scale(S, S);

  // фон
  ctx.fillStyle = "#F5E6C8";
  ctx.fillRect(0, 0, width, height);

  const colX = [0, articleW, articleW + nameW];
  const colsW = [articleW, nameW, stockW];

  // Шапка — тёмно-зелёная, белый текст
  ctx.fillStyle = "#1F5C3A";
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 15px DejaVu";
  ctx.textBaseline = "middle";
  drawCell(ctx, "Артикул продавца", colX[0], headerH / 2, colsW[0], "left");
  drawCell(ctx, "Наименование", colX[1], headerH / 2, colsW[1], "left");
  drawCell(ctx, "Остаток, шт", colX[2], headerH / 2, colsW[2], "center");

  // Строки — бежевый фон, чёрный текст, остаток жирный
  let grand = 0;
  rows.forEach((r, ri) => {
    const y = headerH + ri * rowH;
    ctx.fillStyle = "#F5E6C8";
    ctx.fillRect(0, y, width, rowH);
    ctx.fillStyle = "#1A1A1A";
    ctx.font = "14px DejaVu";
    const cy = y + rowH / 2;
    drawCell(ctx, fitText(ctx, r.article, articleW - 20), colX[0], cy, colsW[0], "left");
    drawCell(ctx, fitText(ctx, r.name, nameW - 20), colX[1], cy, colsW[1], "left");
    ctx.font = "bold 15px DejaVu";
    drawCell(ctx, String(r.total), colX[2], cy, colsW[2], "center");
    grand += r.total;
  });

  // ОБЩИЙ ИТОГ — тёмно-красный, белый
  const totalY = headerH + rows.length * rowH;
  ctx.fillStyle = "#B71C1C";
  ctx.fillRect(0, totalY, width, totalH);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px DejaVu";
  const tcy = totalY + totalH / 2;
  drawCell(ctx, "ОБЩИЙ ИТОГ", colX[0], tcy, articleW + nameW, "left");
  drawCell(ctx, String(grand), colX[2], tcy, colsW[2], "center");

  // Чёрные границы сетки
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1.25;
  const ys = [0, headerH];
  for (let i = 1; i <= rows.length; i++) ys.push(headerH + i * rowH);
  ys.push(height);
  for (const y of ys) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (const x of [0, articleW, articleW + nameW, width]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return canvas.toBuffer("image/png");
}
