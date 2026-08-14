/**
 * Универсальная «сводная»: любые данные, которые бот только что дал,
 * можно попросить «сводная» / «дай в сводную» / «в таблицу» —
 * отдаём PNG-таблицу (или текст, если картинка не собралась).
 *
 * Снимок: agent_pending_actions (action_type=data_snapshot) + isolate-кэш.
 * FBS «сводная по размерам» у Антона не перехватываем.
 */

import { getAdminClient } from './supabase-admin.ts';

export const DATA_SNAPSHOT_ACTION = 'data_snapshot';

export type SummarySnapshot = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  agentKey: string;
  source?: string;
};

const memCache = new Map<number, { at: number; snap: SummarySnapshot }>();
const MEM_TTL_MS = 45 * 60_000;

function admin() {
  return getAdminClient();
}

/** Короткая просьба переложить последние данные в сводную/таблицу. */
export function wantsSummaryReflow(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || t.length > 120) return false;
  // FBS Антона: «сводная по размерам база» — не перехватываем
  if (
    /(фбс|fbs|остат|склад|размер)/i.test(t) &&
    /(сводн|таблиц)/i.test(t) &&
    t.length > 12
  ) {
    return false;
  }
  if (/^(сводн[а-яa-z]*|таблиц[а-яa-z]*)([!.…]*)$/i.test(t)) return true;
  if (/^(в\s+)?(сводн[а-яa-z]*|таблиц[а-яa-z]*)([!.…]*)$/i.test(t)) return true;
  if (/^(дай|сделай|покажи|скинь|выведи)\b/i.test(t) && /(сводн|таблиц)/i.test(t)) {
    return true;
  }
  if (/в\s+сводн/i.test(t)) return true;
  if (/эти\s+данн/i.test(t) && /(сводн|таблиц)/i.test(t)) return true;
  if (/^(красив[а-яa-z]*\s+)?(фото\s+)?таблиц/i.test(t) && t.length < 40) return true;
  return false;
}

export async function saveDataSnapshot(
  chatId: number,
  snap: SummarySnapshot,
): Promise<void> {
  if (!chatId || !snap?.rows?.length) return;
  const clean: SummarySnapshot = {
    title: String(snap.title || 'Сводная').slice(0, 120),
    subtitle: snap.subtitle ? String(snap.subtitle).slice(0, 160) : undefined,
    columns: (snap.columns || []).map((c) => String(c).slice(0, 40)).slice(0, 6),
    rows: snap.rows
      .slice(0, 40)
      .map((r) => r.map((c) => String(c ?? '').slice(0, 80)).slice(0, 6)),
    agentKey: snap.agentKey || 'saule',
    source: snap.source,
  };
  if (!clean.columns.length) {
    clean.columns = Array.from(
      { length: Math.max(1, ...clean.rows.map((r) => r.length)) },
      (_, i) => `Кол.${i + 1}`,
    );
  }
  memCache.set(chatId, { at: Date.now(), snap: clean });

  const db = admin();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 45 * 60_000).toISOString();
  try {
    const { data: existing } = await db
      .from('agent_pending_actions')
      .select('id')
      .eq('chat_id', chatId)
      .eq('action_type', DATA_SNAPSHOT_ACTION)
      .eq('status', 'executing')
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      await db
        .from('agent_pending_actions')
        .update({
          agent_key: clean.agentKey,
          payload: clean,
          expires_at: expires,
          updated_at: now,
        })
        .eq('id', existing.id);
      return;
    }
    await db.from('agent_pending_actions').insert({
      chat_id: chatId,
      agent_key: clean.agentKey,
      action_type: DATA_SNAPSHOT_ACTION,
      status: 'executing',
      payload: clean,
      expires_at: expires,
      created_at: now,
      updated_at: now,
    });
  } catch (e) {
    console.error('[agent-summary] save', e);
  }
}

export async function getDataSnapshot(chatId: number): Promise<SummarySnapshot | null> {
  const mem = memCache.get(chatId);
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return mem.snap;

  const db = admin();
  try {
    const { data } = await db
      .from('agent_pending_actions')
      .select('payload, agent_key')
      .eq('chat_id', chatId)
      .eq('action_type', DATA_SNAPSHOT_ACTION)
      .eq('status', 'executing')
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.payload) return null;
    const p = data.payload as SummarySnapshot;
    if (!p.rows?.length) return null;
    const snap: SummarySnapshot = {
      ...p,
      agentKey: p.agentKey || String(data.agent_key || 'saule'),
    };
    memCache.set(chatId, { at: Date.now(), snap });
    return snap;
  } catch (e) {
    console.error('[agent-summary] get', e);
    return null;
  }
}

/** Разобрать последнее текстовое сообщение бота в таблицу. */
export function parseAgentTextToSnapshot(
  text: string,
  agentKey: string,
): SummarySnapshot | null {
  const raw = String(text || '').trim();
  if (!raw || raw.length < 8) return null;
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const title = lines[0].replace(/^[-•▶]+/, '').trim().slice(0, 100) || 'Сводная';

  // Конкуренты: "1) Brand · name" + "арт. N · price · ★"
  const compRows: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\d+\)\s*(.+)$/);
    if (!m) continue;
    const name = m[1].trim();
    const next = lines[i + 1] || '';
    const art = next.match(/арт\.?\s*(\d{5,12})/i)?.[1] || '';
    const price = next.match(/([\d\s]+)\s*₽/)?.[1]?.replace(/\s/g, '') || '';
    const rating = next.match(/★\s*([\d.]+)/)?.[1] || '';
    const fb = next.match(/([\d\s]+)\s*отз/i)?.[1]?.replace(/\s/g, '') || '';
    compRows.push([art || String(compRows.length + 1), name.slice(0, 60), price, rating, fb]);
  }
  if (compRows.length >= 1) {
    return {
      title,
      columns: ['Арт', 'Товар', 'Цена', '★', 'Отзывы'],
      rows: compRows,
      agentKey,
      source: 'competitors',
    };
  }

  // ▶ кабинет / блоки
  const cabRows: string[][] = [];
  let curCab = '';
  for (const line of lines) {
    const cab = line.match(/^▶\s*(.+)$/);
    if (cab) {
      curCab = cab[1].trim();
      continue;
    }
    if (curCab && /^\s/.test(line) === false && /:/.test(line)) {
      cabRows.push([curCab, line.replace(/^[-•]+/, '').trim().slice(0, 70)]);
    } else if (curCab && line.startsWith('  ')) {
      cabRows.push([curCab, line.trim().slice(0, 70)]);
    }
  }
  if (cabRows.length >= 2) {
    return {
      title,
      columns: ['Кабинет', 'Факт'],
      rows: cabRows.slice(0, 30),
      agentKey,
      source: 'cabinets',
    };
  }

  // буллеты / нумерация
  const bullets = lines
    .map((l) => l.replace(/^[-•●◦*]+\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
    .filter((l, idx) => idx > 0 && l.length >= 2 && !/^https?:/i.test(l));
  if (bullets.length >= 2) {
    const rows = bullets.slice(0, 30).map((l, i) => {
      const kv = l.match(/^(.{2,40}?)\s*[:—–-]\s*(.+)$/);
      if (kv) return [kv[1].trim(), kv[2].trim().slice(0, 70)];
      return [String(i + 1), l.slice(0, 80)];
    });
    const twoCol = rows.every((r) => r.length === 2);
    return {
      title,
      columns: twoCol ? ['Параметр', 'Значение'] : ['№', 'Строка'],
      rows,
      agentKey,
      source: 'bullets',
    };
  }

  // fallback: все строки кроме заголовка
  const body = lines.slice(1).filter((l) => !/^https?:/i.test(l)).slice(0, 25);
  if (body.length < 1) return null;
  return {
    title,
    columns: ['№', 'Строка'],
    rows: body.map((l, i) => [String(i + 1), l.slice(0, 80)]),
    agentKey,
    source: 'raw',
  };
}

// deno-lint-ignore no-explicit-any
function drawCell(
  ctx: any,
  text: string,
  x: number,
  y: number,
  w: number,
  align: 'left' | 'center' | 'right',
) {
  if (align === 'right') {
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + w - 8 - tw, y);
  } else if (align === 'center') {
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
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

/** PNG-сводная в стиле FBS-таблицы (зелёная шапка). */
export async function renderSummaryTablePng(snap: SummarySnapshot): Promise<Uint8Array> {
  const { createCanvas } = await import('https://deno.land/x/canvas@v1.4.2/mod.ts');
  const base = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';
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
  const fontRegular = new Uint8Array(reg);
  const fontBold = new Uint8Array(bold);

  const cols = snap.columns.length
    ? snap.columns
    : Array.from({ length: snap.rows[0]?.length || 2 }, (_, i) => `Кол.${i + 1}`);
  const n = Math.min(6, Math.max(cols.length, ...snap.rows.map((r) => r.length)));
  const columns = cols.slice(0, n);
  while (columns.length < n) columns.push(`Кол.${columns.length + 1}`);
  const rows = snap.rows.slice(0, 35).map((r) => {
    const out = r.slice(0, n).map((c) => String(c ?? ''));
    while (out.length < n) out.push('');
    return out;
  });

  // ширины: первая колонка уже, последняя уже если короткое, середина шире
  const widths: number[] = [];
  for (let i = 0; i < n; i++) {
    if (n === 2) widths.push(i === 0 ? 200 : 500);
    else if (n === 3) widths.push(i === 0 ? 160 : i === 1 ? 420 : 140);
    else if (n === 4) widths.push(i === 0 ? 140 : i === 1 ? 320 : 120);
    else if (n === 5) widths.push(i === 0 ? 120 : i === 1 ? 280 : 110);
    else widths.push(Math.max(90, Math.floor(780 / n)));
  }
  // normalize to sum ~800
  const sumW = widths.reduce((a, b) => a + b, 0);
  const target = Math.max(640, Math.min(1000, sumW));
  const scale = target / sumW;
  for (let i = 0; i < widths.length; i++) widths[i] = Math.round(widths[i] * scale);

  const S = 2;
  const width = widths.reduce((a, b) => a + b, 0);
  const titleH = snap.subtitle ? 52 : 36;
  const headerH = 40;
  const rowH = 34;
  const height = titleH + headerH + rows.length * rowH;

  const canvas = createCanvas(width * S, height * S);
  canvas.loadFont(fontRegular, { family: 'DejaVu' });
  canvas.loadFont(fontBold, { family: 'DejaVu', weight: 'bold' });
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);

  ctx.fillStyle = '#F5E6C8';
  ctx.fillRect(0, 0, width, height);

  // title band
  ctx.fillStyle = '#0F3D2E';
  ctx.fillRect(0, 0, width, titleH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px DejaVu';
  ctx.textBaseline = 'middle';
  drawCell(ctx, fitText(ctx, snap.title, width - 20), 0, snap.subtitle ? 16 : titleH / 2, width, 'left');
  if (snap.subtitle) {
    ctx.font = '12px DejaVu';
    ctx.fillStyle = '#D7EDE2';
    drawCell(ctx, fitText(ctx, snap.subtitle, width - 20), 0, 36, width, 'left');
  }

  // header
  const headY = titleH;
  ctx.fillStyle = '#1F5C3A';
  ctx.fillRect(0, headY, width, headerH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px DejaVu';
  let x = 0;
  for (let i = 0; i < n; i++) {
    drawCell(
      ctx,
      fitText(ctx, columns[i], widths[i] - 12),
      x,
      headY + headerH / 2,
      widths[i],
      i === n - 1 && n > 2 ? 'center' : 'left',
    );
    x += widths[i];
  }

  rows.forEach((r, ri) => {
    const y = titleH + headerH + ri * rowH;
    ctx.fillStyle = ri % 2 === 0 ? '#F5E6C8' : '#EFE0C0';
    ctx.fillRect(0, y, width, rowH);
    ctx.fillStyle = '#1A1A1A';
    ctx.font = '13px DejaVu';
    let cx = 0;
    for (let i = 0; i < n; i++) {
      const align = i === n - 1 && n > 2 && /^[\d\s₽%.★.,-]+$/.test(r[i]) ? 'center' : 'left';
      if (align === 'center') ctx.font = 'bold 13px DejaVu';
      else ctx.font = '13px DejaVu';
      drawCell(
        ctx,
        fitText(ctx, r[i] || '—', widths[i] - 12),
        cx,
        y + rowH / 2,
        widths[i],
        align,
      );
      cx += widths[i];
    }
  });

  // grid
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.1;
  const ys = [0, titleH, titleH + headerH];
  for (let i = 1; i <= rows.length; i++) ys.push(titleH + headerH + i * rowH);
  for (const y of ys) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  let gx = 0;
  const xs = [0];
  for (const w of widths) {
    gx += w;
    xs.push(gx);
  }
  for (const vx of xs) {
    ctx.beginPath();
    ctx.moveTo(vx, titleH);
    ctx.lineTo(vx, height);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return canvas.toBuffer('image/png');
}

export function formatSummaryText(snap: SummarySnapshot): string {
  const head = snap.subtitle ? `${snap.title}\n${snap.subtitle}` : snap.title;
  const cols = snap.columns;
  const lines = [head, cols.join(' | ')];
  for (const r of snap.rows.slice(0, 25)) {
    lines.push(r.map((c, i) => c || '—').join(' | '));
  }
  return lines.join('\n');
}

export type SummaryReply = {
  handled: boolean;
  agentKey: string;
  reply: string;
  photo?: Uint8Array;
  caption?: string;
};

/**
 * Собрать сводную: снимок → иначе последнее сообщение агента из истории.
 */
export async function buildSummaryReply(opts: {
  chatId: number;
  preferredAgent?: string | null;
  history?: Array<{ sender: string; text: string }>;
}): Promise<SummaryReply> {
  let snap = await getDataSnapshot(opts.chatId);

  if (!snap && opts.history?.length) {
    const agents = new Set([
      'saule',
      'amina',
      'anton',
      'alina',
      'muha',
      'karina',
      'Сауле',
      'Амина',
      'Антон',
      'Алина',
      'Муха',
      'Карина',
    ]);
    const mapName: Record<string, string> = {
      сауле: 'saule',
      амина: 'amina',
      антон: 'anton',
      алина: 'alina',
      муха: 'muha',
      карина: 'karina',
    };
    for (let i = opts.history.length - 1; i >= 0; i--) {
      const h = opts.history[i];
      const raw = String(h.sender || '');
      const low = raw.toLowerCase();
      let agent = mapName[low] || (agents.has(raw) ? low : '');
      if (!agent && ['saule', 'amina', 'anton', 'alina', 'muha', 'karina'].includes(low)) {
        agent = low;
      }
      if (!agent) continue;
      const parsed = parseAgentTextToSnapshot(h.text, agent);
      if (parsed) {
        snap = parsed;
        await saveDataSnapshot(opts.chatId, parsed);
        break;
      }
    }
  }

  if (!snap) {
    const who = opts.preferredAgent || 'saule';
    return {
      handled: true,
      agentKey: who,
      reply:
        'Не вижу свежих данных для сводной. Спроси цифры / конкурентов / остатки ещё раз — и скажи «сводная».',
    };
  }

  const agentKey = opts.preferredAgent || snap.agentKey || 'saule';
  try {
    const photo = await renderSummaryTablePng(snap);
    return {
      handled: true,
      agentKey,
      reply: 'Сводная — на фото',
      photo,
      caption: `${snap.title}${snap.subtitle ? ` · ${snap.subtitle}` : ''}`.slice(0, 200),
    };
  } catch (e) {
    console.error('[agent-summary] png', e);
    return {
      handled: true,
      agentKey,
      reply: formatSummaryText(snap),
    };
  }
}

/** Хелпер: сохранить снимок из готовых колонок (конкуренты, продажи…). */
export function snapshotFromPairs(
  title: string,
  agentKey: string,
  rows: Array<Record<string, string | number>>,
  columnOrder?: string[],
): SummarySnapshot | null {
  if (!rows.length) return null;
  const cols = columnOrder?.length
    ? columnOrder
    : Object.keys(rows[0]).slice(0, 6);
  return {
    title,
    agentKey,
    columns: cols,
    rows: rows.map((r) => cols.map((c) => String(r[c] ?? ''))),
  };
}
