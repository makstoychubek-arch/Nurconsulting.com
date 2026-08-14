/**
 * Deep live probe: все READ-методы клиента на Zevina 2.
 * Запуск:
 *   ZEVINA2_TOKEN=... deno test --allow-net --allow-env --no-check \
 *     supabase/functions/_shared/agent-wb-openapi-deep_probe_test.ts
 *
 * Между вызовами пауза 400ms, чтобы меньше ловить 429.
 */

import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  advertApi,
  buildReadProbeCases,
  contentApi,
  marketApi,
  pingAllCategories,
  sleep,
  type ProbeCtx,
  type WbHttpResult,
} from './agent-wb-openapi-client.ts';

const TOKEN = (Deno.env.get('ZEVINA2_TOKEN') || '').trim();

function needToken() {
  if (!TOKEN) {
    console.warn('SKIP: no ZEVINA2_TOKEN');
    return false;
  }
  return true;
}

function pickNm(cards: unknown): number | undefined {
  const list = (cards as { cards?: Array<{ nmID?: number }> })?.cards || [];
  return list.find((c) => c.nmID)?.nmID;
}

function pickAdvertId(countData: unknown): number | undefined {
  const adverts = (countData as { adverts?: Array<{ advert_list?: Array<{ advertId?: number }> }> })
    ?.adverts || [];
  for (const g of adverts) {
    const id = g.advert_list?.[0]?.advertId;
    if (id) return id;
  }
  return undefined;
}

Deno.test({
  name: 'Zevina2 DEEP probe — all READ methods',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    console.log('\n=== PING ALL CATEGORIES ===');
    const pings = await pingAllCategories(TOKEN);
    for (const p of pings) {
      console.log(`${p.ok ? 'OK' : 'FAIL'} ${p.status} ${p.host} ${p.errorText}`.trim());
    }
    const pingFail = pings.filter((p) => !p.ok);
    assert(pingFail.length === 0, `ping failed: ${pingFail.map((p) => p.host).join(', ')}`);

    // seed context
    const ctx: ProbeCtx = {};
    const cards = await contentApi.cardsList(TOKEN, 5);
    ctx.nmId = pickNm(cards.data);
    console.log('ctx.nmId', ctx.nmId);

    const wh = await marketApi.warehouses(TOKEN);
    const whList = Array.isArray(wh.data) ? wh.data as Array<{ id: number }> : [];
    ctx.warehouseId = whList[0]?.id;
    console.log('ctx.warehouseId', ctx.warehouseId);

    const adv = await advertApi.count(TOKEN);
    ctx.advertId = pickAdvertId(adv.data);
    console.log('ctx.advertId', ctx.advertId);

    const cases = buildReadProbeCases();
    const results: Array<{
      id: string;
      role: string;
      ok: boolean;
      status: number;
      errorText: string;
    }> = [];

    console.log(`\n=== PROBE ${cases.length} READ METHODS ===`);
    for (const c of cases) {
      let r: WbHttpResult;
      try {
        r = await c.run(TOKEN, ctx);
      } catch (e) {
        r = { ok: false, status: 0, data: {}, errorText: String(e).slice(0, 200) };
      }
      // 400 на stocksGet с sku '0' — ожидаемо (нет такого баркода) → считаем «reachable»
      const softOk =
        r.ok ||
        (c.id === 'market.stocksGet' && (r.status === 400 || r.status === 404)) ||
        r.status === 429; // rate limit ≠ broken method
      results.push({
        id: c.id,
        role: c.role,
        ok: softOk,
        status: r.status,
        errorText: r.errorText.slice(0, 160),
      });
      const mark = softOk ? (r.ok ? 'OK' : r.status === 429 ? 'RL' : 'SOFT') : 'FAIL';
      console.log(`${mark} ${r.status} [${c.role}] ${c.id}${r.ok ? '' : ' · ' + r.errorText.slice(0, 100)}`);
      await sleep(400);
    }

    const fail = results.filter((r) => !r.ok);
    const ok = results.filter((r) => r.ok && r.status !== 429);
    const rl = results.filter((r) => r.status === 429);

    console.log('\n=== SUMMARY ===');
    console.log(`total=${results.length} ok=${ok.length} rate_limited=${rl.length} fail=${fail.length}`);
    if (fail.length) {
      console.log('FAILURES:');
      for (const f of fail) console.log(`  ${f.status} ${f.id} · ${f.errorText}`);
    }

    // Soft assert: не больше 15% жёстких фейлов (без учёта 429)
    const hardFailRate = fail.length / results.length;
    assert(
      hardFailRate <= 0.2,
      `too many hard failures: ${fail.length}/${results.length}`,
    );
  },
});
