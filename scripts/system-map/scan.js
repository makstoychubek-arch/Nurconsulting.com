'use strict';
/**
 * Сканирование исходников: что код использует. Работает и с боевыми архивами (то, что реально
 * запущено), и с файлами репозитория и сайта. Секреты только по ИМЕНАМ переменных окружения.
 */

const TABLE_RE = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/g;
const RPC_RE = /\.rpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/g;
const ENV_RE = /Deno\.env\.get\(\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]/g;
const URL_RE = /https?:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi;
const STORAGE_RE = /\.storage\s*\.from\(\s*['"`]([a-z0-9_-]+)['"`]/g;

/** Известные внешние сервисы: по имени хоста. */
const INTEGRATIONS = [
    [/(^|\.)wildberries\.ru$/, 'Wildberries'],
    [/(^|\.)wb\.ru$/, 'Wildberries'],
    [/(^|\.)telegram\.org$/, 'Telegram'],
    [/(^|\.)openai\.com$/, 'OpenAI'],
    [/(^|\.)anthropic\.com$/, 'Anthropic'],
    [/(^|\.)facebook\.com$/, 'Instagram/Facebook'],
    [/(^|\.)instagram\.com$/, 'Instagram/Facebook'],
    [/(^|\.)nbkr\.kg$/, 'НБКР (курсы)'],
    [/(^|\.)cbr\.ru$/, 'ЦБ РФ (курсы)'],
    [/(^|\.)googleapis\.com$/, 'Google'],
    [/(^|\.)whatsapp\.com$/, 'WhatsApp'],
    [/(^|\.)wa\.me$/, 'WhatsApp'],
];
const IGNORED_HOSTS = /(^|\.)(esm\.sh|deno\.land|supabase\.co|supabase\.com|github\.com|jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|w3\.org|schema\.org|example\.com|localhost|nurcon\.kg|vercel\.app|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/i;

function collect(re, text) {
    const out = new Set();
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) out.add(m[1]);
    return out;
}

function integrationsOf(text) {
    const known = new Set();
    for (const host of collect(URL_RE, text)) {
        const h = host.toLowerCase();
        if (IGNORED_HOSTS.test(h)) continue;
        const hit = INTEGRATIONS.find(([re]) => re.test(h));
        if (hit) known.add(hit[1]);
    }
    return known;
}

/** Имена переменных окружения, у которых в коде есть запасное значение (?? или ||). */
function envWithDefault(text) {
    const out = new Set();
    const re = /Deno\.env\.get\(\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\)\s*(?:\?\?|\|\|)/g;
    let m;
    while ((m = re.exec(text))) out.add(m[1]);
    return out;
}

/** Какие из известных имён секретов встречаются в тексте как слово (ловит динамические чтения через таблицу имён). */
function secretMentions(text, names) {
    const out = new Set();
    for (const name of names) {
        if (new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(text)) out.add(name);
    }
    return out;
}

/** Что использует кусок кода. */
function extractFacts(text) {
    return {
        tables: collect(TABLE_RE, text),
        rpcs: collect(RPC_RE, text),
        secrets: collect(ENV_RE, text),
        buckets: collect(STORAGE_RE, text),
        integrations: integrationsOf(text),
    };
}

function mergeFacts(list) {
    const out = { tables: new Set(), rpcs: new Set(), secrets: new Set(), buckets: new Set(), integrations: new Set() };
    for (const f of list) for (const k of Object.keys(out)) for (const v of f[k]) out[k].add(v);
    return out;
}

/** Какие функции из known вызывает код (по имени в кавычках или в пути functions/v1/<имя>). */
function functionCalls(text, knownSlugs) {
    const out = new Set();
    for (const slug of knownSlugs) {
        const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?:functions/v1/${esc}(?![a-z0-9-])|['"\`]${esc}['"\`])`);
        if (re.test(text)) out.add(slug);
    }
    return out;
}

/**
 * Зашитые секреты в тексте. Нужны, чтобы не класть их в репозиторий и сообщить владельцу.
 * Возвращает найденные виды (без самих значений).
 */
const SECRET_PATTERNS = [
    ['JWT/ключ Supabase', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g],
    ['токен Telegram-бота', /\b\d{8,10}:[A-Za-z0-9_-]{34,36}\b/g],
    ['ключ OpenAI/sk-', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
    ['ключ sbp_/sb_secret', /\b(?:sbp_|sb_secret_)[A-Za-z0-9_-]{20,}\b/g],
    ['запасное значение секрета в коде', /Deno\.env\.get\(\s*['"`][A-Za-z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD)[A-Za-z0-9_]*['"`]\s*\)\s*\?\?\s*['"`][^'"`\n]{6,}['"`]/g],
];

function findHardcodedSecrets(text) {
    const kinds = new Set();
    for (const [kind, re] of SECRET_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(text)) kinds.add(kind);
    }
    return [...kinds];
}

/** Заменяет зашитые значения заглушкой, чтобы исходник можно было класть в репозиторий. */
function redactSecrets(text) {
    let out = text;
    for (const [kind, re] of SECRET_PATTERNS) {
        re.lastIndex = 0;
        out = out.replace(re, (m) => {
            if (kind === 'запасное значение секрета в коде') {
                return m.replace(/\?\?\s*['"`][^'"`\n]+['"`]$/, "?? '<ЗНАЧЕНИЕ УБРАНО>'");
            }
            return '<УБРАНО:' + kind + '>';
        });
    }
    return out;
}

module.exports = {
    extractFacts, mergeFacts, functionCalls, integrationsOf, envWithDefault, secretMentions,
    findHardcodedSecrets, redactSecrets, INTEGRATIONS,
};
