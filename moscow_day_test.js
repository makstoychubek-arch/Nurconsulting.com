/** Сутки WB — московские: ночное заполнение РНП не должно брать «вчера/сегодня» по Бишкеку. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'supabase/functions/rnp-morning-fill/index.ts'), 'utf8');
assert.ok(code.includes('const fillDate = normDate(body.date) || yesterdayWbDay();') && code.includes('const today = moscowYmd();'), 'fill days are Moscow days');
assert.ok(!/Asia\/Bishkek/.test(code), 'no Bishkek day boundary in the fill');
console.log('moscow_day_test: ok');
