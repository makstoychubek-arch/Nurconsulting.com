// Локальный предпросмотр карточек отзыва/вопроса (шаблон: docs/feedback-card.md).
// Запуск: deno run -A scripts/render-feedback-card-sample.ts /tmp/out-dir
import { renderFeedbackPng } from '../supabase/functions/_shared/feedback-card-png.ts';

const U = 'https://fiukyfyhotctvfdidktx.supabase.co/storage/v1/object/public/abtest-photos/4fb87d8f-da1e-472d-8da8-7a16d5e58839/1.webp';
const dir = Deno.args[0] || '/tmp';

await Deno.writeFile(`${dir}/question-card.png`, await renderFeedbackPng({
    kind: 'question',
    cabinetName: 'ИП Бейшеев А.Д.',
    title: 'Куртка зимняя прямого кроя',
    nmId: 1544472467,
    supplierArticle: 'Куртка-черный1',
    photoUrl: U,
    createdStr: '09.10 00:24',
    text: 'Здравствуйте, а маска чумного доктора в комплекте идет? Мы просто жители икрикутска и надеемся на лучшее',
    answer: 'Здравствуйте! В комплекте только куртка, мы тоже надеемся только на лучшее!',
    answerStr: '09.10 01:13',
    mode: 'manual',
}));

await Deno.writeFile(`${dir}/review-card.png`, await renderFeedbackPng({
    kind: 'review',
    cabinetName: 'ИП Уркунбаев К.А.',
    title: 'Костюм брючный в стиле Old Money с укороченным жакетом',
    nmId: 495053627,
    photoUrl: U,
    rating: 4,
    buyer: 'Светлана',
    createdStr: '09.10 00:35',
    tag: 'Отказ',
    text: 'На бирке 44 размер, а на пиджаке и брюках размер М. И материал не понравился. Тонкий, думаю быстро протрется. Отказ',
    answer: 'Светлана, приносим извинения за возникшую путаницу с размерами и неудовлетворительное качество материала. Мы обязательно учтем ваши замечания для улучшения продукции. Если у вас есть дополнительные вопросы или пожелания, пожалуйста, напишите в чат продавца на Wildberries.',
    answerStr: '09.10 00:38',
    mode: 'auto',
}));
await Deno.writeFile(`${dir}/question-card-nophoto.png`, await renderFeedbackPng({
    kind: 'question',
    photo: 'none',
    cabinetName: 'ИП Бейшеев А.Д.',
    title: 'Куртка зимняя прямого кроя',
    nmId: 1544472467,
    supplierArticle: 'Куртка-черный1',
    createdStr: '09.10 00:24',
    text: 'Здравствуйте, а маска чумного доктора в комплекте идет?',
    answer: 'Здравствуйте! В комплекте только куртка.',
    answerStr: '09.10 01:13',
    mode: 'manual',
}));
console.log('готово:', dir);
