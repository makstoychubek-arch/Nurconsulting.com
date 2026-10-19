/**
 * РНП: «Σ Общее» у каждой группы — тот же вид, что «Общий», но только по артикулам группы.
 * Итоги кабинета из финотчёта к группе не применяются: считаем суммой по её артикулам.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'rnp-module.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'rnp-extra.css'), 'utf8');

assert.ok(src.includes('let _activeGroup = null;'), 'there is a state for the active group');
assert.ok(src.includes("pick('general', name || undefined)") && src.includes('pickGroup'), 'group button opens the general view for the group');
assert.ok(src.includes("_activeGroup = (nmId === GENERAL_TAB || nmId === 'general') && group ? String(group) : null;"), 'any other tab leaves the group view');
assert.ok(src.includes("active.filter(a => _articleCategory(a) === _activeGroup)"), 'only the articles of the group are summed');
assert.ok(src.includes('return _activeGroup ? m : _applyCabinetTotals('), 'cabinet-wide finance totals are not mixed into a group');
assert.ok(src.includes(':${_activeGroup || \'\'}`;'), 'column cache is separate per group');
assert.ok(src.includes('class="rnp-cat-sigma') && src.includes('event.stopPropagation();RNP.pickGroup('), 'button does not collapse the group');
assert.ok(/pick, pickGroup,/.test(src), 'pickGroup is exported');
assert.ok(css.includes('.rnp-cat-sigma'), 'button is styled');
assert.ok(/_activeNm == null \? '' : String\(_activeNm\),\s*_activeGroup \|\| ''/.test(src), 'sheet lock key differs per group, so the page repaints');
console.log('rnp_group_general_test: ok');
