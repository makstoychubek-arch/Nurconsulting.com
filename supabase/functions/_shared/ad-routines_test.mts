import assert from 'node:assert/strict';
import {
    CAP_RULES, ZEVINA_CAMPAIGNS, bidNote, eveningPaceVerdict, eveningTopup, morningBidVerdict, morningTopup,
    round5, scaleBid, zevinaBidVerdict, zevinaTopup,
} from './ad-routines.ts';

const baza = CAP_RULES[0], elium = CAP_RULES[1];

// округление и пределы ставок
assert.equal(round5(1300.5), 1300);
assert.equal(scaleBid(1445, 0.9, 600), 1300);
assert.equal(scaleBid(915, 1.1, 100), 1005);
assert.equal(scaleBid(620, 0.9, 600), 600, 'не ниже минимума');
assert.equal(scaleBid(2400, 1.1, 100, 2500), 2500, 'не выше потолка');

// Baza: вчера 15 заказов, расход 7252, заказ 483: снижаем на 10%
let v: any = morningBidVerdict(baza, { orders: 15, spend: 7252 }, { orders: 21, spend: 7092 });
assert.equal(v.mult, 0.9);
// падение заказов больше чем на 30% к позавчера: не решаем, сообщаем
v = morningBidVerdict(baza, { orders: 10, spend: 3000 }, { orders: 21, spend: 7092 });
assert.equal(v.hold, true); assert.equal(v.alert, true);
// ровно минус 30% не тревога (Elium 20 → 14)
v = morningBidVerdict(elium, { orders: 14, spend: 3014 }, { orders: 20, spend: 2268 });
assert.equal(v.mult, 0.9, 'Elium: заказ 215 больше 120');
// цена заказа в норме 250–350: не меняем
v = morningBidVerdict(baza, { orders: 20, spend: 6000 }, { orders: 18, spend: 5000 });
assert.equal(v.hold, true);
// дёшево и заказов меньше: поднимаем на 5%
v = morningBidVerdict(baza, { orders: 20, spend: 4000 }, { orders: 25, spend: 5000 });
assert.equal(v.mult, 1.05);
// нет заказов: не трогаем
assert.equal((morningBidVerdict(baza, { orders: 0, spend: 100 }, { orders: 5, spend: 100 }) as any).hold, true);

// утреннее пополнение: до 3300, но лимит «потрачено + остаток ≤ 6000» и баланс
assert.equal(morningTopup(baza, 0, 0, 100000), 3300);
assert.equal(morningTopup(baza, 3500, 0, 100000), 0, 'уже выше');
assert.equal(morningTopup(baza, 0, 5000, 100000), 1000, 'лимит дня съедает пополнение');
assert.equal(morningTopup(baza, 0, 6080, 100000), 0, 'лимит уже превышен');
assert.equal(morningTopup(baza, 0, 0, 800), 800, 'не больше баланса');
// вечером: допополнить до лимита, если остатка мало
assert.equal(eveningTopup(baza, 1000, 3000, 100000), 2000);
assert.equal(eveningTopup(baza, 1600, 3000, 100000), 0, 'остатка достаточно');
assert.equal(eveningTopup(elium, 400, 3300, 100000), 0, 'до лимита 3600 уже почти всё: меньше 100');
assert.equal(eveningTopup(elium, 400, 2000, 100000), 1200);
// темп
assert.equal((eveningPaceVerdict(baza, 4500) as any).mult, 0.9);
assert.equal((eveningPaceVerdict(baza, 3000) as any).hold, true);

// Zevina: ДРР кабинета и цена заказа
const reg = ZEVINA_CAMPAIGNS.find((c) => c.advertId === 39497232)!;
assert.equal((zevinaBidVerdict(reg, { orders: 62, spend: 9221 }, 2.8, false) as any).mult, 1.1);
assert.equal((zevinaBidVerdict(reg, { orders: 36, spend: 19251 }, 2.8, false) as any).hold, true, 'заказ 535 больше 300');
assert.equal((zevinaBidVerdict(reg, { orders: 36, spend: 5000 }, 16, false) as any).mult, 0.9, 'ДРР выше 15%');
assert.equal((zevinaBidVerdict(reg, { orders: 36, spend: 5000 }, 12, false) as any).hold, true, 'ДРР 10–15%: не меняем');
const drain = ZEVINA_CAMPAIGNS.find((c) => c.advertId === 41028166)!;
assert.equal((zevinaBidVerdict(drain, { orders: 7, spend: 1910 }, 2.8, false) as any).hold, true);
const dv: any = zevinaBidVerdict(drain, { orders: 0, spend: 200 }, 2.8, true);
assert.equal(dv.mult, 0.9); assert.equal(dv.alert, true);
// Свитер айвори не пополняется автоматически
assert.equal(ZEVINA_CAMPAIGNS.find((c) => c.advertId === 40732240)!.topup, undefined);
// пополнение Zevina: до 1500, не больше 3000 в день на все
assert.deepEqual(zevinaTopup(0, 0, 999999), { amount: 1500, spentToday: 1500 });
assert.deepEqual(zevinaTopup(0, 1500, 999999), { amount: 1500, spentToday: 3000 });
assert.deepEqual(zevinaTopup(0, 3000, 999999), { amount: 0, spentToday: 3000 });
assert.deepEqual(zevinaTopup(800, 0, 999999), { amount: 0, spentToday: 0 }, 'остаток выше порога 500');

// короткий комментарий в РНП
const note = bidNote('РК СПС 10:00', 1445, 1300, 'заказ 483 ₽ (цель 300)');
assert.equal(note, 'РК СПС 10:00: ставка 14,45 → 13,00 ₽, заказ 483 ₽ (цель 300)');
assert.ok(bidNote('x'.repeat(200), 1, 2, 'y').length <= 100);

console.log('ad-routines_test: ok');
