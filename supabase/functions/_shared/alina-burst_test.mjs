import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('./alina-telegram.ts', import.meta.url), 'utf8');
const fn = src.slice(src.indexOf('export function joinBurst'), src.indexOf('\nasync function humanPause'));
const { joinBurst } = new Function(stripTypeScriptTypes(fn.replace(/^export /gm, '')) + '\nreturn { joinBurst }')();
assert.equal(joinBurst([{ text: 'Сейчас оформлю' }, { text: 'Она по размеру не маломерит ?' }, { text: 'А то самый маленький размер беру' }], 'x'),
  'Сейчас оформлю\nОна по размеру не маломерит ?\nА то самый маленький размер беру');
assert.equal(joinBurst([{ text: 'скрин', photo: true }, { text: 'привет' }], 'привет'), 'привет', 'фото-сообщения не склеиваем');
assert.equal(joinBurst([], 'своё'), 'своё');
console.log('PASS: alina-burst');
