/**
 * Unit tests for wow-ops pure helpers (node-compatible extract).
 * Run: node --test wow-ops_test.mjs  OR  deno test (via copy)
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, 'wow-ops.js'), 'utf8');
const sandbox = { window: {}, console };
vm.runInNewContext(code + '\nthis.WowOps = window.WowOps;', sandbox);
const WowOps = sandbox.window.WowOps;

test('localization: local warehouse matches buyer okrug', () => {
  const orders = [
    { data: { oblastOkrugName: 'Центральный федеральный округ', warehouseName: 'Электросталь' } },
    { data: { oblastOkrugName: 'Центральный федеральный округ', warehouseName: 'Электросталь' } },
    { data: { oblastOkrugName: 'Уральский федеральный округ', warehouseName: 'Электросталь' } },
    { data: { oblastOkrugName: 'Уральский федеральный округ', warehouseName: 'Электросталь' } },
    { data: { oblastOkrugName: 'Уральский федеральный округ', warehouseName: 'Электросталь' } },
  ];
  const loc = WowOps.computeLocalization(orders);
  assert.equal(loc.total, 5);
  assert.equal(loc.matched, 2);
  assert.ok(loc.index > 30 && loc.index < 50);
  assert.ok(loc.recommendations.length >= 1);
  assert.match(loc.recommendations[0].warehouse, /Екатеринбург/);
});

test('drr formula', () => {
  assert.equal(WowOps.computeDrr(2000, 10000), 20);
  assert.equal(WowOps.computeDrr(100, 0), 999);
  assert.equal(WowOps.computeDrr(0, 0), 0);
});

test('turnover days', () => {
  assert.equal(WowOps.computeTurnoverDays(700, 70, 7), 70);
  assert.equal(WowOps.computeTurnoverDays(100, 0, 7), null);
});

test('ctr diagnosis detects drop', () => {
  const d = WowOps.diagnoseCtr(
    { impressions: 10000, clicks: 100, ad_spend: 5000 },
    { impressions: 5000, clicks: 150, ad_spend: 2000 },
  );
  assert.ok(d.ctrNow < d.ctrPrev);
  assert.ok(d.deltaPct < 0);
  assert.ok(d.factors.length >= 1);
});

test('warehouse okrug map', () => {
  assert.equal(WowOps.warehouseOkrug('Казань'), 'Приволжский');
  assert.equal(WowOps.warehouseOkrug('Екатеринбург - Перспективная 14'), 'Уральский');
});
