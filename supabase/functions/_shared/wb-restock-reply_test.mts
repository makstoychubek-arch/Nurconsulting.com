import assert from 'node:assert/strict';
import {
    buildWbRestockAnswer,
    cabinetLegalName,
    collectQuestions,
    decideRestockInbound,
    extractRestockWhen,
    formatRestockTelegramCard,
    wbQuestionAnswerPayload,
    isAllowedRestockChat,
    isFreshQuestion,
    isRestockQuestion,
    isWhenOnlyReply,
    matchPendingByText,
    normalizeWhenPhrase,
    ownerMention,
    parseRestockCardMeta,
    parseNewFeedbacksQuestions,
    pickRestockQuestions,
    unwrapTelegramMessage,
} from './wb-restock-reply.ts';

const qText = 'Добрый день! Ожидается ли в ближайшее время поступление костюма темно-синего цвета 42 размера?';
assert.equal(isRestockQuestion(qText), true, 'screenshot question is restock');
assert.equal(isRestockQuestion('Какой состав ткани?'), false, 'composition is not restock');

assert.equal(extractRestockWhen('завтра'), 'завтра');
assert.equal(extractRestockWhen('через неделю'), 'через неделю');
assert.equal(extractRestockWhen('через 2 недели'), 'через 2 недели');
assert.equal(extractRestockWhen('Через две недели пожалуйста'), 'через две недели');
assert.equal(normalizeWhenPhrase('Через неделю'), 'через неделю');
assert.equal(extractRestockWhen('послезавтра'), 'послезавтра');
assert.equal(extractRestockWhen('не знаю'), null);

assert.equal(isWhenOnlyReply('через неделю'), true);
assert.equal(isWhenOnlyReply('@maraWuW через 2 недели'), true);
assert.equal(isWhenOnlyReply('через неделю, если поставка не задержится на таможне'), false);

assert.equal(
    buildWbRestockAnswer('через неделю'),
    'Здравствуйте, этот товар будет в наличии через неделю.',
);
assert.equal(
    buildWbRestockAnswer('завтра.'),
    'Здравствуйте, этот товар будет в наличии завтра.',
);
assert.equal(
    buildWbRestockAnswer('Через неделю'),
    'Здравствуйте, этот товар будет в наличии через неделю.',
);

assert.equal(cabinetLegalName('Zevina 1'), 'ИП Уркунбаев К.А.');
assert.equal(cabinetLegalName('Zevina 2'), 'ОсОО «Айлин Стиль»');
assert.equal(cabinetLegalName('Elium'), 'ИП Айзада');
assert.equal(cabinetLegalName('Baza'), 'ИП Бейшеев А.Д.');
assert.equal(ownerMention('maraWuW'), '@maraWuW');

assert.deepEqual(parseNewFeedbacksQuestions({
    data: { hasNewQuestions: true, hasNewFeedbacks: false },
    error: false,
    errorText: '',
    additionalErrors: null,
}), { hasNewQuestions: true, hasNewFeedbacks: false });
assert.deepEqual(parseNewFeedbacksQuestions({ hasNewQuestions: false }), {
    hasNewQuestions: false,
    hasNewFeedbacks: false,
});

const payload = {
    data: {
        questions: [{
            id: 'q-kostum-1',
            text: qText,
            createdDate: new Date().toISOString(),
            productDetails: {
                nmId: 399607068,
                supplierArticle: 'kostkom_oversize_temnosiniy',
                productName: 'Костюм брючный классический оверсайз',
            },
        }, {
            id: 'q-other',
            text: 'Какой размер на рост 170?',
            productDetails: { nmId: 1, productName: 'Платье' },
        }],
    },
};
const collected = collectQuestions(payload);
assert.equal(collected.length, 2);
assert.equal(collected[0].nmId, 399607068);
assert.equal(collected[0].article, 'kostkom_oversize_temnosiniy');
const restock = pickRestockQuestions(payload);
assert.equal(restock.length, 1);
assert.equal(restock[0].id, 'q-kostum-1');

assert.equal(isFreshQuestion(new Date().toISOString(), 45), true);
assert.equal(isFreshQuestion(new Date(Date.now() - 60 * 86400000).toISOString(), 45), false);
assert.equal(isFreshQuestion('', 45), true);

const card = formatRestockTelegramCard({
    cabinetName: 'Zevina 1',
    cabinetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    question: restock[0],
    mention: '@maraWuW',
});
assert.match(card, /@maraWuW/);
assert.match(card, /поступление/);
assert.match(card, /kostkom_oversize_temnosiniy/);
assert.equal(card.includes('#nrq'), false);
assert.equal(card.includes('Кабинет:'), false);
assert.equal(card.includes('Ответьте реплаем'), false);
assert.ok(card.split('\n').length <= 4);

assert.deepEqual(wbQuestionAnswerPayload('q-1', 'Здравствуйте, этот товар будет в наличии завтра.'), {
    id: 'q-1',
    answer: { text: 'Здравствуйте, этот товар будет в наличии завтра.' },
    state: 'wbRu',
});

assert.equal(parseRestockCardMeta(card), null);
assert.deepEqual(parseRestockCardMeta('#nrq q=q-kostum-1 c=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), {
    questionId: 'q-kostum-1',
    cabinetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
});
assert.equal(parseRestockCardMeta('просто текст'), null);

const pending = [{
    question_id: 'q-kostum-1',
    cabinet_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    nm_id: 399607068,
    article: 'kostkom_oversize_temnosiniy',
    product: 'Костюм брючный классический оверсайз',
    question_text: qText,
    telegram_message_id: 88,
}];

assert.equal(matchPendingByText('когда костюм 399607068', pending), 'q-kostum-1');
assert.equal(matchPendingByText('привет', pending), null);

const fromOldCard = decideRestockInbound({
    chatId: '-1001',
    messageId: 100,
    text: 'через неделю',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: '#nrq q=q-kostum-1 c=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    replyToMessageId: 87,
    pending,
});
assert.equal(fromOldCard.action, 'answer');
if (fromOldCard.action === 'answer') assert.equal(fromOldCard.via, 'card_meta');

const fromCard = decideRestockInbound({
    chatId: '-1001',
    messageId: 101,
    text: 'через неделю',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: card,
    replyToMessageId: 88,
    pending,
});
assert.equal(fromCard.action, 'answer');
if (fromCard.action === 'answer') {
    assert.equal(fromCard.when, 'через неделю');
    assert.equal(fromCard.via, 'tg_message');
    assert.equal(fromCard.questionId, 'q-kostum-1');
}

const hint = decideRestockInbound({
    chatId: '-1001',
    messageId: 102,
    text: 'хз',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: card,
    replyToMessageId: 88,
    pending,
});
assert.equal(hint.action, 'hint');

const byTg = decideRestockInbound({
    chatId: '-1001',
    messageId: 103,
    text: 'завтра',
    fromUsername: 'alina',
    ownerUsername: 'maraWuW',
    replyToText: 'карточка без метки',
    replyToMessageId: 88,
    pending,
});
assert.equal(byTg.action, 'answer');
if (byTg.action === 'answer') assert.equal(byTg.via, 'tg_message');

const staffTag = decideRestockInbound({
    chatId: '-1001',
    messageId: 104,
    text: 'через 2 недели',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: '@maraWuW когда будет костюм оверсайз 399607068?',
    replyToMessageId: 70,
    pending,
});
assert.equal(staffTag.action, 'answer');
if (staffTag.action === 'answer') assert.equal(staffTag.via, 'pending_match');

const single = decideRestockInbound({
    chatId: '-1001',
    messageId: 105,
    text: 'завтра',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: '',
    replyToMessageId: null,
    pending,
});
assert.equal(single.action, 'answer');
if (single.action === 'answer') assert.equal(single.via, 'single_pending');

const ignoreStranger = decideRestockInbound({
    chatId: '-1001',
    messageId: 106,
    text: 'завтра',
    fromUsername: 'random_user',
    ownerUsername: 'maraWuW',
    replyToText: '',
    replyToMessageId: null,
    pending,
});
assert.equal(ignoreStranger.action, 'ignore');

const unwrapped = unwrapTelegramMessage({
    message: {
        message_id: 9,
        text: 'через неделю',
        chat: { id: -1001 },
        from: { username: 'maraWuW', is_bot: false },
        reply_to_message: { message_id: 8, text: card },
    },
});
assert.ok(unwrapped);
assert.equal(unwrapped?.fromUsername, 'maraWuW');
assert.equal(unwrapped?.replyToMessageId, 8);
assert.match(unwrapped?.replyToText || '', /поступление/);

assert.equal(isAllowedRestockChat('-100rev', '-100rev', []), true);
assert.equal(isAllowedRestockChat('-100team', '-100rev', []), false);
assert.equal(isAllowedRestockChat('-100old', '-100rev', ['-100old']), true);
assert.equal(isAllowedRestockChat('', '-100rev', []), false);

console.log('wb-restock-reply_test: ok');
