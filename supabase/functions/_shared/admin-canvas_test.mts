// Узлы клиентов и кабинетов для холста: без токенов, с понятными причинами.
import assert from 'node:assert/strict';
import { buildClientNodes, cabinetReasons, placeClients } from './admin-canvas.ts';

const cab = (o: any) => ({ id: 'c1', name: 'ИП Тест', user_id: 'u1', nr_managed: true, adv_enabled: false, adv_token_valid: null, has_token: true, ...o });

assert.equal(cabinetReasons(cab({})).status, 'ok');
assert.equal(cabinetReasons(cab({ has_token: false })).status, 'bad');
assert.ok(cabinetReasons(cab({ adv_enabled: true, adv_token_valid: false })).reasons[0].includes('рекламы'));
assert.ok(cabinetReasons(cab({ nr_managed: false })).reasons.length === 1);

const { nodes, edges } = buildClientNodes([cab({}), cab({ id: 'c2', has_token: false })], [{ id: 'u1', email: 'a@b.kg' }]);
assert.equal(nodes.filter((n) => n.kind === 'client').length, 1, 'один клиент на двух кабинетах');
assert.equal(nodes.filter((n) => n.kind === 'cabinet').length, 2);
assert.equal(edges.length, 2);
assert.ok(!JSON.stringify(nodes).includes('token":"'), 'в узлах нет токенов');
assert.equal(nodes[0].status, 'warn', 'кабинет без токена тревожит клиента');

const pos = placeClients(nodes, edges, 5000, 0, new Set(['cab:c1']));
assert.ok(pos.has('client:u1') && pos.has('cab:c2') && !pos.has('cab:c1'), 'положение уже стоящих узлов не трогаем');
console.log('admin-canvas_test: ok');
