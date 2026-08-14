/**
 * NR Space — WOW ops module
 * Локализация, сводный бизнес, план-факт, «почему CTR», А/Б цена (настройки).
 * Подключается как window.WowOps из dashboard.html.
 */
(function (root) {
  'use strict';

  /** Склад WB → федеральный округ (упрощённая карта для индекса локализации). */
  const WH_TO_OKRUG = [
    [/москв|электростал|колит?ино|подольск|тул|рязан|владимир|калуг|твер|ярослав|иванов|брянск|смолен|ор[её]л|курск|белгород|липецк|тамбов|воронеж/i, 'Центральный'],
    [/санкт|питер|ленингр|псков|новгород|калининград|мурманск|архангел|карел|вологд|сыктывкар|коми/i, 'Северо-Западный'],
    [/краснодар|ростов|волгоград|астрахан|ставропол|сочи|крым|севастопол|дагестан|чечн|ингуш|кабард|осети|черкес/i, 'Южный/СКФО'],
    [/казан|татар|самар|саратов|ульянов|пенз|нижегород|оренбург|башкир|уфа|перм|ижевск|чебоксар|марий|чуваш|мордов/i, 'Приволжский'],
    [/екатеринбург|челябинск|тюмен|хант|ямал|курган|свердлов/i, 'Уральский'],
    [/новосибир|омск|томск|кемеров|краснояр|алтай|барнаул|иркутск|бурят|читин|забайкал|хакас|тыва/i, 'Сибирский'],
    [/хабаровск|владивосток|примор|амур|якут|сахалин|камчат|магадан|чукот/i, 'Дальневосточный'],
  ];

  function warehouseOkrug(name) {
    const s = String(name || '');
    for (const [re, okrug] of WH_TO_OKRUG) {
      if (re.test(s)) return okrug;
    }
    return 'Прочее';
  }

  function normalizeOkrug(oblastOkrugName) {
    const s = String(oblastOkrugName || '').toLowerCase();
    if (!s) return '';
    if (/центральн/.test(s)) return 'Центральный';
    if (/северо.?запад|сев.?зап/.test(s)) return 'Северо-Западный';
    if (/южн|северо.?кавказ|скфо/.test(s)) return 'Южный/СКФО';
    if (/приволж|волж/.test(s)) return 'Приволжский';
    if (/урал/.test(s)) return 'Уральский';
    if (/сибир/.test(s)) return 'Сибирский';
    if (/дальневост/.test(s)) return 'Дальневосточный';
    return oblastOkrugName;
  }

  /**
   * Индекс локализации ≈ доля заказов, отгруженных со склада того же округа, что и покупатель.
   * @param {Array<{data?: object, warehouse_name?: string}>} orders
   * @returns {{ index: number, matched: number, total: number, byOkrug: Record<string, {orders:number, local:number}>, recommendations: Array<{warehouse:string, reason:string, priority:number}> }}
   */
  function computeLocalization(orders) {
    const byOkrug = {};
    let matched = 0;
    let total = 0;
    const demand = {}; // buyer okrug → count
    const stockShip = {}; // warehouse → count of orders shipped from it

    for (const o of orders || []) {
      if (o.is_return) continue;
      const d = o.data || {};
      const buyer = normalizeOkrug(d.oblastOkrugName || d.regionName);
      const whName = d.warehouseName || o.warehouse_name || '';
      const ship = warehouseOkrug(whName);
      if (!buyer && !whName) continue;
      total += 1;
      const key = buyer || 'неизвестно';
      demand[key] = (demand[key] || 0) + 1;
      if (whName) stockShip[whName] = (stockShip[whName] || 0) + 1;
      if (!byOkrug[key]) byOkrug[key] = { orders: 0, local: 0 };
      byOkrug[key].orders += 1;
      if (buyer && ship && (buyer === ship || String(buyer).includes(ship) || String(ship).includes(buyer))) {
        matched += 1;
        byOkrug[key].local += 1;
      }
    }

    const index = total > 0 ? Math.round((matched / total) * 1000) / 10 : 0;

    // Рекомендации: округа с высоким спросом, но низкой локальной долей → грузить на склады этого округа
    const recommendations = [];
    const okrugToWhHint = {
      Центральный: 'Электросталь / Коледино / Москва',
      'Северо-Западный': 'Санкт-Петербург',
      'Южный/СКФО': 'Краснодар / Ростов',
      Приволжский: 'Казань',
      Уральский: 'Екатеринбург',
      Сибирский: 'Новосибирск / Красноярск',
      Дальневосточный: 'Хабаровск / Владивосток',
    };
    Object.entries(byOkrug)
      .filter(([, v]) => v.orders >= 3)
      .map(([okrug, v]) => ({
        okrug,
        orders: v.orders,
        localPct: v.orders ? (v.local / v.orders) * 100 : 0,
      }))
      .sort((a, b) => a.localPct - b.localPct || b.orders - a.orders)
      .slice(0, 5)
      .forEach((row, i) => {
        if (row.localPct >= 70) return;
        recommendations.push({
          warehouse: okrugToWhHint[row.okrug] || row.okrug,
          reason: `${row.okrug}: ${row.orders} заказов, локально только ${row.localPct.toFixed(0)}% — довезите сток`,
          priority: i + 1,
        });
      });

    return { index, matched, total, byOkrug, recommendations, demand, stockShip };
  }

  /** Оборачиваемость в днях ≈ stock / (orders_per_day). */
  function computeTurnoverDays(stockTotal, ordersCount, periodDays) {
    const days = Math.max(1, Number(periodDays) || 7);
    const perDay = (Number(ordersCount) || 0) / days;
    if (perDay <= 0) return null;
    return Math.round((Number(stockTotal) || 0) / perDay);
  }

  /** ДРР = spend / sum_price * 100 */
  function computeDrr(spend, sumPrice) {
    const s = Number(spend) || 0;
    const p = Number(sumPrice) || 0;
    if (p <= 0) return s > 0 ? 999 : 0;
    return Math.round((s / p) * 1000) / 10;
  }

  /**
   * Почему упал CTR: сравниваем два окна по nm.
   * @returns {{ verdict: string, factors: string[], ctrNow: number, ctrPrev: number, deltaPct: number }}
   */
  function diagnoseCtr(now, prev) {
    const ctr = (impr, clk) => {
      const i = Number(impr) || 0;
      const c = Number(clk) || 0;
      return i > 0 ? (c / i) * 100 : 0;
    };
    const ctrNow = ctr(now?.impressions ?? now?.ad_impressions, now?.clicks ?? now?.ad_clicks);
    const ctrPrev = ctr(prev?.impressions ?? prev?.ad_impressions, prev?.clicks ?? prev?.ad_clicks);
    const deltaPct = ctrPrev > 0 ? ((ctrNow - ctrPrev) / ctrPrev) * 100 : 0;
    const factors = [];
    const spendNow = Number(now?.ad_spend) || 0;
    const spendPrev = Number(prev?.ad_spend) || 0;
    if (spendNow > spendPrev * 1.3 && ctrNow < ctrPrev) {
      factors.push('Расход РК вырос сильнее CTR — возможно расширили аукцион/минус-фразы слабые');
    }
    if (spendNow < spendPrev * 0.7) {
      factors.push('Рекламный расход просел — меньше платного трафика');
    }
    const imprNow = Number(now?.impressions ?? now?.ad_impressions) || 0;
    const imprPrev = Number(prev?.impressions ?? prev?.ad_impressions) || 0;
    if (imprNow > imprPrev * 1.4 && ctrNow < ctrPrev * 0.9) {
      factors.push('Показы выросли, CTR упал — размытие аудитории или слабое фото');
    }
    if (ctrNow < ctrPrev * 0.85) {
      factors.push('Похоже на просадку кликабельности карточки — проверьте А/Б фото и главную');
    }
    if (!factors.length) {
      factors.push(deltaPct >= 0 ? 'Сильных красных флагов нет — смотрите сезонность и выдачу' : 'Небольшая просадка без явной причины в цифрах');
    }
    let verdict = 'Стабильно';
    if (deltaPct <= -20) verdict = 'Сильная просадка CTR';
    else if (deltaPct <= -8) verdict = 'CTR слабеет';
    else if (deltaPct >= 15) verdict = 'CTR растёт';
    return {
      verdict,
      factors,
      ctrNow: Math.round(ctrNow * 100) / 100,
      ctrPrev: Math.round(ctrPrev * 100) / 100,
      deltaPct: Math.round(deltaPct * 10) / 10,
    };
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('ru-RU');
  }

  // ── Dashboard loaders (используют supabase / currentCabinetId с страницы) ──

  async function loadWarehouseWow(ctx) {
    const { supabase, cabinetId, setText, periodDays } = ctx;
    if (!cabinetId) return null;

    const from = new Date();
    from.setDate(from.getDate() - Math.max(7, periodDays || 14));
    const fromStr = from.toISOString().slice(0, 10);

    const [{ data: stocks }, { data: orders }] = await Promise.all([
      supabase.from('wb_stocks').select('warehouse_name, quantity, nm_id').eq('cabinet_id', cabinetId),
      supabase
        .from('wb_orders')
        .select('is_return, data, order_date')
        .eq('cabinet_id', cabinetId)
        .gte('order_date', fromStr)
        .limit(8000),
    ]);

    const stockTotal = (stocks || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const ordersCount = (orders || []).filter((o) => !o.is_return).length;
    const loc = computeLocalization(orders || []);
    const turn = computeTurnoverDays(stockTotal, ordersCount, periodDays || 14);

    if (setText) {
      setText('wh-total', fmt(stockTotal) + ' шт.');
      setText('wh-localization', (loc.total ? loc.index.toFixed(1) : '—') + (loc.total ? '%' : ''));
      setText('wh-turnover', turn != null ? turn + ' дн.' : '— дн.');
    }

    const listEl = document.getElementById('warehouse-list');
    if (listEl) {
      const byWh = {};
      (stocks || []).forEach((s) => {
        const n = s.warehouse_name || '—';
        byWh[n] = (byWh[n] || 0) + (Number(s.quantity) || 0);
      });
      const entries = Object.entries(byWh).sort((a, b) => b[1] - a[1]);
      const recHtml = loc.recommendations.length
        ? `<div class="px-5 py-3" style="border-top:1px solid var(--border)">
            <div class="text-xs font-semibold mb-2" style="color:var(--accent)">Куда грузить (вау-рекомендации)</div>
            ${loc.recommendations
              .map(
                (r) =>
                  `<div class="text-sm mb-1.5" style="color:var(--text-secondary)"><b style="color:var(--text-primary)">${r.priority}. ${escapeHtml(r.warehouse)}</b> — ${escapeHtml(r.reason)}</div>`,
              )
              .join('')}
            <div class="text-xs mt-2" style="color:var(--text-muted)">Индекс: ${loc.index}% · заказов в выборке: ${loc.total} · локальных: ${loc.matched}</div>
          </div>`
        : `<div class="px-5 py-3 text-xs" style="color:var(--text-muted);border-top:1px solid var(--border)">Индекс локализации ${loc.index}% по ${loc.total} заказам. Критичных рекомендаций нет.</div>`;

      listEl.innerHTML = entries.length
        ? `<div class="divide-y" style="border-color:var(--border)">${entries
            .map(
              ([n, q]) =>
                `<div class="flex justify-between px-5 py-3"><span class="text-sm" style="color:var(--text-secondary)">${escapeHtml(n)} <span class="text-xs" style="color:var(--text-muted)">· ${escapeHtml(warehouseOkrug(n))}</span></span><span class="text-sm font-bold" style="color:var(--text-primary)">${fmt(q)} шт.</span></div>`,
            )
            .join('')}</div>${recHtml}`
        : `<div class="py-10 text-center" style="color:var(--text-muted)">Нет данных по остаткам</div>${recHtml}`;
    }
    return { loc, turn, stockTotal, ordersCount };
  }

  async function loadSummaryBiz(ctx) {
    const { supabase, cabinets, getDateRange } = ctx;
    const root = document.getElementById('tab-summary-biz');
    if (!root) return;
    root.innerHTML = `<div class="widget-card p-6"><div class="text-sm" style="color:var(--text-muted)">Считаем сводку по кабинетам…</div></div>`;

    const range = typeof getDateRange === 'function' ? getDateRange() : null;
    const from = range?.from || new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const to = range?.to || new Date().toISOString().slice(0, 10);

    const list = (cabinets && cabinets.length)
      ? cabinets.filter((c) => c && c.id)
      : (await supabase.from('cabinets').select('id, name').order('name')).data || [];
    if (!list.length) {
      root.innerHTML = `<div class="widget-card p-6 text-sm" style="color:var(--text-muted)">Нет кабинетов</div>`;
      return;
    }

    let ordersSum = 0;
    let ordersCount = 0;
    let returns = 0;
    let stockTotal = 0;
    let adSpend = 0;
    let adSumPrice = 0;
    const rows = [];

    const fromD = new Date(from);
    const toD = new Date(to);
    const span = Math.max(1, Math.round((toD - fromD) / 864e5) + 1);
    const prevTo = new Date(fromD);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (span - 1));
    const iso = (d) => d.toISOString().slice(0, 10);

    for (const cab of list) {
      const { data: summary } = await supabase.rpc('dashboard_summary', {
        p_cabinet_id: cab.id,
        p_from: from,
        p_to: to,
        p_prev_from: iso(prevFrom),
        p_prev_to: iso(prevTo),
      });
      const cur = summary?.cur || {};
      const stock = Number(summary?.stock_total || 0) || 0;
      const oSum = Number(cur.orders_sum || 0);
      const oCnt = Number(cur.orders_count || 0);
      const ret = Number(cur.returns_count || 0);
      stockTotal += stock;
      ordersSum += oSum;
      ordersCount += oCnt;
      returns += ret;

      const { data: ads } = await supabase
        .from('advertising_daily_stats')
        .select('spend, sum_price')
        .eq('cabinet_id', cab.id)
        .gte('stat_date', from)
        .lte('stat_date', to);
      let cabSpend = 0;
      let cabRev = 0;
      (ads || []).forEach((a) => {
        cabSpend += Number(a.spend) || 0;
        cabRev += Number(a.sum_price) || 0;
      });
      adSpend += cabSpend;
      adSumPrice += cabRev;
      rows.push({
        name: cab.name,
        ordersSum: oSum,
        ordersCount: oCnt,
        stock,
        drr: computeDrr(cabSpend, cabRev),
        spend: cabSpend,
      });
    }

    const drr = computeDrr(adSpend, adSumPrice);
    const buyoutProxy = ordersCount > 0 ? Math.round(((ordersCount - returns) / ordersCount) * 100) : 0;

    root.innerHTML = `
      <div class="widget-card p-6 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h3 class="font-semibold" style="color:var(--text-primary)">Сводный по бизнесу · ${escapeHtml(from)} — ${escapeHtml(to)}</h3>
          <button type="button" class="ui-btn ui-btn-secondary text-xs" onclick="WowOps.reloadSummaryBiz()">↻ Обновить</button>
        </div>
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">Заказы ₽</div><div class="text-xl font-black" style="color:var(--text-primary)">${fmt(Math.round(ordersSum))} ₽</div></div>
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">Заказы шт</div><div class="text-xl font-black" style="color:var(--text-primary)">${fmt(ordersCount)}</div></div>
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">Остаток</div><div class="text-xl font-black" style="color:var(--blue)">${fmt(stockTotal)} шт.</div></div>
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">ДРР (реклама)</div><div class="text-xl font-black" style="color:var(--accent)">${drr}%</div></div>
        </div>
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">Расход РК</div><div class="text-lg font-bold">${fmt(Math.round(adSpend))} ₽</div></div>
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">Заказы с РК ₽</div><div class="text-lg font-bold">${fmt(Math.round(adSumPrice))} ₽</div></div>
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">Возвраты</div><div class="text-lg font-bold" style="color:var(--red)">${fmt(returns)}</div></div>
          <div class="metric-card"><div class="text-xs mb-1" style="color:var(--text-muted)">Выкуп (прокси)</div><div class="text-lg font-bold">${buyoutProxy}%</div></div>
        </div>
        <div class="glass rounded-xl overflow-hidden">
          <div class="px-4 py-2 text-xs font-semibold" style="border-bottom:1px solid var(--border);color:var(--text-secondary)">По кабинетам</div>
          <div class="divide-y" style="border-color:var(--border)">
            ${rows
              .sort((a, b) => b.ordersSum - a.ordersSum)
              .map(
                (r) => `<div class="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm">
                <span style="color:var(--text-primary);font-weight:600">${escapeHtml(r.name)}</span>
                <span style="color:var(--text-muted)">${fmt(Math.round(r.ordersSum))} ₽ · ${fmt(r.ordersCount)} зак. · сток ${fmt(r.stock)} · ДРР ${r.drr}%</span>
              </div>`,
              )
              .join('')}
          </div>
        </div>
      </div>`;
  }

  async function loadPlanFact(ctx) {
    const { supabase, cabinetId } = ctx;
    const root = document.getElementById('tab-plan-fact');
    if (!root || !cabinetId) return;
    root.innerHTML = `<div class="widget-card p-6 text-sm" style="color:var(--text-muted)">Считаем план-факт…</div>`;

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 13);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const [{ data: plans }, { data: daily }, { data: articles }] = await Promise.all([
      supabase
        .from('rnp_plans')
        .select('nm_id, plan_date, planned_orders, planned_sales, planned_ad_spend, planned_drr')
        .eq('cabinet_id', cabinetId)
        .gte('plan_date', fromStr)
        .lte('plan_date', toStr),
      supabase
        .from('rnp_daily_data')
        .select('nm_id, date, orders_count, sales_sum, ad_spend')
        .eq('cabinet_id', cabinetId)
        .gte('date', fromStr)
        .lte('date', toStr),
      supabase.from('rnp_articles').select('nm_id, name, is_active').eq('cabinet_id', cabinetId).eq('is_active', true),
    ]);

    const nameByNm = new Map((articles || []).map((a) => [String(a.nm_id), a.name || String(a.nm_id)]));
    const planByNm = {};
    (plans || []).forEach((p) => {
      const k = String(p.nm_id);
      if (!planByNm[k]) planByNm[k] = { orders: 0, sales: 0, days: 0 };
      if (p.planned_orders != null) {
        planByNm[k].orders += Number(p.planned_orders) || 0;
        planByNm[k].days += 1;
      }
      if (p.planned_sales != null) planByNm[k].sales += Number(p.planned_sales) || 0;
    });
    const factByNm = {};
    (daily || []).forEach((d) => {
      const k = String(d.nm_id);
      if (!factByNm[k]) factByNm[k] = { orders: 0, sales: 0, spend: 0 };
      factByNm[k].orders += Number(d.orders_count) || 0;
      factByNm[k].sales += Number(d.sales_sum) || 0;
      factByNm[k].spend += Number(d.ad_spend) || 0;
    });

    const nms = Object.keys(planByNm);
    if (!nms.length) {
      root.innerHTML = `<div class="widget-card p-6">
        <h3 class="font-semibold mb-2" style="color:var(--text-primary)">План-факт</h3>
        <p class="text-sm" style="color:var(--text-muted)">За последние 14 дней планов с числами нет. Задайте цели во вкладке «Планирование».</p>
      </div>`;
      return;
    }

    const rows = nms
      .map((nm) => {
        const p = planByNm[nm];
        const f = factByNm[nm] || { orders: 0, sales: 0, spend: 0 };
        const pct = p.orders > 0 ? Math.round((f.orders / p.orders) * 100) : null;
        return { nm, name: nameByNm.get(nm) || nm, plan: p.orders, fact: f.orders, pct, spend: f.spend };
      })
      .sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));

    const traffic = (pct) => {
      if (pct == null) return '—';
      if (pct >= 100) return `<span style="color:var(--green)">${pct}%</span>`;
      if (pct >= 70) return `<span style="color:var(--accent)">${pct}%</span>`;
      return `<span style="color:var(--red)">${pct}%</span>`;
    };

    root.innerHTML = `
      <div class="widget-card p-6 space-y-3">
        <div class="flex justify-between items-center flex-wrap gap-2">
          <h3 class="font-semibold" style="color:var(--text-primary)">План-факт · заказы (${escapeHtml(fromStr)} — ${escapeHtml(toStr)})</h3>
          <button type="button" class="ui-btn ui-btn-secondary text-xs" onclick="WowOps.reloadPlanFact()">↻</button>
        </div>
        <p class="text-xs" style="color:var(--text-muted)">Светофор: зелёный ≥100%, жёлтый ≥70%, красный ниже. Данные из «Планирование» + РНП daily.</p>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Товар</th><th>Арт.</th><th>План</th><th>Факт</th><th>%</th><th>РК ₽</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) => `<tr>
                  <td>${escapeHtml(String(r.name).slice(0, 48))}</td>
                  <td><code>${escapeHtml(r.nm)}</code></td>
                  <td>${fmt(r.plan)}</td>
                  <td>${fmt(r.fact)}</td>
                  <td>${traffic(r.pct)}</td>
                  <td>${fmt(Math.round(r.spend))}</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function loadCtrDeath(ctx) {
    const { supabase, cabinetId, nmId } = ctx;
    const box = document.getElementById('ctr-death-panel');
    if (!box || !cabinetId || !nmId) return;

    const to = new Date();
    const mid = new Date();
    mid.setDate(mid.getDate() - 7);
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const f = (d) => d.toISOString().slice(0, 10);

    const { data } = await supabase
      .from('rnp_daily_data')
      .select('date, ad_impressions, ad_clicks, ad_spend, impressions, clicks, orders_count')
      .eq('cabinet_id', cabinetId)
      .eq('nm_id', nmId)
      .gte('date', f(from))
      .lte('date', f(to));

    const prev = { impressions: 0, clicks: 0, ad_spend: 0 };
    const now = { impressions: 0, clicks: 0, ad_spend: 0 };
    const midStr = f(mid);
    (data || []).forEach((row) => {
      const target = row.date >= midStr ? now : prev;
      target.impressions += Number(row.ad_impressions || row.impressions) || 0;
      target.clicks += Number(row.ad_clicks || row.clicks) || 0;
      target.ad_spend += Number(row.ad_spend) || 0;
    });
    const diag = diagnoseCtr(now, prev);
    box.innerHTML = `
      <div class="text-sm font-semibold mb-1" style="color:var(--text-primary)">${escapeHtml(diag.verdict)}</div>
      <div class="text-xs mb-2" style="color:var(--text-muted)">CTR сейчас ${diag.ctrNow}% · было ${diag.ctrPrev}% · Δ ${diag.deltaPct}%</div>
      <ul class="text-xs space-y-1" style="color:var(--text-secondary)">${diag.factors.map((x) => `<li>• ${escapeHtml(x)}</li>`).join('')}</ul>`;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCtx() {
    return {
      supabase: root.supabase,
      cabinetId: root.currentCabinetId,
      cabinets: root.cabinetListCache || [],
      setText: typeof root.setText === 'function' ? root.setText : (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      },
      periodDays: 14,
      getDateRange: () => {
        try {
          if (typeof root.getDashboardDateRange === 'function') return root.getDashboardDateRange();
        } catch (_) {}
        const to = new Date();
        const from = new Date(Date.now() - 7 * 864e5);
        return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
      },
    };
  }

  const api = {
    computeLocalization,
    computeTurnoverDays,
    computeDrr,
    diagnoseCtr,
    warehouseOkrug,
    loadWarehouseWow: () => loadWarehouseWow(getCtx()),
    loadSummaryBiz: () => loadSummaryBiz(getCtx()),
    loadPlanFact: () => loadPlanFact(getCtx()),
    loadCtrDeath: (nmId) => loadCtrDeath({ ...getCtx(), nmId }),
    reloadSummaryBiz() {
      return api.loadSummaryBiz();
    },
    reloadPlanFact() {
      return api.loadPlanFact();
    },
  };

  root.WowOps = api;
})(typeof window !== 'undefined' ? window : globalThis);
