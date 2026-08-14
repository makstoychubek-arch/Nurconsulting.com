import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  selfSkillsNamedAgent,
  selfSkillsReply,
  wantsSelfSkills,
} from './agent-self-skills.ts';

Deno.test('wantsSelfSkills phrases', () => {
  assert(wantsSelfSkills('что умеешь'));
  assert(wantsSelfSkills('Алина, что ты умеешь?'));
  assert(wantsSelfSkills('Антон твои задачи'));
  assert(wantsSelfSkills('чем занимаешься'));
  assert(wantsSelfSkills('help'));
  assert(wantsSelfSkills('расскажи свои задачи'));
  assert(wantsSelfSkills('чо умееш'));
  assert(wantsSelfSkills('твои скилы'));
  assert(wantsSelfSkills('/чтоумеешь'));
  assert(!wantsSelfSkills('остаток лапша белая'));
  // совет после аналитики ≠ список скиллов
  assert(!wantsSelfSkills('Что предлагаешь?'));
  assert(!wantsSelfSkills('что делать'));
  assert(!wantsSelfSkills('рекомендация'));
});

Deno.test('selfSkillsNamedAgent', () => {
  assertEquals(selfSkillsNamedAgent('Алина что умеешь'), 'alina');
  assertEquals(selfSkillsNamedAgent('антон твои задачи'), 'anton');
  assertEquals(selfSkillsNamedAgent('Сауле что умеешь'), 'saule');
  assertEquals(selfSkillsNamedAgent('что умеешь'), null);
});

Deno.test('each agent has non-empty skills memory', () => {
  for (const a of ['saule', 'amina', 'anton', 'alina', 'karina', 'muha']) {
    const r = selfSkillsReply(a);
    assert(r.length > 40);
    assert(/•/.test(r));
    assert(/Запомнила свою зону/i.test(r));
  }
  assert(/раздач|отзыв/i.test(selfSkillsReply('alina')));
  assert(/FBS|остат/i.test(selfSkillsReply('anton')));
  assert(/РК|реклам/i.test(selfSkillsReply('amina')));
  assert(/Сауле|Антон/i.test(selfSkillsReply('karina')));
  assert(/pulse|сводк|Пульс/i.test(selfSkillsReply('karina')));
});
