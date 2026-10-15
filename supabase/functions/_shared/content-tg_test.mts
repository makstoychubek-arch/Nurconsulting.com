import assert from 'node:assert/strict';
import { cleanCaption, parseChannelPost, planRows, scheduleFor, titleFrom, type TgSourceRule } from './content-tg.ts';

const rule: TgSourceRule = { mode: 'manual', target: 'feed', delay_minutes: 120, daily_time: null, take_text: true, take_albums: true, strip_links: true, add_signature: true, signature: '#zevina' };

// разбор поста
const p = parseChannelPost({ channel_post: { message_id: 7, date: 1760000000, chat: { id: -100123, title: 'Z' }, caption: 'Привет', photo: [{ file_id: 'small', width: 90, height: 90 }, { file_id: 'big', width: 1280, height: 1280, file_size: 200000 }] } });
assert.equal(p?.kind, 'photo'); assert.equal(p?.fileId, 'big'); assert.equal(p?.text, 'Привет'); assert.equal(p?.groupId, null);
assert.equal(parseChannelPost({ channel_post: { message_id: 1, chat: { id: 1 }, video: {} } })?.kind, 'video');
assert.equal(parseChannelPost({ channel_post: { message_id: 1, chat: { id: 1 }, text: 'x' } })?.kind, 'text');
assert.equal(parseChannelPost({ channel_post: { message_id: 1, chat: { id: 1 }, document: { mime_type: 'video/mp4' } } })?.kind, 'video');
assert.equal(parseChannelPost({ channel_post: { message_id: 1, chat: { id: 1 }, media_group_id: '55', photo: [{ file_id: 'a' }] } })?.groupId, '55');
assert.equal(parseChannelPost({}), null);
// группа: сообщение администратора с фото разбирается, личный чат игнорируется
const g = parseChannelPost({ message: { message_id: 5, chat: { id: -100777, type: 'supergroup' }, from: { id: 42 }, photo: [{ file_id: 'a' }] } });
assert.equal(g?.isGroup, true); assert.equal(g?.fromId, 42); assert.equal(g?.kind, 'photo');
assert.equal(parseChannelPost({ message: { message_id: 5, chat: { id: 7, type: 'private' }, text: 'hi' } }), null);
assert.equal(parseChannelPost({ channel_post: { message_id: 1, chat: { id: 1 }, text: 'x' } })?.isGroup, false);

// подпись
assert.equal(cleanCaption('Куртка\nПодробнее: https://t.me/zevina/55\nЦена 3490', rule), 'Куртка\nПодробнее:\nЦена 3490\n\n#zevina');
assert.equal(cleanCaption('Вся коллекция t.me/zevina', { ...rule, add_signature: false }), 'Вся коллекция');
assert.equal(cleanCaption('Сайт https://nurcon.kg', { ...rule, add_signature: false }), 'Сайт https://nurcon.kg');
assert.equal(cleanCaption('', rule), '#zevina');
assert.ok(cleanCaption('я'.repeat(3000), { ...rule, add_signature: false }).length <= 2200);
assert.equal(titleFrom('\n  Новая куртка в наличии\nвторая строка'), 'Новая куртка в наличии');
assert.ok(titleFrom('а'.repeat(100)).length <= 60);

// расписание
const now = new Date('2026-10-16T08:00:00Z');
assert.equal(scheduleFor(new Date('2026-10-16T08:00:00Z'), { delay_minutes: 120, daily_time: null }, now).toISOString(), '2026-10-16T10:00:00.000Z');
assert.equal(scheduleFor(new Date('2026-10-16T08:00:00Z'), { delay_minutes: 0, daily_time: null }, now).toISOString(), '2026-10-16T08:05:00.000Z');
// 12:00 по Бишкеку = 06:00 UTC: пост пришёл в 08:00 UTC (14:00 местное) → слот уже прошёл → завтра 06:00 UTC
assert.equal(scheduleFor(new Date('2026-10-16T08:00:00Z'), { delay_minutes: 0, daily_time: '12:00' }, now).toISOString(), '2026-10-17T06:00:00.000Z');
// пост пришёл в 03:00 UTC (09:00 местное) → сегодня 06:00 UTC, если оно позже «сейчас + 5 минут»
assert.equal(scheduleFor(new Date('2026-10-16T03:00:00Z'), { delay_minutes: 0, daily_time: '12:00' }, new Date('2026-10-16T03:30:00Z')).toISOString(), '2026-10-16T06:00:00.000Z');

// план записей
assert.deepEqual(planRows({ kind: 'photo' }, rule), [{ post_kind: 'feed', status: 'review', note: null }]);
assert.deepEqual(planRows({ kind: 'photo' }, { ...rule, mode: 'auto', target: 'both' }), [{ post_kind: 'feed', status: 'scheduled', note: null }, { post_kind: 'story', status: 'scheduled', note: null }]);
assert.equal(planRows({ kind: 'video' }, rule)[0].note, 'Видео: публикуем вручную');
assert.equal(planRows({ kind: 'video' }, rule)[0].status, 'draft');
assert.equal(planRows({ kind: 'text' }, rule)[0].note, 'Нет картинки: добавьте фото');
assert.deepEqual(planRows({ kind: 'text' }, { ...rule, take_text: false }), []);
console.log('content-tg: ok');
