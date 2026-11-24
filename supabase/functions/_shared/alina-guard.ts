// Защита от «кринжа» (владелец, 24 ноября 2026): Алина работает сама, человека зовут только по просьбе клиента или при злости.
// Чистые функции: их можно проверять без сети.

const norm = (s: string) => ' ' + String(s || '').toLowerCase().replace(/ё/g, 'е') + ' ';

const HUMAN_RE = /(?:^|[^а-я])(менеджер\S*|оператор\S*|администратор\S*|руководител\S*|начальник\S*|директор\S*|владел\S*|позов\S*|соедин\S*|переключ\S*|робот\S*|автоответ\S*|нейросет\S*|жалоб\S*|жив\S*\s+человек\S*|реальн\S*\s+человек\S*|(?:вы|ты)\s+бот\S*|не\s+бот\S*|с\s+кем\s+(?:я\s+)?(?:говор|общаюсь|пишу)\S*|человек\S*\s+(?:позов|дайте|подключ|нужен|хочу)\S*|поговорить\s+с\s+(?:человек|кем|реальн)\S*)/;

const ANGRY_RE = /(?:сколько\s+можно|\d+\s*-?\s*(?:ый|ой|й|ий)\s+раз|в\s+(?:пятый|десятый|который)\s+раз|безобраз\S*|хамств\S*|ужасн\S*|достал\S*|бесит\S*|издева\S*|тупой|тупая|идиот\S*|бред|обман\S*|развод|мошенн\S*|верните\s+деньги)|[🤬😡]/;

/** Клиент зовёт человека (менеджера, оператора, «вы бот?», жалоба и т. п.). */
export function wantsHuman(text: string): boolean {
  return HUMAN_RE.test(norm(text));
}

/** Клиент раздражён или повторяет просьбу в который раз: дальше говорит человек. */
export function isAngry(text: string): boolean {
  return ANGRY_RE.test(norm(text));
}

const UNSAFE_RE = /(?:я|мы)\s+(?:всего\s+лишь\s+)?(?:бот|нейросет\S*|искусственн\S*)|как\s+ии(?=[\s.,!?]|$)|языков\S*\s+модел\S*|chatgpt|openai|gpt-?\d|артикул\S*\s*\d|(?:^|[^\d])\d{9,10}(?![\d])|wbbasket|basket-\d+/i;

/** Ответ выдаёт, что это бот, или раскрывает артикул/ссылку на фото WB: так отправлять нельзя. */
export function unsafeReply(text: string): boolean {
  return UNSAFE_RE.test(String(text || ''));
}

const key = (s: string) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const WAIT_RE = /уточню|секунду|минутку|сейчас посмотрю|одну минуту/i;
export const WAIT_VARIANTS = ['Одну минуту 🙌', 'Сейчас посмотрю и отвечу', 'Минутку, проверю', 'Секунду, сверю и вернусь к вам'];

/** Не повторяем слово в слово то, что Алина уже писала в этом диалоге: фразу ожидания меняем на другую, остальное не отправляем второй раз. */
export function dedupeReplies(replies: string[], previous: string[]): string[] {
  const seen = new Set(previous.map(key));
  const out: string[] = [];
  for (const r of replies) {
    const k = key(r);
    if (!seen.has(k)) { seen.add(k); out.push(r); continue; }
    if (WAIT_RE.test(r)) {
      const alt = WAIT_VARIANTS.find((v) => !seen.has(key(v)));
      if (alt) { seen.add(key(alt)); out.push(alt); }
    }
  }
  return out;
}

export const HUMAN_HANDOFF = [
  'Поняла вас, передаю менеджеру. Он ответит вам здесь в ближайшее время 🙌',
  'Хорошо, подключаю менеджера, он напишет вам сам.',
  'Передала менеджеру, скоро вам ответят.',
];
export const SAFE_REPLY = 'Секунду, уточню у менеджера и вернусь к вам.';

// ── Приветствие: ровно одно на диалог (владелец, 24 ноября 2026) ──
const GREET_RE = /^\s*(?:здравствуй\S*|привет\S*|добрый\s+(?:день|вечер|утро)|доброе\s+утро|добрейший\s+\S+|хай|здрасьте|здравия\S*)[\s!,.:;)🙌👋😊-]*/i;

export function startsWithGreeting(text: string): boolean {
  return GREET_RE.test(String(text || '').replace(/ё/g, 'е'));
}

/** Убирает приветствие в начале реплики: «Здравствуйте! Какую модель смотрите?» → «Какую модель смотрите?». */
export function stripGreeting(text: string): string {
  const t = String(text || '').trim().replace(GREET_RE, '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/** Сообщение владельца это только приветствие (без вопроса и дела): такой ответ не включает ручной режим. */
export function isGreetingOnly(text: string): boolean {
  const t = String(text || '').trim();
  return startsWithGreeting(t) && stripGreeting(t) === '' || (startsWithGreeting(t) && t.length <= 40 && !/[?]/.test(t));
}

/**
 * Приветствие в ответах: если диалог уже поздоровался (владелец или Алина за последние 12 часов), убираем его из ответа;
 * если никто не здоровался, а ответ без приветствия, добавляем «Здравствуйте!».
 */
export function applyGreeting(replies: string[], greeted: boolean): string[] {
  if (!replies.length) return replies;
  if (greeted) {
    const first = stripGreeting(replies[0]);
    return first ? [first, ...replies.slice(1)] : replies.slice(1);
  }
  return startsWithGreeting(replies[0]) ? replies : ['Здравствуйте! ' + replies[0], ...replies.slice(1)];
}
