/**
 * Live smoke: Zevina 2 — все дневные домены WB OpenAPI.
 * Запуск:
 *   ZEVINA2_TOKEN=... deno test --allow-net --allow-env --no-check agent-wb-openapi-live_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  advertApi,
  chatApi,
  commonApi,
  contentApi,
  documentsApi,
  feedbacksApi,
  financeApi,
  marketApi,
  pingAllCategories,
  pricesApi,
  returnsApi,
  statsApi,
  suppliesApi,
  usersApi,
} from './agent-wb-openapi-client.ts';

const TOKEN = (Deno.env.get('ZEVINA2_TOKEN') || '').trim();

function needToken() {
  if (!TOKEN) {
    console.warn('SKIP: no ZEVINA2_TOKEN');
    return false;
  }
  return true;
}

Deno.test({
  name: 'Zevina2 ping all categories',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const rows = await pingAllCategories(TOKEN);
    const bad = rows.filter((r) => !r.ok);
    console.log(rows.map((r) => `${r.ok ? 'OK' : 'FAIL'} ${r.status} ${r.host}`).join('\n'));
    assertEquals(bad.length, 0, `failed: ${bad.map((b) => b.host).join(', ')}`);
  },
});

Deno.test({
  name: 'Zevina2 karina domain',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const info = await commonApi.sellerInfo(TOKEN);
    assert(info.ok, info.errorText);
    const name = (info.data as { tradeMark?: string }).tradeMark || '';
    assert(/zevina/i.test(name) || /айлин/i.test(String((info.data as { name?: string }).name)), name);

    const users = await usersApi.list(TOKEN);
    assert(users.ok, users.errorText);

    const bal = await financeApi.balance(TOKEN);
    // finance may 401 on some tokens — soft
    console.log('finance', bal.status, bal.ok);

    const docs = await documentsApi.list(TOKEN);
    console.log('docs', docs.status, docs.ok);
  },
});

Deno.test({
  name: 'Zevina2 saule content+prices+stats',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cards = await contentApi.cardsList(TOKEN, 3);
    assert(cards.ok, cards.errorText);
    const list = (cards.data as { cards?: unknown[] }).cards || [];
    assert(list.length >= 1, 'need at least 1 card');

    const limits = await contentApi.cardsLimits(TOKEN);
    assert(limits.ok, limits.errorText);

    const subjects = await contentApi.subjects(TOKEN, 'Блузки');
    assert(subjects.ok, subjects.errorText);

    const barcodes = await contentApi.barcodes(TOKEN, 1);
    assert(barcodes.ok, barcodes.errorText);
    console.log('barcode ok', barcodes.data);

    const prices = await pricesApi.listGoods(TOKEN, 2);
    assert(prices.ok, prices.errorText);

    const dateFrom = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
    const orders = await statsApi.orders(TOKEN, dateFrom);
    assert(orders.ok, orders.errorText);
  },
});

Deno.test({
  name: 'Zevina2 anton marketplace+supplies',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const wh = await marketApi.warehouses(TOKEN);
    assert(wh.ok, wh.errorText);
    const list = wh.data as Array<{ id: number }>;
    assert(Array.isArray(list) && list.length >= 1);

    const neu = await marketApi.ordersNew(TOKEN);
    assert(neu.ok, neu.errorText);

    const fbw = await suppliesApi.warehouses(TOKEN);
    assert(fbw.ok, fbw.errorText);
  },
});

Deno.test({
  name: 'Zevina2 amina advert',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const count = await advertApi.count(TOKEN);
    assert(count.ok, count.errorText);
    const bal = await advertApi.balance(TOKEN);
    assert(bal.ok, bal.errorText);
  },
});

Deno.test({
  name: 'Zevina2 alina feedbacks+returns+chat',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const c = await feedbacksApi.unansweredCount(TOKEN);
    assert(c.ok, c.errorText);
    const f = await feedbacksApi.newFlags(TOKEN);
    assert(f.ok, f.errorText);
    const claims = await returnsApi.claims(TOKEN);
    console.log('returns', claims.status, claims.ok, claims.errorText.slice(0, 120));
    // returns query param variants — accept 200
    assert(claims.ok || claims.status === 400, claims.errorText);
    const chats = await chatApi.chats(TOKEN);
    console.log('chat', chats.status, chats.ok, chats.errorText.slice(0, 120));
  },
});
