// Supabase Edge Function: marketplace-news-watch
// Каждые 2 часа мониторит новости WB / Ozon в интернете (Google News RSS)
// и шлёт в группу «Триггеры» (TELEGRAM_CHAT_TRIGGERS):
//   дата · бренд · краткий контекст · ссылка «читать» на статью.
//
// Auth: service_role / legacy JWT (см. service-auth.ts)
// Body: { "test": true } — проверка чата
//       { "force": true } — игнор дедупа для найденных (осторожно)
//       { "limit": 5 } — макс. постов за один прогон (по умолчанию 5)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    getTelegramChatId,
    getTelegramToken,
    isTelegramConfigured,
    telegramConfigError,
} from '../_shared/telegram-routing.ts';
import { summarizeForTelegram } from '../_shared/ai-summarize.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nr-setup-key',
};

const MAX_AGE_HOURS = 36; // только свежие (полтора суток)
const DEFAULT_LIMIT = 5;
const TG_DELAY_MS = 800;
const FEED_TIMEOUT_MS = 12000;

/** Российские СМИ + поиск по маркетплейсам (Google с edge часто 503). */
const FEEDS: Array<{ market: 'WB' | 'Ozon' | 'Both'; label: string; url: string }> = [
    {
        market: 'WB',
        label: 'Bing·WB',
        url: 'https://www.bing.com/news/search?q=Wildberries&format=RSS&mkt=ru-RU',
    },
    {
        market: 'Ozon',
        label: 'Bing·Ozon',
        url: 'https://www.bing.com/news/search?q=Ozon&format=RSS&mkt=ru-RU',
    },
    {
        market: 'Both',
        label: 'Retail.ru',
        url: 'https://www.retail.ru/rss/news/',
    },
    {
        market: 'Both',
        label: 'Vedomosti',
        url: 'https://www.vedomosti.ru/rss/news',
    },
    {
        market: 'Both',
        label: 'Kommersant',
        url: 'https://www.kommersant.ru/RSS/news.xml',
    },
    {
        market: 'Both',
        label: 'RBC',
        url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss',
    },
    {
        market: 'Both',
        label: 'Lenta',
        url: 'https://lenta.ru/rss/news',
    },
    {
        market: 'Both',
        label: 'Interfax',
        url: 'https://www.interfax.ru/rss.asp',
    },
];

const MARKET_RE =
    /wildberries|вайлдберр(?:из|иес)?|\bozon\b|ozon\.ru|wildberries\.ru|маркетплейс/i;
const MARKET_RU_RE = /(^|[^а-яёА-ЯЁ])(вб|озон)([^а-яёА-ЯЁ]|$)/i;
const MARKET_CTX_RE = /склад|пвз|селлер|продавц|ритейл|фулфил|логистик|комисси|спп|карточек/i;

type NewsItem = {
    market: 'WB' | 'Ozon' | 'Both';
    title: string;
    url: string;
    publishedAt: Date;
    snippet: string;
    source: string;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const tgToken = getTelegramToken();
    const tgChatId = getTelegramChatId('triggers');

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const allowSetup = Boolean(body?.test);
    if (!isServiceAuthorized(req, serviceKey, allowSetup)) {
        return json({ error: 'Unauthorized' }, 401);
    }

    if (body?.test) {
        if (!isTelegramConfigured('triggers')) {
            return json({ ok: false, error: telegramConfigError('triggers'), chatId: tgChatId || null }, 400);
        }
        const text =
            '✅ Тест «Триггеры»: мониторинг новостей WB / Ozon каждый час (24/7).\n' +
            'Формат: дата · суть · <a href="https://example.com">читать</a>';
        const send = await sendTelegramHtml(tgToken, tgChatId, text);
        return json({ ok: send.ok, ...send, chatId: tgChatId });
    }

    if (!isTelegramConfigured('triggers')) {
        return json({ error: telegramConfigError('triggers') }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const limit = Math.min(15, Math.max(1, Number(body?.limit) || DEFAULT_LIMIT));
    const force = Boolean(body?.force);

    try {
        const collected: NewsItem[] = [];
        const feedStats: Record<string, number | string> = {};
        const settled = await Promise.allSettled(
            FEEDS.map(async (feed) => {
                const items = await fetchGoogleNewsRss(feed.url, feed.market);
                return { label: feed.label, items };
            }),
        );
        for (const res of settled) {
            if (res.status === 'fulfilled') {
                feedStats[res.value.label] = res.value.items.length;
                collected.push(...res.value.items);
            } else {
                const idx = settled.indexOf(res);
                const label = FEEDS[idx]?.label || 'feed';
                feedStats[label] = `err:${String(res.reason).slice(0, 80)}`;
            }
        }

        const filtered = dedupeByUrl(collected)
            .filter((n) => isFresh(n.publishedAt, MAX_AGE_HOURS))
            .filter((n) => isMarketplaceRelevant(n.title, n.snippet))
            .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

        const actions: string[] = [];
        let sent = 0;

        for (const item of filtered) {
            if (sent >= limit) break;

            const urlKey = normalizeUrlKey(item.url);
            if (!force) {
                const { data: dupes } = await admin
                    .from('marketplace_news_sent')
                    .select('url_key')
                    .eq('url_key', urlKey)
                    .limit(1);
                if (dupes?.length) {
                    actions.push(`skip:${urlKey.slice(0, 40)}`);
                    continue;
                }
            }

            const text = await formatMessage(item);
            const send = await sendTelegramHtml(tgToken, tgChatId, text);
            if (!send.ok) {
                actions.push(`fail:${send.error || 'send'}`);
                if (send.migrateTo) {
                    return json({
                        ok: false,
                        error: send.error,
                        migrateTo: send.migrateTo,
                        chatId: tgChatId,
                        hint: `Группа стала супергруппой — поставь TELEGRAM_CHAT_TRIGGERS=${send.migrateTo}`,
                        actions,
                        feedStats,
                        ms: Date.now() - started,
                    }, 400);
                }
                if (/chat not found|forbidden|bot was blocked|have no rights/i.test(send.error || '')) {
                    return json({
                        ok: false,
                        error: send.error,
                        chatId: tgChatId,
                        hint: 'Добавь бота в группу «триггер» и сделай админом (или проверь chat_id)',
                        actions,
                        feedStats,
                        ms: Date.now() - started,
                    }, 400);
                }
                continue;
            }

            await admin.from('marketplace_news_sent').upsert({
                url_key: urlKey,
                url: item.url.slice(0, 2000),
                title: item.title.slice(0, 500),
                market: item.market,
                published_at: item.publishedAt.toISOString(),
                sent_at: new Date().toISOString(),
            }, { onConflict: 'url_key' });

            sent += 1;
            actions.push(`sent:${item.market}:${item.title.slice(0, 40)}`);
            await sleep(TG_DELAY_MS);
        }

        return json({
            ok: true,
            fetched: collected.length,
            matched: filtered.length,
            sent,
            chatId: tgChatId,
            feedStats,
            actions,
            ms: Date.now() - started,
        });
    } catch (e) {
        console.error('[marketplace-news-watch]', e);
        return json({ error: String(e) }, 500);
    }
});

async function formatMessage(item: NewsItem): Promise<string> {
    const dateStr = formatRuDate(item.publishedAt);
    const marketLabel = item.market === 'Both' ? 'WB/Ozon' : item.market;
    const icon = item.market === 'Ozon' ? '📦' : item.market === 'WB' ? '🛒' : '📰';

    let context = '';
    const ai = await summarizeForTelegram({
        title: item.title,
        body: `${item.snippet}\nИсточник: ${item.source}\nURL: ${item.url}`,
        maxChars: 320,
    });
    if (ai.via === 'ai' && ai.summary) {
        context = ai.summary;
    } else {
        context = heuristicSummary(item.title, item.snippet);
    }

    const safeTitle = escapeHtml(item.title.replace(/\s+/g, ' ').trim());
    const safeContext = escapeHtml(context);
    const href = escapeAttr(item.url);

    return [
        `${icon} <b>${marketLabel}</b> · ${dateStr}`,
        `<b>${safeTitle}</b>`,
        '',
        safeContext,
        '',
        `<a href="${href}">читать</a>`,
    ].join('\n');
}

function heuristicSummary(title: string, snippet: string): string {
    const raw = `${snippet || title}`.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw.length <= 280) return raw;
    const cut = raw.slice(0, 280);
    const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
    return (last > 140 ? cut.slice(0, last) : cut).trim() + '…';
}

async function fetchGoogleNewsRss(url: string, market: NewsItem['market']): Promise<NewsItem[]> {
    const xml = await fetchTextWithFallback(url);
    return parseRssItems(xml, market);
}

async function fetchTextWithFallback(url: string): Promise<string> {
    const attempts = [url];
    let lastErr: unknown;
    for (const attempt of attempts) {
        try {
            const res = await fetch(attempt, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Accept: 'application/rss+xml, application/xml, text/xml, */*',
                },
                signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (!/<item[\s>]/i.test(text) && !/<entry[\s>]/i.test(text)) {
                throw new Error('no rss items in response');
            }
            return text;
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('feed fetch failed');
}

function parseRssItems(xml: string, market: NewsItem['market']): NewsItem[] {
    const items: NewsItem[] = [];
    const blocks = xml.split(/<item>/i).slice(1);
    for (const block of blocks) {
        const chunk = block.split(/<\/item>/i)[0] || '';
        const title = decodeXml(stripCdata(matchTag(chunk, 'title'))).trim();
        const linkRaw = stripCdata(matchTag(chunk, 'link')).trim() ||
            (chunk.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
        const pub = stripCdata(matchTag(chunk, 'pubDate')).trim();
        const desc = decodeXml(stripCdata(matchTag(chunk, 'description'))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const source = decodeXml(stripCdata(matchTag(chunk, 'source'))).trim() || 'Google News';
        if (!title || !linkRaw) continue;

        const url = unwrapGoogleNewsUrl(linkRaw);
        const publishedAt = pub ? new Date(pub) : new Date();
        if (Number.isNaN(publishedAt.getTime())) continue;

        items.push({
            market: detectMarket(title + ' ' + desc, market),
            title,
            url,
            publishedAt,
            snippet: desc.slice(0, 800),
            source,
        });
    }
    return items;
}

function isMarketplaceRelevant(title: string, snippet: string): boolean {
    const t = `${title} ${snippet}`;
    if (MARKET_RE.test(t)) return true;
    // «ВБ»/«Озон» без латиницы — только с маркетплейс-контекстом (чтобы не ловить «озон» как вещество)
    if (MARKET_RU_RE.test(t) && MARKET_CTX_RE.test(t)) return true;
    return false;
}

function detectMarket(text: string, fallback: NewsItem['market']): NewsItem['market'] {
    const hasWb = /wildberries|вайлдберр|\bвб\b/i.test(text);
    const hasOz = /ozon|озон/i.test(text);
    if (hasWb && hasOz) return 'Both';
    if (hasWb) return 'WB';
    if (hasOz) return 'Ozon';
    return fallback;
}

function unwrapGoogleNewsUrl(link: string): string {
    try {
        const u = new URL(link);
        const nested = u.searchParams.get('url');
        if (nested) return nested;
        // Google News article redirect sometimes embeds destination in path
        return link;
    } catch {
        return link;
    }
}

function matchTag(xml: string, tag: string): string {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    return xml.match(re)?.[1] ?? '';
}

function stripCdata(s: string): string {
    return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function decodeXml(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}

function normalizeUrlKey(url: string): string {
    try {
        const u = new URL(url);
        u.hash = '';
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => u.searchParams.delete(k));
        return u.toString().slice(0, 500);
    } catch {
        return url.slice(0, 500);
    }
}

function dedupeByUrl(items: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    const out: NewsItem[] = [];
    for (const it of items) {
        const k = normalizeUrlKey(it.url);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(it);
    }
    return out;
}

function isFresh(d: Date, hours: number): boolean {
    return Date.now() - d.getTime() <= hours * 3600 * 1000;
}

function formatRuDate(d: Date): string {
    const parts = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Asia/Bishkek',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return `${get('day')}.${get('month')}.${get('year')}`;
}

async function sendTelegramHtml(
    token: string,
    chatId: string,
    text: string,
): Promise<{ ok: boolean; error?: string; messageId?: number; migrateTo?: string }> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(20000),
        });
        const raw = await res.text();
        let data: {
            ok?: boolean;
            description?: string;
            result?: { message_id?: number };
            parameters?: { migrate_to_chat_id?: number };
        };
        try {
            data = JSON.parse(raw);
        } catch {
            return { ok: false, error: `bad json: ${raw.slice(0, 200)}` };
        }
        if (!res.ok || !data.ok) {
            const migrateTo = data.parameters?.migrate_to_chat_id != null
                ? String(data.parameters.migrate_to_chat_id)
                : undefined;
            return {
                ok: false,
                error: data.description || `HTTP ${res.status}`,
                migrateTo,
            };
        }
        return { ok: true, messageId: data.result?.message_id };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
