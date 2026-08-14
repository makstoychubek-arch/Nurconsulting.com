/**
 * Ролевые операции WB OpenAPI — чтение сразу, мутации через уже существующие диалоги.
 * Каждая фраза → свой бот по зоне ответственности.
 */

import { resolveCabinet } from './agent-actions.ts';
import { cabinetTokenById } from './agent-wb-api.ts';
import {
  advertApi,
  analyticsApi,
  calendarApi,
  chatApi,
  commonApi,
  contentApi,
  documentsApi,
  feedbacksApi,
  financeApi,
  marketApi,
  pricesApi,
  returnsApi,
  statsApi,
  suppliesApi,
  usersApi,
} from './agent-wb-openapi-client.ts';

export type RoleOpResult = {
  handled: boolean;
  agentKey?: string;
  reply?: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

async function tokenForText(text: string): Promise<{
  token: string;
  cabinetName: string;
  cabinetId: string;
} | { error: string }> {
  const resolved = await resolveCabinet(text);
  if (!resolved.match) {
    // default: если один кандидат с «зевина» не просили — всё равно спросим
    const names = resolved.candidates.map((c) => c.name).join(', ');
    return { error: `Кабинет? ${names || 'Baza / SAAI / Zevina 1/2 / Elium'}` };
  }
  const tok = await cabinetTokenById(resolved.match.id);
  if (!tok) return { error: `${resolved.match.name}: нет токена WB` };
  return {
    token: tok.token,
    cabinetName: tok.name,
    cabinetId: resolved.match.id,
  };
}

function shortJson(data: unknown, max = 900): string {
  try {
    return JSON.stringify(data).slice(0, max);
  } catch {
    return String(data).slice(0, max);
  }
}

/** Интенты → роль (для роутинга). */
export function detectWbRoleOp(text: string): string | null {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!t || t.length > 500) return null;

  // karina
  if (
    /(инфо\s+продавца|seller.?info|рейтинг\s+продавца|подписк[а-я]*\s+jam|новост[а-я]*\s+(портал|wb|вб)|тариф[а-я]*\s+(комисс|короб|приемк)|баланс\s+(продавца|кабинета|лк)|документ[а-я]*\s+wb|список\s+документ)/i
      .test(t) ||
    /(кто\s+в\s+кабинете|пользователи\s+кабинета|доступы\s+кабинета)/i.test(t)
  ) {
    return 'karina';
  }

  // amina
  if (
    /(баланс\s+рк|баланс\s+реклам|бюджет\s+рк|сколько\s+рк|список\s+рк|рекламн[а-я]*\s+баланс|advert|кампани[а-я]*\s+реклам|затрат[а-я]*\s+рк|fullstats|статистик[а-я]*\s+рк|пополнен[а-я]*\s+реклам)/i
      .test(t) ||
    (/рк/.test(t) && /(баланс|бюджет|сколько|список|count|стат|затрат)/i.test(t))
  ) {
    return 'amina';
  }

  // anton
  if (
    /(склад[а-яё]*\s+(fbs|продавца)|мои\s+склады|новые\s+сбороч|сборочн[а-яё]*\s+заказ|новые\s+заказ[а-яё]*\s+fbs|поставк[а-яё]*\s+fbs|офисы\s+wb|склад[а-яё]*\s+wb\s+fbw|fbw\s+склад|архивн[а-яё]*\s+(заказ|сбороч)|пропуск[а-яё]*\s+на\s+склад|автовозврат|приемк[а-яё]*|коледин)/i
      .test(t) ||
    /(заказ[а-яё]*\s+на\s+сборк|сборочн[а-яё]*\s+задани)/i.test(t) ||
    (/склад/i.test(t) && /wb/i.test(t) && !/fbs|продавца|мои/i.test(t))
  ) {
    return 'anton';
  }

  // alina
  if (
    /(неотвеченн[а-я]*\s+(отзыв|вопрос)|новые\s+(отзыв|вопрос)|отзывы?\s+(wb|вб|кабинета)|вопросы?\s+покупател|возврат[а-я]*\s+(покупател|claim)|чат[а-я]*\s+покупател|архивн[а-я]*\s+отзыв|закрепл[а-я]*\s+отзыв)/i
      .test(t) ||
    /(отзывы|вопросы).{0,12}(зевина|база|элиум|saai|кабинет)/i.test(t) ||
    /возвраты?\s+покупател/i.test(t)
  ) {
    return 'alina';
  }

  // saule — cards/prices/stats
  if (
    /(лимит[а-я]*\s+карточек|сколько\s+карточек|список\s+карточек|карточки\s+кабинета|предмет[а-я]*\s+блуз|карантин[а-я]*\s+цен|история\s+загруз[а-я]*\s+цен|буфер\s+цен|промо\s+календар|воронк[а-я]*\s+продаж|бренды?\s+кабинета|корзин[а-я]*\s+карточек|остатк[а-я]*\s+fbw|поступлен[а-я]*\s+на\s+склад|антифрод|самовыкуп[а-я]*\s+отч[её]т)/i
      .test(t) ||
    /(заказ[а-я]*\s+статистик|продаж[а-я]*\s+статистик|выгрузк[а-я]*\s+заказ|выгрузк[а-я]*\s+продаж|статистик[а-я]*\s+заказ|статистик[а-я]*\s+продаж)/i
      .test(t) ||
    /(цены\s+по\s+кабинету|список\s+цен|товары\s+с\s+ценами)/i.test(t)
  ) {
    return 'saule';
  }

  // muha
  if (/(теги\s+карточек|tags\s+wb|медиа\s+карточки)/i.test(t)) {
    return 'muha';
  }

  return null;
}

export async function runWbRoleOp(
  text: string,
  triggeringBot: string,
): Promise<RoleOpResult> {
  const role = detectWbRoleOp(text);
  if (!role) return { handled: false };

  // только свой бот отвечает; остальные глотают
  if (triggeringBot !== role) {
    return { handled: true };
  }

  const cab = await tokenForText(text);
  if ('error' in cab) {
    return { handled: true, agentKey: role, reply: cab.error };
  }
  const { token, cabinetName } = cab;
  const t = text.toLowerCase();

  try {
    if (role === 'karina') {
      if (/рейтинг/i.test(t)) {
        const r = await commonApi.rating(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · рейтинг\n${shortJson(r.data, 700)}`
            : `Рейтинг: ${r.errorText}`,
        };
      }
      if (/jam|подписк/i.test(t)) {
        const r = await commonApi.subscriptions(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · Jam\n${shortJson(r.data, 500)}`
            : `Jam: ${r.errorText}`,
        };
      }
      if (/новост/i.test(t)) {
        const r = await commonApi.news(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · новости портала\n${shortJson(r.data, 800)}`
            : `Новости: ${r.errorText}`,
        };
      }
      if (/тариф|комисс|короб|приемк/i.test(t)) {
        const r = /короб/i.test(t)
          ? await commonApi.tariffsBox(token)
          : /приемк|коэфф/i.test(t)
          ? await commonApi.acceptanceCoeff(token)
          : await commonApi.tariffsCommission(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · тарифы\n${shortJson(r.data, 900)}`
            : `Тарифы: ${r.errorText}`,
        };
      }
      if (/баланс/i.test(t)) {
        const r = await financeApi.balance(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · баланс ЛК\n${shortJson(r.data, 400)}`
            : `Баланс: ${r.errorText}`,
        };
      }
      if (/документ/i.test(t)) {
        const r = await documentsApi.list(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · документы\n${shortJson(r.data, 800)}`
            : `Документы: ${r.errorText}`,
        };
      }
      if (/кто\s+в|пользовател|доступ/i.test(t)) {
        const r = await usersApi.list(token, false);
        const users = Array.isArray((r.data as { users?: unknown[] })?.users)
          ? (r.data as { users: Array<Record<string, unknown>> }).users
          : [];
        if (!r.ok) {
          return { handled: true, agentKey: role, reply: `Доступы: ${r.errorText}` };
        }
        const lines = users.slice(0, 15).map((u, i) =>
          `${i + 1}) ${u.firstName || ''} ${u.secondName || ''}`.trim() +
            ` · ${u.phone || '—'} · id ${u.id}${u.isOwner ? ' · owner' : ''}`
        );
        return {
          handled: true,
          agentKey: role,
          reply: [`${cabinetName} · пользователи`, ...lines].join('\n') ||
            `${cabinetName}: пусто`,
        };
      }
      // default seller info
      const r = await commonApi.sellerInfo(token);
      const d = r.data as Record<string, unknown>;
      return {
        handled: true,
        agentKey: role,
        reply: r.ok
          ? [
            `${cabinetName} · продавец`,
            `имя: ${d.name || '—'}`,
            `бренд: ${d.tradeMark || '—'}`,
            `ИНН: ${d.tin || '—'}`,
            `sid: ${d.sid || '—'}`,
          ].join('\n')
          : `Инфо: ${r.errorText}`,
      };
    }

    if (role === 'amina') {
      if (/затрат|upd|пополнен/i.test(t)) {
        const from = daysAgoIso(7);
        const to = todayIso();
        const r = /пополнен/i.test(t)
          ? await advertApi.payments(token, daysAgoIso(30), to)
          : await advertApi.costsHistory(token, from, to);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · ${/пополнен/i.test(t) ? 'пополнения' : 'затраты'} РК\n${shortJson(r.data, 800)}`
            : `РК history: ${r.errorText}`,
        };
      }
      if (/баланс|бюджет/i.test(t) && !/список|сколько|стат|затрат/i.test(t)) {
        const r = await advertApi.balance(token);
        const d = r.data as Record<string, unknown>;
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · реклама\nbalance ${d.balance ?? '—'} · net ${d.net ?? '—'} ${d.currency || 'RUB'}`
            : `РК баланс: ${r.errorText}`,
        };
      }
      const r = await advertApi.count(token);
      const adverts = Array.isArray((r.data as { adverts?: unknown[] })?.adverts)
        ? (r.data as { adverts: Array<Record<string, unknown>> }).adverts
        : [];
      const lines = adverts.slice(0, 8).map((a) =>
        `type ${a.type} status ${a.status}: ${a.count} шт`
      );
      return {
        handled: true,
        agentKey: role,
        reply: r.ok
          ? [`${cabinetName} · РК`, ...lines].join('\n')
          : `РК: ${r.errorText}`,
      };
    }

    if (role === 'anton') {
      if (/архивн/i.test(t)) {
        const r = await marketApi.ordersArchive(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · архив сборочных\n${shortJson(r.data, 700)}`
            : `Архив: ${r.errorText}`,
        };
      }
      if (/пропуск/i.test(t)) {
        const r = await marketApi.passes(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · пропуска\n${shortJson(r.data, 700)}`
            : `Пропуска: ${r.errorText}`,
        };
      }
      if (/автовозврат/i.test(t)) {
        const r = await marketApi.autoreturns(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · автовозврат\n${shortJson(r.data, 500)}`
            : `Автовозврат: ${r.errorText}`,
        };
      }
      if (/fbw|приемк|коледин/i.test(t) || (/склад/i.test(t) && /wb/i.test(t) && !/fbs|продавца|мои/i.test(t))) {
        const r = await suppliesApi.warehouses(token);
        const raw = r.data as unknown;
        const list = Array.isArray(raw)
          ? raw as Array<Record<string, unknown>>
          : Array.isArray((raw as { data?: unknown })?.data)
          ? (raw as { data: Array<Record<string, unknown>> }).data
          : Array.isArray((raw as { result?: unknown })?.result)
          ? (raw as { result: Array<Record<string, unknown>> }).result
          : [];
        const active = list.filter((w) => w.isActive !== false);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? active.length
              ? [
                `${cabinetName} · склады WB (FBW)`,
                ...active.slice(0, 12).map((w) =>
                  `• ${w.name || w.Name || '?'} · id ${w.ID ?? w.id ?? '—'}`
                ),
              ].join('\n')
              : `${cabinetName} · склады WB (FBW): список пуст (или другой формат ответа WB)`
            : `FBW: ${r.errorText}`,
        };
      }
      if (/офис/i.test(t)) {
        const r = await marketApi.offices(token);
        const list = Array.isArray(r.data) ? r.data as Array<Record<string, unknown>> : [];
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? [
              `${cabinetName} · офисы WB`,
              ...list.slice(0, 10).map((o) => `• ${o.name || o.city || o.id} · ${o.id}`),
            ].join('\n')
            : `Офисы: ${r.errorText}`,
        };
      }
      if (/сбороч|сборк|новые\s+заказ|orders\/new/i.test(t)) {
        const r = await marketApi.ordersNew(token);
        const orders = Array.isArray((r.data as { orders?: unknown[] })?.orders)
          ? (r.data as { orders: unknown[] }).orders
          : [];
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · новые сборочные: ${orders.length}`
            : `Заказы: ${r.errorText}`,
        };
      }
      if (/поставк/i.test(t)) {
        const r = await marketApi.supplies(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · поставки FBS\n${shortJson(r.data, 700)}`
            : `Поставки: ${r.errorText}`,
        };
      }
      const r = await marketApi.warehouses(token);
      const list = Array.isArray(r.data) ? r.data as Array<Record<string, unknown>> : [];
      return {
        handled: true,
        agentKey: role,
        reply: r.ok
          ? [
            `${cabinetName} · склады продавца (FBS)`,
            ...list.map((w) => `• ${w.name} · id ${w.id} · office ${w.officeId}`),
          ].join('\n')
          : `Склады: ${r.errorText}`,
      };
    }

    if (role === 'alina') {
      if (/закрепл|pins/i.test(t)) {
        const r = await feedbacksApi.pins(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · закреплённые отзывы\n${shortJson(r.data, 700)}`
            : `Pins: ${r.errorText}`,
        };
      }
      if (/архивн.*отзыв|отзыв.*архив/i.test(t)) {
        const r = await feedbacksApi.feedbacksArchive(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · архив отзывов\n${shortJson(r.data, 800)}`
            : `Архив отзывов: ${r.errorText}`,
        };
      }
      if (/вопрос/i.test(t)) {
        const r = await feedbacksApi.questions(token, false);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · вопросы\n${shortJson(r.data, 800)}`
            : `Вопросы: ${r.errorText}`,
        };
      }
      if (/возврат|claim/i.test(t)) {
        const r = await returnsApi.claims(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · возвраты\n${shortJson(r.data, 800)}`
            : `Возвраты: ${r.errorText}`,
        };
      }
      if (/чат/i.test(t)) {
        const r = await chatApi.chats(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · чаты\n${shortJson(r.data, 600)}`
            : `Чаты: ${r.errorText}`,
        };
      }
      const count = await feedbacksApi.unansweredCount(token);
      const flags = await feedbacksApi.newFlags(token);
      const d = count.data as { data?: Record<string, unknown> };
      const f = flags.data as { data?: Record<string, unknown> };
      return {
        handled: true,
        agentKey: role,
        reply: [
          `${cabinetName} · отзывы/вопросы`,
          count.ok
            ? `неотвеченных: ${d?.data?.countUnanswered ?? '—'} (сегодня ${d?.data?.countUnansweredToday ?? '—'})`
            : `count: ${count.errorText}`,
          flags.ok
            ? `новые отзывы: ${f?.data?.hasNewFeedbacks ? 'да' : 'нет'} · вопросы: ${f?.data?.hasNewQuestions ? 'да' : 'нет'}`
            : `flags: ${flags.errorText}`,
        ].join('\n'),
      };
    }

    if (role === 'saule') {
      if (/бренд/i.test(t)) {
        const subj = await contentApi.subjects(token, 'Блузки');
        const rows = Array.isArray(subj.data)
          ? subj.data as Array<{ subjectID?: number; id?: number }>
          : Array.isArray((subj.data as { data?: unknown[] })?.data)
          ? (subj.data as { data: Array<{ subjectID?: number; id?: number }> }).data
          : [];
        const subjectId = rows[0]?.subjectID || rows[0]?.id;
        if (!subjectId) {
          return {
            handled: true,
            agentKey: role,
            reply: `${cabinetName}: не нашёл subjectId для брендов`,
          };
        }
        const r = await contentApi.brands(token, Number(subjectId));
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · бренды (subject ${subjectId})\n${shortJson(r.data, 700)}`
            : `Бренды: ${r.errorText}`,
        };
      }
      if (/корзин/i.test(t)) {
        const r = await contentApi.cardsTrashList(token, 10);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · корзина карточек\n${shortJson(r.data, 700)}`
            : `Корзина: ${r.errorText}`,
        };
      }
      if (/антифрод|самовыкуп/i.test(t)) {
        const r = await analyticsApi.antifraud(token, daysAgoIso(7), todayIso());
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · антифрод\n${shortJson(r.data, 800)}`
            : `Антифрод: ${r.errorText}`,
        };
      }
      if (/остатк.*fbw|fbw.*остат|поступлен/i.test(t)) {
        return {
          handled: true,
          agentKey: role,
          reply:
            `${cabinetName}: старые /supplier/stocks и /incomes сняты WB. Смотри analytics stocks-report / warehouse_remains.`,
        };
      }
      if (/лимит/i.test(t)) {
        const r = await contentApi.cardsLimits(token);
        const d = (r.data as { data?: Record<string, unknown> })?.data || {};
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · лимиты карточек\nfree ${d.freeLimits ?? '—'} · paid ${d.paidLimits ?? '—'}`
            : `Лимиты: ${r.errorText}`,
        };
      }
      if (/предмет|блуз/i.test(t) && !/карточк/i.test(t)) {
        const name = t.match(/предмет[а-яё]*\s+(\S+)/i)?.[1] || 'Блузки';
        const r = await contentApi.subjects(token, name);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · предметы «${name}»\n${shortJson(r.data, 700)}`
            : `Предметы: ${r.errorText}`,
        };
      }
      if (/карантин/i.test(t)) {
        const r = await pricesApi.quarantine(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · карантин цен\n${shortJson(r.data, 700)}`
            : `Карантин: ${r.errorText}`,
        };
      }
      if (/буфер\s+цен|история\s+загруз/i.test(t)) {
        return {
          handled: true,
          agentKey: role,
          reply:
            `${cabinetName}: нужен uploadID загрузки цен. Сначала поменяй цену («да»), потом спроси статус по ID.`,
        };
      }
      if (/промо\s+календар/i.test(t)) {
        const r = await calendarApi.promotions(token);
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · промо\n${shortJson(r.data, 800)}`
            : `Промо: ${r.errorText}`,
        };
      }
      if (/воронк/i.test(t)) {
        const cards = await contentApi.cardsList(token, 3);
        const list = Array.isArray((cards.data as { cards?: unknown[] })?.cards)
          ? (cards.data as { cards: Array<{ nmID: number }> }).cards
          : [];
        const nmIds = list.map((c) => c.nmID).filter(Boolean).slice(0, 3);
        if (!nmIds.length) {
          return { handled: true, agentKey: role, reply: `${cabinetName}: нет nm для воронки` };
        }
        const r = await analyticsApi.salesFunnel(
          token,
          nmIds,
          daysAgoIso(7),
          todayIso(),
        );
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · воронка nm ${nmIds.join(',')}\n${shortJson(r.data, 900)}`
            : `Воронка: ${r.errorText}`,
        };
      }
      if (/статистик|выгрузк/.test(t) && /заказ/.test(t)) {
        const r = await statsApi.orders(token, daysAgoIso(2));
        const arr = Array.isArray(r.data) ? r.data : [];
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · заказы (stats) за 2 дня: ${arr.length}`
            : `Orders stats: ${r.errorText}`,
        };
      }
      if (/статистик|выгрузк/.test(t) && /продаж/.test(t)) {
        const r = await statsApi.sales(token, daysAgoIso(2));
        const arr = Array.isArray(r.data) ? r.data : [];
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? `${cabinetName} · продажи (stats) за 2 дня: ${arr.length}`
            : `Sales stats: ${r.errorText}`,
        };
      }
      if (/цен/.test(t)) {
        const r = await pricesApi.listGoods(token, 5);
        const goods = Array.isArray(
          (r.data as { data?: { listGoods?: unknown[] } })?.data?.listGoods,
        )
          ? (r.data as { data: { listGoods: Array<Record<string, unknown>> } }).data
            .listGoods
          : [];
        const lines = goods.slice(0, 5).map((g) =>
          `nm ${g.nmID} · ${g.vendorCode} · скидка ${g.discount}%`
        );
        return {
          handled: true,
          agentKey: role,
          reply: r.ok
            ? [`${cabinetName} · цены`, ...lines].join('\n')
            : `Цены: ${r.errorText}`,
        };
      }
      // default cards list
      const r = await contentApi.cardsList(token, 5);
      const cards = Array.isArray((r.data as { cards?: unknown[] })?.cards)
        ? (r.data as { cards: Array<Record<string, unknown>> }).cards
        : [];
      const lines = cards.map((c) =>
        `nm ${c.nmID} · ${c.vendorCode || c.title || '—'}`
      );
      return {
        handled: true,
        agentKey: role,
        reply: r.ok
          ? [`${cabinetName} · карточки`, ...lines].join('\n')
          : `Карточки: ${r.errorText}`,
      };
    }

    if (role === 'muha') {
      const r = await contentApi.tags(token);
      return {
        handled: true,
        agentKey: role,
        reply: r.ok
          ? `${cabinetName} · теги\n${shortJson(r.data, 600)}`
          : `Теги: ${r.errorText}`,
      };
    }
  } catch (e) {
    return {
      handled: true,
      agentKey: role,
      reply: `Сбой WB API: ${String(e).slice(0, 200)}`,
    };
  }

  return { handled: false };
}
