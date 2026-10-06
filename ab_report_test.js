/**
 * Отчёт А/Б-теста: как в WBRadar. Фото WB сохраняем копией (иначе ссылка слота
 * показывает уже другое фото), в шапке артикул и РК, завершённые лежат в «Архиве».
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');

const upload = html.slice(html.indexOf('async function uploadVariantPhoto'), html.indexOf('let abCreatingTest'));
assert.ok(upload.includes('if (fileOrUrl && fileOrUrl.fromWB)'), 'WB photos have their own branch');
assert.ok(/fetch\(fileOrUrl\.url/.test(upload) && /storage\.from\('abtest-photos'\)\.upload\(wbPath, blob/.test(upload),
    'a WB photo is copied into our storage, not referenced by the live slot URL');
assert.ok(!/return fileOrUrl\.url;/.test(upload), 'the live WB slot URL is never stored as the variant photo');

assert.ok(html.includes("filterTests('finished', this)\">Архив</button>"), 'finished tests live in the «Архив» tab');
assert.ok(html.includes("рк ${reportCampaigns.join(', ')}"), 'report header shows the campaign ids');
assert.ok(html.includes("verdictText = 'разницы нет'"), 'report says «разницы нет» when there is enough data and no leader');
assert.ok(html.includes('Установить на ВБ') && html.includes('Сейчас на ВБ'), 'winner can be set on WB from the report');

console.log('ab_report_test: ok');
