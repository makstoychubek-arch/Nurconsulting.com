import assert from 'node:assert/strict';
import { emptySlides, extFromMime, jobStatusFromSlides, parseGeminiImage, seoHints, slidePrompt, SLIDE_TITLES } from './content-media.ts';

const keep = 'Супер: свитер женский оверсайз, свитер вязаный\nРелевантно: свитер\nПризнаки с фото: оверсайз, вязаный трикотаж, вырез-лодочка, лишнее';
assert.deepEqual(seoHints(keep), { kw: 'свитер женский оверсайз', feats: ['оверсайз', 'вязаный трикотаж', 'вырез-лодочка'] });
assert.deepEqual(seoHints(undefined), { kw: '', feats: [] });

const p0 = slidePrompt(0, { name: 'Свитер-серый', keep, focus: 'ctr' });
assert.ok(p0.includes('«свитер женский оверсайз»'), 'название на обложке из топ-запроса СЕО');
assert.ok(p0.includes('приоритетный'), 'утечка показы → клики: обложка приоритетная');
assert.ok(!slidePrompt(1, { name: 'x', keep, focus: 'ctr' }).includes('приоритетный'));
assert.ok(slidePrompt(1, { name: 'x', keep }).includes('оверсайз, вязаный трикотаж, вырез-лодочка'), 'иконки из признаков');
assert.ok(slidePrompt(2, { name: 'x' }).includes('оригинального фото'), 'товар берётся с оригинала');
assert.equal(SLIDE_TITLES.length, 8);
for (let i = 0; i < 8; i++) assert.ok(slidePrompt(i, { name: 'Товар' }).length > 80, 'есть текст задания на кадр ' + (i + 1));

// ответ Gemini
assert.deepEqual(parseGeminiImage({ candidates: [{ content: { parts: [{ text: 'ок' }, { inlineData: { mimeType: 'image/png', data: 'QUJD' } }] } }] }), { mime: 'image/png', b64: 'QUJD' });
assert.equal(parseGeminiImage({ candidates: [{ content: { parts: [{ text: 'отказ' }] } }] }), null);
assert.equal(parseGeminiImage(null), null);

// статусы
const s = emptySlides();
assert.equal(jobStatusFromSlides(s), 'generating');
s.forEach((x) => { x.status = 'ready'; });
assert.equal(jobStatusFromSlides(s), 'ready');
s[3].status = 'failed';
assert.equal(jobStatusFromSlides(s), 'failed');
s[3].status = 'pending';
assert.equal(jobStatusFromSlides(s), 'generating');
assert.equal(extFromMime('image/webp'), 'webp');
assert.equal(extFromMime('image/jpeg'), 'jpg');
console.log('content-media: ok');
