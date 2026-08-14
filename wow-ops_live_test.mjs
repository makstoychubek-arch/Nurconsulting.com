#!/usr/bin/env node
/** Live data smoke tests for wow features (no browser). */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(URL && KEY, 'need SUPABASE env');

async function api(pathSuffix, opts = {}) {
  const res = await fetch(`${URL}${pathSuffix}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const root = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(root, 'wow-ops.js'), 'utf8');
const sandbox = { window: {}, console };
vm.runInNewContext(code, sandbox);
const WowOps = sandbox.window.WowOps;

test('live localization on Baza July orders', async () => {
  const { json: orders } = await api(
    '/rest/v1/wb_orders?select=is_return,data&cabinet_id=eq.dac666b6-88e7-4eae-997e-6d8519ba779c&order_date=gte.2026-07-01&order_date=lte.2026-07-21&limit=400',
  );
  assert.ok(Array.isArray(orders) && orders.length > 50, 'need orders sample');
  const loc = WowOps.computeLocalization(orders);
  assert.ok(loc.total > 50);
  assert.ok(loc.index >= 0 && loc.index <= 100);
  console.log('localization', loc.index, '% of', loc.total, 'recs', loc.recommendations.length);
});

test('live plan-fact join has planned rows', async () => {
  const { json: plans } = await api(
    '/rest/v1/rnp_plans?select=nm_id,planned_orders&cabinet_id=eq.dac666b6-88e7-4eae-997e-6d8519ba779c&planned_orders=not.is.null&limit=10',
  );
  assert.ok(plans.length >= 1);
});

test('live drr-autopilot responds', async () => {
  const { status, json } = await api('/functions/v1/drr-autopilot', {
    method: 'POST',
    body: JSON.stringify({ days: 1, threshold: 15 }),
  });
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  console.log('drr hot', json.hot, 'sent', json.sent);
});

test('dashboard_summary multi-cab works', async () => {
  const { status, json } = await api('/rest/v1/rpc/dashboard_summary', {
    method: 'POST',
    body: JSON.stringify({
      p_cabinet_id: 'dac666b6-88e7-4eae-997e-6d8519ba779c',
      p_from: '2026-07-01',
      p_to: '2026-07-21',
      p_prev_from: '2026-06-10',
      p_prev_to: '2026-06-30',
    }),
  });
  assert.equal(status, 200);
  assert.ok(json.stock_total > 0);
  assert.ok(json.cur?.orders_count > 0);
});
