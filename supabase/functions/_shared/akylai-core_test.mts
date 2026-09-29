import assert from 'node:assert/strict';
import {
    AKYLAI_DAILY_LIMIT, AKYLAI_LINK_TTL_MS, akylaiErrorMessage, buildReplyMessages, checkLink,
    deriveAkylaiStep, finalizeReply, formatReplyCard, normalizeFeedback, parseCallback, parseStartCode,
    stopRuleViolations,
} from './akylai-core.ts';
import { decryptSecret, encryptSecret, importSecretKey, randomLinkCode, sha256Hex } from './secret-box.ts';

// ── Константы из ТЗ ──
assert.equal(AKYLAI_DAILY_LIMIT, 100, 'daily limit starts at 100');
assert.equal(AKYLAI_LINK_TTL_MS, 24 * 60 * 60 * 1000, 'Telegram link lives 24h');

// ── Фразы Акылай: конкретное действие, без кодов и текстов WB ──
for (const code of ['READ_ONLY', 'NOT_PERSONAL', 'NO_FEEDBACKS', 'EXPIRED', 'CHECK_FAILED', 'ALREADY_CONNECTED']) {
    const m = akylaiErrorMessage(code);
    assert.ok(m.length > 20, `${code} has a human message`);
    assert.ok(!/\b(4\d\d|5\d\d)\b|error|errorText|unauthorized/i.test(m), `${code} message has no codes or raw errors`);
}
assert.match(akylaiErrorMessage('READ_ONLY'), /только для чтения/);
assert.match(akylaiErrorMessage('READ_ONLY'), /без этой галочки/);
assert.match(akylaiErrorMessage('NOT_PERSONAL'), /Персональный/);
assert.match(akylaiErrorMessage('NO_FEEDBACKS'), /Вопросы и отзывы/);
assert.match(akylaiErrorMessage('EXPIRED'), /Срок действия/);
assert.match(akylaiErrorMessage('CHECK_FAILED'), /попробуйте ещё раз/i);
assert.equal(akylaiErrorMessage('ALREADY_CONNECTED'), 'Этот кабинет уже подключён. Напишите нам — разберёмся.');
assert.equal(akylaiErrorMessage('какой-то текст WB 401 Unauthorized'), akylaiErrorMessage('SERVER_ERROR'), 'unknown codes never leak');

// ── Шаг мастера считается из базы ──
assert.equal(deriveAkylaiStep({ hasCabinet: false, tokenState: 'missing', telegram: 'none', enabled: false }), 'hello');
assert.equal(deriveAkylaiStep({ hasCabinet: true, tokenState: 'expired', telegram: 'connected', enabled: true }), 'token');
assert.equal(deriveAkylaiStep({ hasCabinet: true, tokenState: 'ok', telegram: 'none', enabled: false }), 'telegram');
assert.equal(deriveAkylaiStep({ hasCabinet: true, tokenState: 'ok', telegram: 'blocked', enabled: true }), 'telegram');
assert.equal(deriveAkylaiStep({ hasCabinet: true, tokenState: 'ok', telegram: 'connected', enabled: false }), 'done');

// ── Одноразовая ссылка ──
const now = Date.parse('2026-09-30T12:00:00Z');
assert.equal(checkLink(null, now), 'missing');
assert.equal(checkLink({ expires_at: '2026-10-01T11:00:00Z', used_at: null }, now), 'ok');
assert.equal(checkLink({ expires_at: '2026-09-30T11:59:59Z', used_at: null }, now), 'expired');
assert.equal(checkLink({ expires_at: '2026-10-01T11:00:00Z', used_at: '2026-09-30T11:00:00Z' }, now), 'used');

const code = randomLinkCode();
assert.match(code, /^[A-Za-z0-9_-]{16,64}$/, 'link code fits Telegram deep-link rules');
assert.equal(parseStartCode(`/start ${code}`), code);
assert.equal(parseStartCode(`/start@AkylaiBot ${code}`), code);
assert.equal(parseStartCode('/start'), '');
assert.equal(parseStartCode('/start bad code!'), '');

// ── Стоп-правила ──
assert.deepEqual(stopRuleViolations('Спасибо за высокую оценку и тёплые слова! Рады, что покупка понравилась.'), [],
    '«оценку» is not a price');
assert.ok(stopRuleViolations('Сейчас цена 990 ₽, заходите').includes('price'));
assert.ok(stopRuleViolations('Цена товара снизится').includes('price'));
assert.ok(stopRuleViolations('Пишите нам в WhatsApp +7 999 123-45-67').includes('contact'));
assert.ok(stopRuleViolations('Подробнее на https://example.com').includes('contact'));
assert.ok(stopRuleViolations('Мы вернём деньги за заказ').includes('refund'));
assert.ok(stopRuleViolations('Оформите возврат средств, мы компенсируем').includes('refund'));

// ── Ответ и запрос к модели ──
const fb = normalizeFeedback({
    id: 'fb1', productValuation: 2, text: 'Размер <маломерит>', pros: '', cons: 'швы',
    productDetails: { productName: 'Платье & пояс' }, userName: 'Анна',
});
assert.ok(fb);
const msgs = buildReplyMessages(fb!, 'Лавка');
assert.match(msgs[0].content, /Запрещено: называть цены/);
assert.match(msgs[0].content, /возврат денег/);
assert.match(msgs[1].content, /Оценка: 2 из 5/);
const reply = finalizeReply('Спасибо за отзыв!', 'Лавка');
assert.ok(reply.endsWith('С уважением, команда «Лавка»'), 'signature comes from the cabinet name');
assert.ok(finalizeReply('слово '.repeat(400), 'Лавка').length <= 1000, 'reply fits WB length limit');
const card = formatReplyCard(fb!, reply, 'review');
assert.ok(card.includes('&lt;маломерит&gt;') && card.includes('Платье &amp; пояс'), 'card escapes buyer text for HTML');

// ── Кнопки ──
const id = '0b6c5a5e-1d7e-4c9f-9a41-6c4b1e0f7a22';
assert.deepEqual(parseCallback(`ak:pub:${id}`), { action: 'pub', id });
assert.deepEqual(parseCallback(`ak:edit:${id}`), { action: 'edit', id });
assert.equal(parseCallback('ak:pub:not-an-id'), null);
assert.equal(parseCallback('other:pub:' + id), null);

// ── Шифрование токена ──
{
    const keyB64 = Buffer.from(new Uint8Array(32).map((_, i) => i + 1)).toString('base64');
    const key = await importSecretKey(keyB64);
    const boxed = await encryptSecret('secret-wb-token', key);
    assert.ok(boxed.startsWith('v1.') && !boxed.includes('secret-wb-token'), 'token is not stored in plain text');
    assert.equal(await decryptSecret(boxed, key), 'secret-wb-token');
    assert.notEqual(await encryptSecret('secret-wb-token', key), boxed, 'random IV per encryption');
    const other = await importSecretKey(Buffer.from(new Uint8Array(32).fill(9)).toString('base64'));
    await assert.rejects(() => decryptSecret(boxed, other), 'wrong key cannot decrypt');
    await assert.rejects(() => importSecretKey('c2hvcnQ='), 'short key is refused');
    assert.equal((await sha256Hex('abc')).length, 64);
}

console.log('akylai-core_test: ok');
