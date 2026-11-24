import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const raz = readFileSync(new URL('./alina-razdachi.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const ph = readFileSync(new URL('./alina-pajama-photos.ts', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '');
const assets = readFileSync(new URL('./alina-pajama-photo-assets.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const lib = new Function(stripTypeScriptTypes(raz + '\n' + assets + '\n' + ph) + '\nreturn { parseModel, pajamaPhotoFor, pajamaPhotosFor, PAJAMA_MODEL_NAMES, matchModels }')();
assert.equal(lib.PAJAMA_MODEL_NAMES.length, 7);
assert.deepEqual(lib.parseModel('Пижама 3в1 шоколадный'), { format: '3', color: 'chocolate' });
assert.deepEqual(lib.parseModel('Пижама 3в1 лапша вишня'), { format: '3', color: 'cherry' });
for (const m of lib.PAJAMA_MODEL_NAMES) {
  const s = lib.pajamaPhotoFor(m);
  assert.ok(s && s.bytes.length > 20000 && s.bytes[0] === 0xff && s.bytes[1] === 0xd8, m + ': jpeg');
  assert.equal(s.caption, m);
}
assert.equal(lib.pajamaPhotoFor('Пижама 3в1 молочный').caption, 'Пижама 3в1 молочный');
assert.equal(lib.pajamaPhotoFor('Пижама 2в1 молочный'), null, 'нет такой модели');
assert.equal(lib.pajamaPhotosFor(['Пижама 2в1 белый', 'Пижама 2в1 белый']).length, 1);
assert.deepEqual(lib.matchModels(lib.PAJAMA_MODEL_NAMES, 'фото 3 в 1 шоколадной'), ['Пижама 3в1 шоколадный']);
assert.equal(lib.matchModels(lib.PAJAMA_MODEL_NAMES, 'фото бордовой').length, 2, 'формат не назван: обе бордовые');
console.log('PASS: alina-pajama-photos');
