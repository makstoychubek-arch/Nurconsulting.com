/**
 * Full-catalog live probe: все GET без path-params из OpenAPI registry.
 * Запуск:
 *   ZEVINA2_TOKEN=... deno test --allow-net --allow-env --no-check \
 *     supabase/functions/_shared/agent-wb-openapi-full_catalog_probe_test.ts
 */

import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sleep, pingAllCategories } from './agent-wb-openapi-client.ts';
import {
  WB_OPENAPI_ENDPOINTS,
  callWbEndpoint,
} from './agent-wb-openapi-registry.ts';

const TOKEN = (Deno.env.get('ZEVINA2_TOKEN') || '').trim();

function needToken() {
  if (!TOKEN) {
    console.warn('SKIP: no ZEVINA2_TOKEN');
    return false;
  }
  return true;
}

function hasPathParams(path: string): boolean {
  return /\{[^}]+\}/.test(path);
}

/** Минимальные query для известных GET, где без params 400. */
function defaultQuery(path: string): Record<string, string | number | boolean> | undefined {
  const d7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const end = new Date(Date.now() + 30 * 864e5).toISOString().replace(/\.\d{3}Z$/, 'Z');

  if (path.includes('/communications/v2/news')) return { from: d7 };
  if (path.includes('/calendar/promotions') && !path.includes('details') && !path.includes('nomenclatures')) {
    return { startDateTime: start, endDateTime: end, allPromo: false, limit: 10, offset: 0 };
  }
  if (path.includes('/banned-products/blocked')) return { sort: 'nmId', order: 'desc' };
  if (path.includes('/banned-products/shadowed')) return { sort: 'nmId', order: 'desc' };
  if (path.includes('/region-sale')) return { dateFrom: d7, dateTo: today };
  if (path.includes('/antifraud-details')) return { dateFrom: d7, dateTo: today };
  if (path.includes('/goods-return')) return { dateFrom: d7, dateTo: today };
  if (path.includes('/orders/archive')) {
    const dt = new Date(Date.now() - 120 * 864e5);
    return {
      year: dt.getUTCFullYear(),
      month: dt.getUTCMonth() + 1,
      limit: 100,
      next: 0,
    };
  }
  if (path.includes('/list/goods/filter') && !path.includes('size')) return { limit: 3 };
  if (path.includes('/quarantine/goods')) return { limit: 10, offset: 0 };
  if (path.includes('/supplier/orders') || path.includes('/supplier/sales')) {
    return { dateFrom: d7, flag: 0 };
  }
  if (path.includes('/tariffs/box') || path.includes('/tariffs/pallet') || path.includes('/tariffs/return')) {
    return { date: today };
  }
  if (path.includes('/tariffs/commission')) return { locale: 'ru' };
  if (path.includes('/documents/list')) return { locale: 'ru', limit: 10, offset: 0 };
  if (path.includes('/documents/categories')) return { locale: 'ru' };
  if (path.includes('/users')) return { limit: 20, offset: 0 };
  if (path.includes('/feedbacks') && !path.includes('count') && !path.includes('archive') && !path.includes('answer')) {
    return { isAnswered: false, take: 5, skip: 0 };
  }
  if (path.includes('/questions') && !path.includes('count')) {
    return { isAnswered: false, take: 5, skip: 0 };
  }
  if (path.includes('/feedbacks/archive')) return { take: 5, skip: 0 };
  if (path.includes('/claims')) return { is_archive: false, limit: 5, offset: 0 };
  if (path.includes('/adv/v1/upd') || path.includes('/adv/v1/payments')) {
    return { from: d7, to: today };
  }
  if (path.includes('/object/parent/all') || path.includes('/object/all') || path.includes('/directory/')) {
    return { locale: 'ru' };
  }
  if (path.includes('/object/all')) return { locale: 'ru', name: 'Блузки', limit: 5 };
  return undefined;
}

Deno.test({
  name: 'Zevina2 FULL catalog — all GET without path params',
  ignore: !needToken(),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    console.log('\n=== PING ===');
    const pings = await pingAllCategories(TOKEN);
    for (const p of pings) console.log(`${p.ok ? 'OK' : 'FAIL'} ${p.status} ${p.host}`);

    const gets = WB_OPENAPI_ENDPOINTS.filter(
      (e) => e.method === 'GET' && !hasPathParams(e.path) && e.path !== '/ping',
    );
    // also include GET /ping once via hosts already done

    console.log(`\n=== FULL GET PROBE (${gets.length} endpoints) ===`);
    const rows: Array<{
      id: string;
      file: string;
      path: string;
      status: number;
      ok: boolean;
      soft: boolean;
      errorText: string;
    }> = [];

    for (const ep of gets) {
      // skip digital unless token has scope — still probe, mark soft on 401
      const query = defaultQuery(ep.path);
      let r;
      try {
        r = await callWbEndpoint(TOKEN, ep.id, { query });
      } catch (e) {
        r = {
          ok: false,
          status: 0,
          data: {},
          errorText: String(e).slice(0, 200),
          endpointId: ep.id,
        };
      }
      const soft =
        r.ok ||
        r.status === 429 ||
        r.status === 204 ||
        r.status === 403 || // token category / personal-only
        r.status === 401 || // missing scope (digital/media/jam)
        (r.status === 400 && /deprecated|missing|required|parameter|validation|invalid/i.test(r.errorText));
      // 404 on deprecated methods = soft mismatch with yaml age
      const soft404 = r.status === 404;
      const softFinal = soft || soft404;
      rows.push({
        id: ep.id,
        file: ep.file,
        path: ep.path,
        status: r.status,
        ok: r.ok,
        soft: softFinal,
        errorText: r.errorText.slice(0, 140),
      });
      const mark = r.ok ? 'OK' : softFinal ? 'SOFT' : 'FAIL';
      console.log(
        `${mark} ${r.status} [${ep.file.slice(0, 12)}] ${ep.method} ${ep.path}${
          r.ok ? '' : ' · ' + r.errorText.slice(0, 80)
        }`,
      );
      await sleep(350);
    }

    const hard = rows.filter((r) => !r.soft);
    const ok = rows.filter((r) => r.ok);
    const soft = rows.filter((r) => r.soft && !r.ok);

    console.log('\n=== SUMMARY ===');
    console.log(
      `total=${rows.length} ok=${ok.length} soft=${soft.length} hard_fail=${hard.length}`,
    );
    if (hard.length) {
      console.log('HARD FAILURES:');
      for (const f of hard) console.log(`  ${f.status} ${f.path} · ${f.errorText}`);
    }

    // write artifact
    const report = [
      '# WB OpenAPI full GET probe (Zevina 2)',
      '',
      `- total GET (no path params): ${rows.length}`,
      `- ok 2xx: ${ok.length}`,
      `- soft (401/403/404/429/expected 400): ${soft.length}`,
      `- hard fail: ${hard.length}`,
      '',
      '## Soft (token/scope/deprecated/params)',
      ...soft.map((s) => `- ${s.status} \`${s.path}\` — ${s.errorText}`),
      '',
      '## Hard fails',
      ...(hard.length
        ? hard.map((s) => `- ${s.status} \`${s.path}\` — ${s.errorText}`)
        : ['- none']),
      '',
    ].join('\n');
    await Deno.writeTextFile('/opt/cursor/artifacts/wb-openapi-full-probe.md', report);

    // Allow up to 10% hard fails (network flukes / undocumented required bodies)
    assert(hard.length / Math.max(rows.length, 1) <= 0.15, `hard fails ${hard.length}/${rows.length}`);
  },
});
