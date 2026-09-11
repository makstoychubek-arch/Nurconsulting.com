/**
 * wb-formulas.js — Расчётный движок NR Space
 * Источник: POST finance-api /api/finance/v1/sales-reports/detailed (period daily).
 * wb-proxy нормализует строки в старый snake_case; здесь принимаем оба имени.
 * Методология: TrueStats-совместимые формулы
 *
 * Структура строки отчёта (doc_type_name / docTypeName определяет тип):
 *   "Продажа"     — продажа товара покупателю
 *   "Возврат"     — возврат от покупателя
 *   "Хранение"    — плата за хранение на складе WB
 *   "Логистика"   — стоимость логистики (доставка до клиента)
 *   "Штраф"       — штраф от WB
 *   "Компенсация" — компенсация от WB
 *   "Удержание"   — прочие удержания
 *
 * Ключевые поля (snake = legacy, camel = finance-api v1):
 *   doc_type_name / docTypeName
 *   retail_price / retailPrice
 *   retail_price_withdisc_rub / retailPriceWithDisc
 *   ppvz_for_pay / forPay
 *   delivery_rub / deliveryService
 *   storage_fee / paidStorage
 *   penalty, deduction
 *   additional_payment / additionalPayment
 *   acceptance / paidAcceptance
 *   acquiring_fee / acquiringFee
 *   nm_id / nmId
 *   sa_name / vendorCode
 */

// ============================================================
// КОНСТАНТЫ — ПРОЧИЕ УДЕРЖАНИЯ (исключаем из основного расчёта)
// Это типы операций, которые НЕ входят в "прочие удержания" аналитики
// ============================================================
function finField(row, ...names) {
    for (const n of names) {
        if (row && row[n] != null && row[n] !== '') return row[n];
    }
    return undefined;
}
function finMoney(v) {
    if (v == null || v === '') return 0;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

const EXCLUDED_DEDUCTION_NAMES = [
    'ВБ.Продвижение', 'WB Продвижение', 'ВБ.Медиа',
    'Перевод на баланс заёмщика', 'Погашение задолженности',
    'Погашение по займу', 'Продвижение через блогеров',
    'ВБ.Бренд-зона', 'Сторно платной приёмки',
    'НДС не облагается', 'Компенсация'
];

/**
 * Главная функция расчёта всех метрик дашборда
 * @param {Array} rows — строки финотчёта (snake_case или camelCase)
 * @param {Object} settings — { taxRate: 6, opex: 0, costOfGoods: {} }
 *   costOfGoods: { [nmId]: costPerUnit } — себестоимость по артикулу
 * @returns {Object} — все метрики для отображения в дашборде
 */
function calculateMetrics(rows, settings = {}) {
    const taxRate = settings.taxRate || 6;     // УСН "Доходы", %
    const opexMonthly = settings.opex || 0;    // Операционные расходы в месяц, сом
    const costOfGoods = settings.costOfGoods || {}; // себестоимость по nmId
    const adsSum = Math.round(Number(settings.adsSum || 0)); // расход РК за период (advertising_daily_stats)

    // Определяем период для пересчёта опер.расходов в дни
    const dates = rows.map(r => finField(r, 'sale_dt', 'saleDt', 'rr_dt', 'rrDate')).filter(Boolean).sort();
    const periodDays = dates.length >= 2
        ? Math.max(1, Math.round((new Date(dates[dates.length-1]) - new Date(dates[0])) / 86400000) + 1)
        : 30;
    const opexForPeriod = Math.round(opexMonthly * periodDays / 30);

    // Накопители
    let salesSum = 0;          // Продажи (после СПП) — retail_price_withdisc_rub для Продаж
    let salesCount = 0;        // Количество продаж, шт
    let realizationSum = 0;    // Реализация (розничная цена до скидок) — retail_price для Продаж
    let returnsSum = 0;        // Возвраты (сумма) — retail_price_withdisc_rub для Возвратов
    let returnsCount = 0;      // Количество возвратов, шт
    let toTransferSum = 0;     // К перечислению — ppvz_for_pay
    let logisticsSum = 0;      // Логистика — delivery_rub
    let storageSum = 0;        // Хранение — storage_fee
    let penaltySum = 0;        // Штрафы — penalty
    let compensationSum = 0;   // Компенсации — additional_payment
    let deductionSum = 0;      // Прочие удержания — deduction (только нужные типы)
    let acceptanceSum = 0;     // Платная приёмка — acceptance
    let acquiringSum = 0;      // Эквайринг — acquiring_fee
    let ordersSum = 0;         // Заказы (оценочно через отчёт)
    let costOfSalesSum = 0;    // Себестоимость продаж

    // По артикулам — для таблицы товаров
    const byNmId = {};

    rows.forEach(row => {
        const type = String(finField(row, 'doc_type_name', 'docTypeName') || '').toLowerCase();
        const isSale = type === 'продажа';
        const isReturn = type === 'возврат';

        const priceWithDisc = finMoney(finField(row, 'retail_price_withdisc_rub', 'retailPriceWithDisc'));
        const retailPrice = finMoney(finField(row, 'retail_price', 'retailPrice'));
        const forPay = finMoney(finField(row, 'ppvz_for_pay', 'forPay', 'ppvzForPay'));
        const delivery = finMoney(finField(row, 'delivery_rub', 'deliveryService'));
        const storage = finMoney(finField(row, 'storage_fee', 'paidStorage'));
        const penalty = finMoney(finField(row, 'penalty'));
        const addPayment = finMoney(finField(row, 'additional_payment', 'additionalPayment'));
        const deduction = finMoney(finField(row, 'deduction'));
        const acceptance = finMoney(finField(row, 'acceptance', 'paidAcceptance'));
        const acquiring = finMoney(finField(row, 'acquiring_fee', 'acquiringFee'));
        const qty = Number(finField(row, 'quantity') || 0);
        const nmId = String(finField(row, 'nm_id', 'nmId') || '');

        if (isSale) {
            salesSum += priceWithDisc * qty;
            salesCount += qty;
            realizationSum += retailPrice * qty;
            toTransferSum += forPay;

            // Себестоимость продаж по артикулу (если задана)
            if (costOfGoods[nmId]) {
                costOfSalesSum += costOfGoods[nmId] * qty;
            }

            // Аккумуляция по артикулам
            if (!byNmId[nmId]) byNmId[nmId] = initArticle(row);
            byNmId[nmId].salesSum += priceWithDisc * qty;
            byNmId[nmId].salesCount += qty;
            byNmId[nmId].realizationSum += retailPrice * qty;
            byNmId[nmId].forPay += forPay;
        }

        if (isReturn) {
            returnsSum += priceWithDisc * qty;
            returnsCount += qty;
            toTransferSum += forPay; // Возврат уменьшает "к перечислению"
        }

        // Расходы идут во всех строках (не только Продажа/Возврат)
        logisticsSum += delivery;
        storageSum += storage;
        penaltySum += penalty;
        compensationSum += addPayment;
        acceptanceSum += acceptance;
        acquiringSum += acquiring;

        // Прочие удержания — только не исключённые
        const operName = String(finField(row, 'supplier_oper_name', 'sellerOperName', 'supplierOperName') || '');
        const bonusName = String(finField(row, 'bonus_type_name', 'bonusTypeName') || '');
        const shouldExclude = EXCLUDED_DEDUCTION_NAMES.some(n =>
            operName.includes(n) || bonusName.includes(n)
        );
        if (!shouldExclude && deduction !== 0) {
            deductionSum += deduction;
        }
    });

    // ======================================================
    // РАСЧЁТ КЛЮЧЕВЫХ МЕТРИК по методологии TrueStats
    // ======================================================

    // Комиссия = Продажи − К_перечислению − Компенсации
    // (не берётся напрямую из поля, а вычисляется!)
    const commissionSum = salesSum - toTransferSum - compensationSum;

    // СПП (скидка постоянного покупателя) = Реализация − Продажи
    const sppSum = realizationSum - salesSum;

    // Процент выкупа = Продажи / (Продажи + Возвраты) × 100
    const buyoutRate = (salesSum + returnsSum) > 0
        ? Math.round((salesSum / (salesSum + returnsSum)) * 1000) / 10
        : 0;

    // Налог (УСН "Доходы") = Продажи × taxRate%
    // Налоговая база = Продажи (после СПП)
    const taxBase = salesSum;
    const taxSum = Math.round(taxBase * taxRate / 100);

    // Чистая прибыль (без себестоимости и опер.расходов)
    // = Продажи − Логистика − Хранение − Комиссия − Эквайринг
    //   − Прочие удержания − Платная приёмка − Штрафы + Компенсации − Налог
    const profitBeforeCost = salesSum
        - logisticsSum
        - storageSum
        - commissionSum
        - acquiringSum
        - deductionSum
        - acceptanceSum
        - penaltySum
        + compensationSum
        - taxSum
        - adsSum;

    // Чистая прибыль с себестоимостью и опер.расходами
    const profitFull = profitBeforeCost - costOfSalesSum - opexForPeriod;

    // Маржинальность = Прибыль / Реализация × 100
    const margin = realizationSum > 0
        ? Math.round((profitFull / realizationSum) * 1000) / 10
        : 0;

    // ROI = Прибыль / Себестоимость × 100
    const roi = costOfSalesSum > 0
        ? Math.round((profitFull / costOfSalesSum) * 100)
        : null;

    // Средние значения
    const avgSalePrice = salesCount > 0 ? Math.round(salesSum / salesCount) : 0;
    const avgLogisticsPerUnit = salesCount > 0 ? Math.round(logisticsSum / salesCount) : 0;
    const avgProfitPerUnit = salesCount > 0 ? Math.round(profitFull / salesCount) : 0;

    // ДРР как в РНП: расход РК / продажи после СПП. Продвижение из отчёта
    // реализации сюда не берём — оно в EXCLUDED_DEDUCTION_NAMES, чтобы не
    // посчитать дважды вместе с advertising_daily_stats.
    const drr = salesSum > 0 && adsSum > 0
        ? Math.round((adsSum / salesSum) * 1000) / 10
        : null;

    return {
        // Основные метрики
        salesSum: Math.round(salesSum),
        salesCount,
        realizationSum: Math.round(realizationSum),
        returnsSum: Math.round(returnsSum),
        returnsCount,
        toTransferSum: Math.round(toTransferSum),

        // Расходы WB
        logisticsSum: Math.round(logisticsSum),
        storageSum: Math.round(storageSum),
        commissionSum: Math.round(commissionSum),
        acquiringSum: Math.round(acquiringSum),
        acceptanceSum: Math.round(acceptanceSum),
        penaltySum: Math.round(penaltySum),
        compensationSum: Math.round(compensationSum),
        deductionSum: Math.round(deductionSum),
        sppSum: Math.round(sppSum),

        // Реклама из advertising_daily_stats за выбранный период
        adsSum,
        drr,

        // Себестоимость и опер.расходы
        costOfSalesSum: Math.round(costOfSalesSum),
        opexForPeriod: Math.round(opexForPeriod),

        // Налоги
        taxBase: Math.round(taxBase),
        taxSum: Math.round(taxSum),

        // Прибыль
        profitBeforeCost: Math.round(profitBeforeCost),
        profitFull: Math.round(profitFull),

        // Производные метрики
        margin,
        roi,
        buyoutRate,
        avgSalePrice,
        avgLogisticsPerUnit,
        avgProfitPerUnit,

        // Итоговое вознаграждение ВБ
        // = Комиссия + Эквайринг + Логистика + Хранение + Приёмка
        totalWbFee: Math.round(commissionSum + acquiringSum + logisticsSum + storageSum + acceptanceSum),

        // По артикулам (для таблицы товаров)
        byNmId,

        // Метаданные расчёта
        periodDays,
        hasRealData: rows.length > 0,
    };
}

/**
 * Инициализация объекта накопления по артикулу
 */
function initArticle(row) {
    return {
        nmId: String(finField(row, 'nm_id', 'nmId') || ''),
        saName: finField(row, 'sa_name', 'vendorCode') || '',
        subjectName: finField(row, 'subject_name', 'subjectName') || '',
        brandName: finField(row, 'brand_name', 'brandName') || '',
        salesSum: 0,
        salesCount: 0,
        realizationSum: 0,
        forPay: 0,
    };
}

/**
 * Загрузка отчёта реализации через wb-proxy Edge Function
 * @param {Function} callWbProxy — функция вызова прокси из dashboard.html
 * @param {string} dateFrom — начало периода YYYY-MM-DD
 * @param {string} dateTo — конец периода YYYY-MM-DD
 * @returns {Array} — все строки отчёта
 */
async function loadFinanceReport(callWbProxy, dateFrom, dateTo) {
    // WB finance detailed — 1 запрос/минуту на продавца.
    // Кэшируем в sessionStorage на 30 минут, при 429 не ретраим.
    const cacheKey = `wbf_fin_${dateFrom}_${dateTo}`;
    try {
        const stored = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        if (stored && Date.now() - stored.ts < 30 * 60 * 1000 && Array.isArray(stored.rows)) {
            return stored.rows;
        }
    } catch (e) {}

    const allRows = [];
    let rrdid = 0;
    const limit = 10000;
    const maxPages = 4;

    for (let page = 0; page < maxPages; page++) {
        let data;
        try {
            data = await callWbProxy('finance_report', {
                dateFrom: dateFrom + 'T00:00:00.000Z',
                dateTo: dateTo + 'T23:59:59.000Z',
                limit,
                rrdid,
            });
        } catch (e) {
            // 429 (лимит WB) — отдаём то, что успели собрать, без ретраев
            console.warn('[WBFormulas] finance_report:', e.message);
            break;
        }

        if (!data || !Array.isArray(data) || data.length === 0) break;
        allRows.push(...data);

        const maxRrdId = Math.max(...data.map(r => r.rrd_id || 0));
        if (maxRrdId <= rrdid || data.length < limit) break;
        rrdid = maxRrdId;
    }

    if (allRows.length) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ rows: allRows, ts: Date.now() })); } catch (e) {}
    }
    return allRows;
}

/**
 * Деньги кабинетов — сомы (KGS), не рубли.
 */
function fmtMoney(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('ru-RU') + ' сом';
}
function fmtRub(n) { return fmtMoney(n); }
function fmtAds(m) {
    if (!m || !m.adsSum) return '—';
    return fmtMoney(m.adsSum) + (m.drr != null ? ' · ' + m.drr + '%' : '');
}

/**
 * Форматирование процента
 */
function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toFixed(2) + '%';
}

/**
 * Заполнение всех карточек метрик в UI из объекта результата calculateMetrics()
 * @param {Object} m — результат calculateMetrics()
 * @param {Function} setText — функция обновления текста элемента по id
 */
function applyMetricsToDashboard(m, setText) {
    if (!m.hasRealData) {
        // Нет данных — ставим прочерки
        const allIds = [
            'm-profit', 'm-margin', 'm-profit2', 'm-sales-sum', 'm-sales-count',
            'm-realization', 'm-commission', 'm-orders-sum', 'm-orders-count',
            'm-conversion', 'm-logistics', 'm-ads', 'm-storage',
            'm-roi', 'm-opex', 'm-returns', 'm-stock'
        ];
        allIds.forEach(id => setText(id, '—'));
        return;
    }

    setText('m-profit', fmtRub(m.profitFull));
    setText('m-margin', fmtPct(m.margin));
    setText('m-profit2', fmtRub(m.profitBeforeCost));
    setText('m-sales-sum', fmtRub(m.salesSum));
    setText('m-sales-count', m.salesCount + ' шт.');
    setText('m-realization', fmtRub(m.realizationSum));
    setText('m-commission', fmtRub(m.totalWbFee));
    setText('m-conversion', m.buyoutRate ? m.buyoutRate + '%' : '—');
    setText('m-logistics', fmtRub(m.logisticsSum));
    setText('m-storage', fmtRub(m.storageSum));
    setText('m-ads', fmtAds(m));
    setText('m-roi', m.roi !== null ? m.roi + '%' : '—');
    setText('m-opex', fmtRub(m.opexForPeriod));
    setText('m-returns', fmtRub(m.returnsSum));

    // Доп. карточки которые есть в HTML
    // Налоги
    const taxEl = document.querySelector('[data-metric="tax"]');
    if (taxEl) taxEl.textContent = fmtRub(m.taxSum);

    // Налоговая база
    const taxBaseEl = document.querySelector('[data-metric="tax-base"]');
    if (taxBaseEl) taxBaseEl.textContent = fmtRub(m.taxBase);

    // Факт комиссия
    const commEl = document.querySelector('[data-metric="commission"]');
    if (commEl) commEl.textContent = fmtRub(m.commissionSum);

    // Эквайринг
    const acqEl = document.querySelector('[data-metric="acquiring"]');
    if (acqEl) acqEl.textContent = fmtRub(m.acquiringSum);

    // СПП
    const sppEl = document.querySelector('[data-metric="spp"]');
    if (sppEl) sppEl.textContent = fmtRub(m.sppSum);

    // Штрафы
    const penEl = document.querySelector('[data-metric="penalty"]');
    if (penEl) penEl.textContent = fmtRub(m.penaltySum);

    // Компенсации
    const compEl = document.querySelector('[data-metric="compensation"]');
    if (compEl) compEl.textContent = fmtRub(m.compensationSum);

    // Платная приёмка
    const acceptEl = document.querySelector('[data-metric="acceptance"]');
    if (acceptEl) acceptEl.textContent = fmtRub(m.acceptanceSum);

    // Прочие удержания
    const deductEl = document.querySelector('[data-metric="deduction"]');
    if (deductEl) deductEl.textContent = fmtRub(m.deductionSum);

    // Ср. цена продажи
    const avgPriceEl = document.querySelector('[data-metric="avg-sale-price"]');
    if (avgPriceEl) avgPriceEl.textContent = fmtRub(m.avgSalePrice);

    // Ср. стоимость логистики на 1 шт.
    const avgLogEl = document.querySelector('[data-metric="avg-logistics"]');
    if (avgLogEl) avgLogEl.textContent = fmtRub(m.avgLogisticsPerUnit);

    // Средняя прибыль на 1 шт.
    const avgProfEl = document.querySelector('[data-metric="avg-profit"]');
    if (avgProfEl) avgProfEl.textContent = fmtRub(m.avgProfitPerUnit);

    // Себестоимость продаж
    const costEl = document.querySelector('[data-metric="cost-of-sales"]');
    if (costEl) costEl.textContent = m.costOfSalesSum > 0 ? fmtRub(m.costOfSalesSum) : '—';

    // РНП блок
    setText('rnp-profit', fmtRub(m.profitFull));
    setText('rnp-margin', fmtPct(m.margin));
    setText('rnp-roi', m.roi !== null ? m.roi + '%' : '—');
}

// Экспортируем функции для использования в dashboard.html
const WBFormulas = {
    calculateMetrics,
    loadFinanceReport,
    applyMetricsToDashboard,
    fmtMoney,
    fmtRub,
    fmtAds,
    fmtPct,
};
if (typeof window !== 'undefined') window.WBFormulas = WBFormulas;
if (typeof module !== 'undefined' && module.exports) module.exports = WBFormulas;