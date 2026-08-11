// Краткая сводка WB по всем кабинетам для Telegram-агентов.
// Цель: коротко, цифры, без простыней.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STATS_API = 'https://statistics-api.wildberries.ru';

export type AgentKey = 'karina' | 'saule' | 'amina' | 'anton' | 'alina' | 'muha';

function sanitizeWbToken(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function yesterdayBishkek(): string {
  const now = new Date(Date.now() + 6 * 3600 * 1000);
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

function todayBishkek(): string {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

function pretty(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
}

async function wbGetArray(url: string, token: string): Promise<unknown[]> {
  const res = await fetch(url, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

type DayTotals = {
  ordersCount: number;
  ordersSum: number;
  buyoutsCount: number;
  buyoutsSum: number;
  cancels: number;
  topArticles: Array<{ article: string; qty: number; sum: number }>;
};

// deno-lint-ignore no-explicit-any
function summarizeDay(orders: any[], sales: any[]): DayTotals {
  const byArt = new Map<string, { qty: number; sum: number }>();
  let ordersCount = 0;
  let ordersSum = 0;
  let cancels = 0;
  for (const o of orders || []) {
    if (o?.isCancel) {
      cancels++;
      continue;
    }
    ordersCount++;
    const sum = Number(o?.priceWithDisc ?? o?.totalPrice ?? 0);
    ordersSum += sum;
    const art = String(o?.supplierArticle || o?.nmId || '?').trim();
    const cur = byArt.get(art) || { qty: 0, sum: 0 };
    cur.qty += 1;
    cur.sum += sum;
    byArt.set(art, cur);
  }
  let buyoutsCount = 0;
  let buyoutsSum = 0;
  for (const s of sales || []) {
    const saleId = String(s?.saleID || '');
    if (saleId && !saleId.startsWith('S')) continue;
    buyoutsCount++;
    buyoutsSum += Number(s?.priceWithDisc ?? s?.forPay ?? 0);
  }
  const topArticles = [...byArt.entries()]
    .map(([article, v]) => ({ article, qty: v.qty, sum: v.sum }))
    .sort((a, b) => b.qty - a.qty || b.sum - a.sum)
    .slice(0, 5);
  return { ordersCount, ordersSum, buyoutsCount, buyoutsSum, cancels, topArticles };
}

async function fetchCabinetDay(token: string, date: string): Promise<DayTotals> {
  const [orders, sales] = await Promise.all([
    wbGetArray(`${STATS_API}/api/v1/supplier/orders?dateFrom=${date}&flag=1`, token).catch(() => []),
    wbGetArray(`${STATS_API}/api/v1/supplier/sales?dateFrom=${date}&flag=1`, token).catch(() => []),
  ]);
  return summarizeDay(orders, sales);
}

/** Собирает текстовый бриф под роль агента по всем кабинетам. */
export async function buildAgentWbContext(agent: AgentKey): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const yDay = yesterdayBishkek();
  const tDay = todayBishkek();

  const { data: cabinets } = await supabase
    .from('cabinets')
    .select('id, name, wb_token')
    .not('wb_token', 'is', null)
    .gt('wb_token', '')
    .order('name');

  const lines: string[] = [
    `Дата: сегодня ${pretty(tDay)}, вчера ${pretty(yDay)} (Бишкек).`,
    `Агент: ${agent}. Ниже факты из WB — опирайся только на них.`,
  ];

  const salesBlock: string[] = [];
  for (const cab of cabinets || []) {
    const token = sanitizeWbToken(cab.wb_token);
    if (token.length < 50) continue;
    try {
      const [y, t] = await Promise.all([
        fetchCabinetDay(token, yDay),
        fetchCabinetDay(token, tDay),
      ]);
      salesBlock.push(
        [
          `▶ ${cab.name}`,
          `  вчера: заказы ${y.ordersCount} шт / ${fmt(y.ordersSum)} ₽; выкупы ${y.buyoutsCount} шт / ${fmt(y.buyoutsSum)} ₽; отмены ${y.cancels}`,
          `  сегодня: заказы ${t.ordersCount} шт / ${fmt(t.ordersSum)} ₽; выкупы ${t.buyoutsCount} шт / ${fmt(t.buyoutsSum)} ₽`,
          y.topArticles.length
            ? `  топ вчера: ${
              y.topArticles.map((a) => `${a.article} ${a.qty}шт`).join('; ')
            }`
            : '  топ вчера: нет заказов',
        ].join('\n'),
      );
      await sleep(200);
    } catch (e) {
      salesBlock.push(`▶ ${cab.name}: ошибка WB (${String(e).slice(0, 80)})`);
    }
  }

  if (agent === 'saule' || agent === 'karina' || agent === 'alina' || agent === 'muha') {
    lines.push('', '=== ПРОДАЖИ / ЗАКАЗЫ ===', ...salesBlock);
  }

  if (agent === 'amina' || agent === 'karina') {
    const adsLines = await loadAdsBrief(supabase);
    lines.push('', '=== РЕКЛАМА ===', ...adsLines);
  }

  if (agent === 'anton' || agent === 'karina' || agent === 'saule') {
    const fbsLines = await loadFbsBrief(supabase, yDay, tDay);
    lines.push('', '=== FBS ===', ...fbsLines);
  }

  if (agent === 'muha' || agent === 'alina') {
    lines.push(
      '',
      '=== КОНТЕНТ / ПРОДВИЖЕНИЕ ===',
      'Отдельного API фотоворонки нет — используй топ артикулы из продаж и давай гипотезы по контенту/продвижению кратко.',
      ...salesBlock.slice(0, 6),
    );
  }

  // Общий потолок, чтобы не раздувать prompt
  const text = lines.join('\n');
  return text.length > 9000 ? text.slice(0, 9000) + '\n…(обрезано)' : text;
}

// deno-lint-ignore no-explicit-any
async function loadAdsBrief(supabase: any): Promise<string[]> {
  // Берём активные и паузу отдельно — status desc ставил бы 11 выше 9.
  const [{ data: activeRows }, { data: pauseRows }] = await Promise.all([
    supabase
      .from('advertising_campaigns')
      .select('campaign_id, campaign_name, status, cabinets!inner(name)')
      .eq('status', 9)
      .limit(100),
    supabase
      .from('advertising_campaigns')
      .select('campaign_id, status, cabinets!inner(name)')
      .eq('status', 11)
      .limit(200),
  ]);

  if (!activeRows?.length && !pauseRows?.length) {
    return ['Кампаний в базе нет / не синхронизированы.'];
  }

  const byCab = new Map<string, { active: number; pause: number; total: number; names: string[] }>();
  const touch = (cab: string) => {
    const cur = byCab.get(cab) || { active: 0, pause: 0, total: 0, names: [] };
    byCab.set(cab, cur);
    return cur;
  };
  for (const row of activeRows || []) {
    const cab = String(row.cabinets?.name || '?');
    const cur = touch(cab);
    cur.active++;
    cur.total++;
    if (cur.names.length < 5) cur.names.push(String(row.campaign_name || row.campaign_id));
  }
  for (const row of pauseRows || []) {
    const cab = String(row.cabinets?.name || '?');
    const cur = touch(cab);
    cur.pause++;
    cur.total++;
  }

  const out: string[] = [];
  for (const [cab, v] of [...byCab.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push(
      `▶ ${cab}: активных ${v.active}, пауза ${v.pause}, в выборке ${v.total}` +
        (v.names.length ? `; активные: ${v.names.join(', ')}` : ''),
    );
  }
  out.push('Статус 9 = активна, 11 = пауза (как в WB).');
  return out;
}

// deno-lint-ignore no-explicit-any
async function loadFbsBrief(supabase: any, yDay: string, tDay: string): Promise<string[]> {
  const { data } = await supabase
    .from('fbs_daily_orders')
    .select('report_date, cabinet, product_name, size, qty')
    .in('report_date', [yDay, tDay])
    .limit(200);

  if (!data?.length) {
    return [`FBS за ${pretty(yDay)} / ${pretty(tDay)}: записей нет (или кабинет не активен в fbs_active_cabinets).`];
  }

  const byKey = new Map<string, number>();
  for (const r of data) {
    const key = `${r.report_date}|${r.cabinet}|${r.product_name || '?'}`;
    byKey.set(key, (byKey.get(key) || 0) + Number(r.qty || 1));
  }
  const lines = [...byKey.entries()]
    .map(([k, qty]) => {
      const [date, cab, name] = k.split('|');
      return `${pretty(date)} · ${cab}: ${name} — ${qty} шт`;
    })
    .slice(0, 30);
  return lines.length ? lines : ['Нет агрегатов FBS.'];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
