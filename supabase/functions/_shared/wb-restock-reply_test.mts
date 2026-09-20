import assert from 'node:assert/strict';
import {
    buildWbRestockAnswer,
    cabinetLegalName,
    collectOpenQuestions,
    collectQuestions,
    mergeQuestionPages,
    decideRestockInbound,
    extractRestockWhen,
    formatAutoAnswerTelegramCard,
    formatRestockTelegramCard,
    buildAutoQuestionAnswer,
    shortQuestionQuote,
    resolveRestockAnswer,
    wbQuestionAnswerPayload,
    isAllowedRestockChat,
    isFreshQuestion,
    isRestockCardText,
    isRestockInboundCandidate,
    isRestockQuestion,
    isWhenOnlyReply,
    matchPendingByText,
    normalizeTelegramReactionEmoji,
    normalizeWhenPhrase,
    ownerMention,
    parseRestockCardMeta,
    parseNewFeedbacksQuestions,
    pickOpenQuestions,
    pickRestockQuestions,
    questionCardKind,
    restockCardArticleLine,
    resolveStaffAnswer,
    unwrapTelegramMessage,
    peelCardAndAnswer,
    isAlreadyAnsweredWb,
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
    'Здравствуйте! Этот товар будет в наличии через неделю.',
);
assert.equal(
    buildWbRestockAnswer('завтра.'),
    'Здравствуйте! Этот товар будет в наличии завтра.',
);
assert.equal(
    buildWbRestockAnswer('Через неделю'),
    'Здравствуйте! Этот товар будет в наличии через неделю.',
);
assert.equal(resolveRestockAnswer('хз'), null);
assert.equal(
    resolveRestockAnswer('через неделю')?.wbText,
    'Здравствуйте! Этот товар будет в наличии через неделю.',
);
assert.equal(
    resolveRestockAnswer('Да, костюм будет на складе в пятницу, размер 42')?.wbText,
    'Здравствуйте! Да, костюм будет на складе в пятницу, размер 42.',
);
assert.equal(resolveStaffAnswer('да'), null);
assert.equal(
    resolveStaffAnswer('да', 'Добрый день, у юбки есть подклад? Надеюсь что у пиджака есть')?.wbText,
    'Здравствуйте! Да, подклад есть.',
);
assert.equal(
    resolveStaffAnswer('нет', 'Добрый день, у юбки есть подклад?')?.wbText,
    'Здравствуйте! Нет, подклада нет.',
);
assert.equal(
    resolveStaffAnswer('170', 'На какой рост костюм? Параметры модели что на фото?')?.wbText,
    'Здравствуйте! Костюм рассчитан на рост 170.',
);
assert.equal(
    resolveStaffAnswer('у юбки нет, у пиджака есть', 'у юбки есть подклад?')?.wbText,
    'Здравствуйте! У юбки нет, у пиджака есть.',
);
assert.equal(questionCardKind('когда будет в наличии?'), 'поступление');
assert.equal(questionCardKind('у юбки есть подклад?'), 'вопрос');

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
const open = pickOpenQuestions(payload);
assert.equal(open.length, 2);
const stalePayload = {
    data: {
        questions: [{
            id: 'q-old',
            text: 'есть подклад?',
            createdDate: '2024-01-01T00:00:00.000Z',
            productDetails: { nmId: 1, productName: 'Платье' },
        }],
    },
};
assert.equal(collectOpenQuestions(stalePayload).length, 1);
assert.equal(pickOpenQuestions(stalePayload).length, 0);
assert.equal(mergeQuestionPages([open, open]).map((q) => q.id).join(','), 'q-kostum-1,q-other');
const askCard = formatRestockTelegramCard({
    cabinetName: 'Zevina 1',
    cabinetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    question: open[1],
    mention: '@maraWuW',
});
assert.match(askCard, /вопрос/);
assert.equal(isRestockCardText(askCard), true);

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
assert.ok(card.split('\n').length <= 3);
assert.equal(shortQuestionQuote('Здравствуйте \nКогда появится серый костюм 42?'), 'Когда появится серый костюм 42?');

assert.deepEqual(wbQuestionAnswerPayload('q-1', 'Здравствуйте! Этот товар будет в наличии завтра.'), {
    id: 'q-1',
    wasViewed: true,
    answer: { text: 'Здравствуйте! Этот товар будет в наличии завтра.' },
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
    assert.match(fromCard.wbText, /через неделю/);
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
if (hint.action === 'hint') {
    assert.equal(hint.questionId, 'q-kostum-1');
    assert.equal(hint.cabinetId, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
}

const custom = decideRestockInbound({
    chatId: '-1001',
    messageId: 1022,
    text: 'Да, костюм будет на складе в пятницу, размер 42',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: card,
    replyToMessageId: 88,
    pending,
});
assert.equal(custom.action, 'answer');
if (custom.action === 'answer') {
    assert.equal(custom.wbText, 'Здравствуйте! Да, костюм будет на складе в пятницу, размер 42.');
    assert.equal(custom.via, 'tg_message');
}

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
assert.equal(ignoreStranger.action, 'answer');
if (ignoreStranger.action === 'answer') assert.equal(ignoreStranger.via, 'single_pending');

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

const shotCard = '@maraWuW поступление\nупорон_костюм_черный\n«когда будет в наличии?»';
assert.equal(isRestockCardText(shotCard), true);
assert.equal(isRestockCardText('Отказ · отзыв 15.09 · 23:15'), false);
assert.equal(restockCardArticleLine(shotCard), 'упорон_костюм_черный');
assert.equal(normalizeTelegramReactionEmoji('❤️'), '\u2764');
assert.equal(extractRestockWhen('Через неделю'), 'через неделю');

const shotPending = [{
    question_id: 'q-uporon',
    cabinet_id: 'cab-uporon',
    article: 'упорон_костюм_черный',
    product: 'Костюм',
    question_text: 'когда будет в наличии?',
    telegram_message_id: 10,
}];

const shotReply = decideRestockInbound({
    chatId: '-100rev',
    messageId: 11,
    text: 'Через неделю',
    fromUsername: 'KarinaBot',
    ownerUsername: 'maraWuW',
    replyToText: shotCard,
    replyToMessageId: 99,
    pending: shotPending,
});
assert.equal(shotReply.action, 'answer');
if (shotReply.action === 'answer') {
    assert.equal(shotReply.questionId, 'q-uporon');
    assert.equal(shotReply.via, 'pending_match');
    assert.equal(shotReply.when, 'через неделю');
}

const unmatched = decideRestockInbound({
    chatId: '-100rev',
    messageId: 12,
    text: 'Через неделю',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: shotCard,
    replyToMessageId: 99,
    pending: [],
});
assert.equal(unmatched.action, 'unmatched');

const botMsg = unwrapTelegramMessage({
    message: {
        message_id: 11,
        text: 'Через неделю',
        chat: { id: -1001 },
        from: { username: 'nr_karina_bot', is_bot: true },
        reply_to_message: { message_id: 10, text: shotCard },
    },
});
assert.ok(botMsg);
assert.equal(botMsg?.isBot, true);
assert.equal(isRestockInboundCandidate(botMsg!), true);
assert.equal(isRestockInboundCandidate({
    text: shotCard,
    replyToText: '',
    replyToMessageId: null,
    isBot: true,
}), false);

const liningQ = 'Добрый день, у юбки есть подклад? Надеюсь что у пиджака есть';
const liningCard = formatRestockTelegramCard({
    cabinetName: 'Zevina 1',
    cabinetId: 'cab-uporon',
    question: {
        id: 'q-lining',
        text: liningQ,
        nmId: 6236445154,
        article: 'двойка_юбка_полоска',
        product: 'Костюм пиджак с юбкой',
        createdDate: '',
    },
    mention: '@maraWuW',
});
assert.match(liningCard, /вопрос/);
const lining = decideRestockInbound({
    chatId: '-100rev',
    messageId: 21,
    text: 'да',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: liningCard,
    replyToMessageId: 20,
    pending: [{
        question_id: 'q-lining',
        cabinet_id: 'cab-uporon',
        article: 'двойка_юбка_полоска',
        question_text: liningQ,
        telegram_message_id: 20,
    }],
});
assert.equal(lining.action, 'answer');
if (lining.action === 'answer') {
    assert.equal(lining.wbText, 'Здравствуйте! Да, подклад есть.');
}

const shotWa = '@maraWuW поступление костюм_оверсайз_шоколад«когда коричневый костюм появится в наличии с 48 размера?»';
assert.equal(restockCardArticleLine(shotWa), 'костюм_оверсайз_шоколад');
assert.equal(isRestockCardText(shotWa), true);
const peeledShot = peelCardAndAnswer(`${shotWa}\nЧерез несколько дней`);
assert.equal(peeledShot?.answer, 'Через несколько дней');
assert.match(peeledShot?.card || '', /поступление/);

const manyPending = [
    ...shotPending,
    {
        question_id: 'q-choco',
        cabinet_id: 'cab-choco',
        article: 'костюм_оверсайз_шоколад',
        product: 'Костюм оверсайз шоколад',
        question_text: 'когда коричневый костюм появится в наличии с 48 размера?',
        telegram_message_id: 33,
    },
    {
        question_id: 'q-other-open',
        cabinet_id: 'cab-other',
        article: 'двойка_юбка_полоска',
        product: 'Юбка',
        question_text: 'есть подклад?',
        telegram_message_id: 12,
    },
];
const waStyle = decideRestockInbound({
    chatId: '-100rev',
    messageId: 40,
    text: `${shotWa}\nЧерез несколько дней`,
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: '',
    replyToMessageId: null,
    pending: manyPending,
});
assert.equal(waStyle.action, 'answer');
if (waStyle.action === 'answer') {
    assert.equal(waStyle.questionId, 'q-choco');
    assert.equal(waStyle.when, 'через несколько дней');
    assert.match(waStyle.wbText, /через несколько дней/);
}

const quoteOnly = unwrapTelegramMessage({
    business_message: {
        message_id: 41,
        text: 'Через несколько дней',
        chat: { id: -1001 },
        from: { username: 'maraWuW', is_bot: false },
        quote: { text: shotWa },
        external_reply: { message_id: 10 },
    },
});
assert.ok(quoteOnly);
assert.equal(quoteOnly?.text, 'Через несколько дней');
assert.equal(quoteOnly?.replyToMessageId, 10);
assert.match(quoteOnly?.replyToText || '', /костюм_оверсайз_шоколад/);

assert.equal(isAlreadyAnsweredWb({
    ok: false,
    status: 400,
    data: { errorText: 'Question already answered' },
    text: 'Question already answered',
}), true);
assert.equal(isAlreadyAnsweredWb({
    ok: false,
    status: 401,
    data: { errorText: 'unauthorized' },
    text: 'unauthorized',
}), false);

const autoRestock = buildAutoQuestionAnswer(qText);
assert.equal(autoRestock.topic, 'restock');
assert.equal(autoRestock.when, 'в ближайшее время');
assert.match(autoRestock.wbText, /в ближайшее время/);
assert.equal(/через несколько дней/i.test(autoRestock.wbText), false);
assert.match(buildAutoQuestionAnswer('у юбки есть подклад?').wbText, /описании карточки/);
assert.match(buildAutoQuestionAnswer('какой состав ткани?').wbText, /характеристиках карточки/);

const autoCard = formatAutoAnswerTelegramCard({
    cabinetName: 'Zevina 1',
    cabinetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    question: restock[0],
    answer: autoRestock.wbText,
    mention: '@maraWuW',
});
assert.match(autoCard, /@maraWuW автоответ · поступление/);
assert.match(autoCard, /ушло:/);
assert.equal(isRestockCardText(autoCard), true);
assert.equal(restockCardArticleLine(autoCard), 'kostkom_oversize_temnosiniy');
assert.equal(peelCardAndAnswer(autoCard), null);
assert.equal(isRestockInboundCandidate({
    text: autoCard,
    replyToText: '',
    replyToMessageId: null,
    isBot: true,
}), false);

const autoEdit = decideRestockInbound({
    chatId: '-100rev',
    messageId: 50,
    text: 'через неделю',
    fromUsername: 'maraWuW',
    ownerUsername: 'maraWuW',
    replyToText: autoCard,
    replyToMessageId: 49,
    pending: [{ ...pending[0], status: 'answered', telegram_message_id: 49 }],
});
assert.equal(autoEdit.action, 'answer');
if (autoEdit.action === 'answer') {
    assert.equal(autoEdit.questionId, 'q-kostum-1');
    assert.equal(autoEdit.when, 'через неделю');
}

const autoPeeled = peelCardAndAnswer(`${autoCard}\nчерез неделю`);
assert.equal(autoPeeled?.answer, 'через неделю');
assert.match(autoPeeled?.card || '', /автоответ/);

const autoWa = '@maraWuW автоответ · поступление костюм_оверсайз_шоколад«когда коричневый костюм появится в наличии с 48 размера?»';
assert.equal(isRestockCardText(autoWa), true);
assert.equal(restockCardArticleLine(autoWa), 'костюм_оверсайз_шоколад');

console.log('wb-restock-reply_test: ok');
