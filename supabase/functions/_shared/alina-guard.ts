// Защита от «кринжа» (владелец, 24 ноября 2026): Алина работает сама, человека зовут только по просьбе клиента или при злости.
// Чистые функции: их можно проверять без сети.

const norm = (s: string) => ' ' + String(s || '').toLowerCase().replace(/ё/g, 'е') + ' ';

const HUMAN_RE = /(?:^|[^а-я])(менеджер\S*|оператор\S*|администратор\S*|руководител\S*|начальник\S*|директор\S*|владел\S*|позов\S*|соедин\S*|переключ\S*|робот\S*|автоответ\S*|нейросет\S*|жалоб\S*|жив\S*\s+человек\S*|реальн\S*\s+человек\S*|(?:вы|ты)\s+бот\S*|не\s+бот\S*|с\s+кем\s+(?:я\s+)?(?:говор|общаюсь|пишу)\S*|человек\S*\s+(?:позов|дайте|подключ|нужен|хочу)\S*|поговорить\s+с\s+(?:человек|кем|реальн)\S*)/;

const ANGRY_RE = /(?:сколько\s+можно|\d+\s*-?\s*(?:ый|ой|й|ий)\s+раз|в\s+(?:пятый|десятый|который)\s+раз|безобраз\S*|хамств\S*|ужасн\S*|достал\S*|бесит\S*|издева\S*|тупой|тупая|идиот\S*|бред|обман\S*|развод|мошенн\S*|верните\s+деньги)|🤬|😡/;

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

// ── Дубли по смыслу и «сейчас пришлю» ──
const STOP = new Set(['и', 'в', 'на', 'по', 'с', 'у', 'а', 'о', 'к', 'я', 'вы', 'вам', 'вас', 'вот', 'это']);
const wordsOf = (s: string) => new Set(key(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));

/** Две реплики почти одинаковые: те же пункты списка или большинство тех же слов (формулировка могла измениться). */
export function similarReply(a: string, b: string): boolean {
  const bullets = (s: string) => String(s || '').split('\n').filter((l) => l.trim().startsWith('•')).map(key).sort().join('|');
  const ba = bullets(a), bb = bullets(b);
  if (ba && ba === bb) return true;
  const wa = wordsOf(a), wb = wordsOf(b);
  if (wa.size < 3 || wb.size < 3) return key(a) === key(b);
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter) >= 0.6;
}

/** Не отправляем то, что почти слово в слово уже отправили недавно (recent: реплики Алины за последние 90 секунд). */
export function dropRecentSimilar(replies: string[], recent: string[]): string[] {
  return replies.filter((r) => !recent.some((p) => similarReply(r, p)));
}

/** Клиент обещает прислать ещё («минуту, сейчас пришлю», «щас скину»): ждём следующее сообщение дольше. */
export function promisesMore(text: string): boolean {
  return /(?:^|[^а-я])(?:минут\S*|секунд\S*|щас|ща|подожд\S*|сейчас\s+(?:пришл|скин|отправ|найд|сниму|сделаю|оформл|посмотр|открою)\S*|пришлю|скину|отправлю)(?![а-я])/.test(norm(text));
}

/** Клиент ответил реплаем на сообщение Алины («Эта» на фото модели): добавляем, на что именно он отвечает, чтобы бот понял выбор. */
export function withReplyContext(text: string, replyText?: string): string {
  const t = String(text || '').trim();
  const q = String(replyText || '').trim();
  if (!q || !t || t.length > 60 || /[23]\s*в\s*1/i.test(t)) return t;
  return `${t} (в ответ на «${q}»)`;
}

/** Окно повтора: списки моделей не дублируем 5 минут, остальное 90 секунд. */
export function recentWindowMs(reply: string): number {
  return reply.includes('•') ? 300_000 : 90_000;
}

/** Клиент просто подтверждает («да», «ок», «поняла», «хорошо спасибо», 👍): повторять инструкцию не нужно. */
export function isAck(text: string): boolean {
  const t = norm(text).replace(/[!.,)(🙏👍❤️😊☺️🥰🙌\s]+/g, ' ').trim();
  if (!t || t.length > 40) return false;
  return /^(?:да|даа+|ага|угу|ок|окей|окэй|ладно|хорошо|хорошо спасибо|поняла|поняла спасибо|понял|понятно|ясно|принято|спасибо|благодарю|договорились|отлично|супер|сейчас сделаю|сделаю|буду делать|поняла сейчас сделаю)$/.test(t);
}

/** Клиент спрашивает про бренд («бренд какой», «какая марка»): бренд не называем, объясняем, как проверяем товар. */
export function isBrandQuestion(text: string): boolean {
  return /(?:^|[^а-я])(?:бренд\S*|брэнд\S*|производител\S*|торгов\S*\s+марк\S*)(?![а-я])/.test(norm(text));
}

export const BRAND_REPLIES = [
  'Бренд называть не нужно 🙌 Вы вбиваете ключ и присылаете скрин с выдачей, а мы сами по фото определим, наш это товар или нет.',
  'Бренд знать не нужно: просто пришлите скрин поиска по ключу, мы сами сверим по фото и подтвердим, что это наш товар 🙌',
];

/** Длинный текст (например, ТЗ) делим на несколько сообщений по абзацам, как отправил бы человек: каждое примерно до 700 знаков. */
export function splitLong(text: string, max = 700): string[] {
  const t = String(text || '');
  if (t.length <= max * 1.3 || !t.includes('\n\n')) return [t];
  const out: string[] = [];
  let cur = '';
  for (const para of t.split('\n\n')) {
    if (cur && (cur.length + para.length + 2 > max)) { out.push(cur.trim()); cur = para; }
    else cur = cur ? cur + '\n\n' + para : para;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
