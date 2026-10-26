// Изменение цен через ИИ: сопоставление артикулов и границы безопасности.
import assert from 'node:assert/strict';
import { planPriceChanges, summarize, WRITE_LIMITS, type PriceCard } from './mcp-write.ts';

const cards: PriceCard[] = [
    { nmID: 1, vendorCode: 'костюм_оверсайз_серый', price: 5000, discount: 40 },
    { nmID: 2, vendorCode: 'костюм_оверсайз_черный', price: 5000, discount: 40 },
    { nmID: 3, vendorCode: 'свитер_белый', price: 3000, discount: 30 },
];

const ok = planPriceChanges(cards, [{ article: 'свитер_белый', price: 3200 }]);
assert.equal(ok.errors.length, 0);
assert.deepEqual(ok.items[0].will, { price: 3200, discount: 30, final: 2240 }, 'скидка сохраняется, если её не меняли');
assert.deepEqual(ok.items[0].was, { price: 3000, discount: 30, final: 2100 });
assert.match(summarize(ok.items), /свитер_белый: цена 3 000 → 3 200/);

assert.equal(planPriceChanges(cards, [{ article: 'костюм', price: 4000 }]).errors.length, 1, 'неоднозначный артикул не угадываем');
assert.match(planPriceChanges(cards, [{ article: 'нет_такого', price: 1 }]).errors[0], /нет/);
assert.equal(planPriceChanges(cards, [{ nm_id: 3, discount: 35 }]).items[0].will.discount, 35, 'по номеру карточки тоже');
assert.equal(planPriceChanges(cards, [{ article: 'свитер_белый', price: 9000 }]).items.length, 0, 'рост больше 25% отклонён');
assert.equal(planPriceChanges(cards, [{ article: 'свитер_белый', discount: 90 }]).items.length, 0, 'скидка выше предела отклонена');
assert.equal(planPriceChanges(cards, [{ article: 'свитер_белый', price: -5 }]).items.length, 0, 'отрицательная цена отклонена');
assert.equal(planPriceChanges(cards, [{ article: 'свитер_белый', price: 3000 }]).items.length, 0, 'без изменений нечего применять');
assert.equal(planPriceChanges(cards, [{ article: 'свитер_белый' }]).items.length, 0, 'нужна цена или скидка');
assert.equal(planPriceChanges(cards, [{ article: 'свитер_белый', price: 3100 }, { nm_id: 3, price: 3200 }]).items.length, 1, 'один артикул дважды не берём');
assert.equal(planPriceChanges(cards, Array.from({ length: WRITE_LIMITS.maxItems + 1 }, () => ({ nm_id: 3, price: 3100 }))).items.length, 0, 'не больше 30 за раз');
assert.equal(planPriceChanges(cards, []).items.length, 0);
console.log('mcp-write_test: ok');
