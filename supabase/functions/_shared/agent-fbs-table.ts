/**
 * PNG-таблица остатков FBS по размерам (как daily-sales-report).
 */
import { createCanvas } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

export type FbsSizeTableRow = {
  title: string;
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
    ctx.fillText(text, x + w - 8 - tw, y);
  } else if (align === "center") {
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + (w - tw) / 2, y);
  } else {
    ctx.fillText(text, x + 8, y);
  }
}

// deno-lint-ignore no-explicit-any
function fitText(ctx: any, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

function collectSizeKeys(rows: FbsSizeTableRow[]): string[] {
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.sizes)) keys.add(k);
  }
  const list = [...keys];
  list.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, "ru");
  });
  return list.slice(0, 12);
}

/** Рисует таблицу: артикул × размеры × итого. */
export async function renderFbsSizeTablePng(opts: {
  title: string;
  subtitle?: string;
  rows: FbsSizeTableRow[];
}): Promise<Uint8Array> {
  await ensureFonts();
  const rows = opts.rows.filter((r) => r.total > 0 || Object.keys(r.sizes).length);
  const drawRows = rows.length
    ? rows
    : [{ title: "нет данных", sizes: {} as Record<string, number>, total: 0 }];

  const sizeKeys = collectSizeKeys(drawRows);
  const S = 2;
  const articleW = 280;
  const sizeW = 64;
  const totalW = 78;
  const PAD = 14;
  const width = PAD * 2 + articleW + sizeKeys.length * sizeW + totalW;
  const titleH = opts.subtitle ? 64 : 52;
  const headerH = 48;
  const rowH = 38;
  const totalH = 44;
  const height = PAD * 2 + titleH + headerH + drawRows.length * rowH + totalH;

  const canvas = createCanvas(width * S, height * S);
  canvas.loadFont(fontRegular!, { family: "DejaVu" });
  canvas.loadFont(fontBold!, { family: "DejaVu", weight: "bold" });
  const ctx = canvas.getContext("2d");
  ctx.scale(S, S);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 20px DejaVu";
  ctx.textBaseline = "middle";
  ctx.fillText(opts.title.slice(0, 80), PAD, PAD + (opts.subtitle ? 18 : titleH / 2));
  if (opts.subtitle) {
    ctx.fillStyle = "#555555";
    ctx.font = "14px DejaVu";
    ctx.fillText(opts.subtitle.slice(0, 90), PAD, PAD + 42);
  }

  const colX: number[] = [PAD];
  let x = PAD + articleW;
  for (let i = 0; i < sizeKeys.length; i++) {
    colX.push(x);
    x += sizeW;
  }
  colX.push(x);
  const colsW = [articleW, ...sizeKeys.map(() => sizeW), totalW];
  const tableTop = PAD + titleH;
  const tableW = width - PAD * 2;

  ctx.fillStyle = "#c9e7c5";
  ctx.fillRect(PAD, tableTop, tableW, headerH);
  ctx.fillStyle = "#143d14";
  ctx.font = "bold 14px DejaVu";
  drawCell(ctx, "Артикул", colX[0], tableTop + headerH / 2, colsW[0], "left");
  sizeKeys.forEach((sz, i) => {
    drawCell(ctx, sz || "—", colX[i + 1], tableTop + headerH / 2, colsW[i + 1], "center");
  });
  drawCell(
    ctx,
    "Итого",
    colX[colX.length - 1],
    tableTop + headerH / 2,
    totalW,
    "center",
  );

  ctx.font = "14px DejaVu";
  const sizeTotals: Record<string, number> = {};
  let grand = 0;
  drawRows.forEach((r, ri) => {
    const y = tableTop + headerH + ri * rowH;
    if (ri % 2 === 1) {
      ctx.fillStyle = "#f3f7f3";
      ctx.fillRect(PAD, y, tableW, rowH);
    }
    ctx.fillStyle = "#222222";
    const cy = y + rowH / 2;
    drawCell(ctx, fitText(ctx, r.title, articleW - 16), colX[0], cy, articleW, "left");
    sizeKeys.forEach((sz, i) => {
      const q = Number(r.sizes[sz] || 0);
      sizeTotals[sz] = (sizeTotals[sz] || 0) + q;
      drawCell(ctx, q ? String(q) : "·", colX[i + 1], cy, sizeW, "center");
    });
    grand += r.total;
    drawCell(ctx, String(r.total), colX[colX.length - 1], cy, totalW, "center");
  });

  const totalY = tableTop + headerH + drawRows.length * rowH;
  ctx.fillStyle = "#c9e7c5";
  ctx.fillRect(PAD, totalY, tableW, totalH);
  ctx.fillStyle = "#143d14";
  ctx.font = "bold 15px DejaVu";
  const tcy = totalY + totalH / 2;
  drawCell(ctx, "Итого", colX[0], tcy, articleW, "left");
  sizeKeys.forEach((sz, i) => {
    drawCell(ctx, String(sizeTotals[sz] || 0), colX[i + 1], tcy, sizeW, "center");
  });
  drawCell(ctx, String(grand), colX[colX.length - 1], tcy, totalW, "center");

  ctx.strokeStyle = "#dde5dd";
  ctx.lineWidth = 1;
  for (let ri = 0; ri <= drawRows.length; ri++) {
    const y = tableTop + headerH + ri * rowH;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(PAD + tableW, y);
    ctx.stroke();
  }
  const tableBottom = totalY + totalH;
  ctx.strokeStyle = "#c5d5c5";
  for (let ci = 1; ci < colX.length; ci++) {
    ctx.beginPath();
    ctx.moveTo(colX[ci], tableTop);
    ctx.lineTo(colX[ci], tableBottom);
    ctx.stroke();
  }
  ctx.strokeRect(PAD, tableTop, tableW, tableBottom - tableTop);

  return canvas.toBuffer("image/png");
}
