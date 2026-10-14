// Supabase Edge Function: content-tg-ingest
//
// Вебхук бота контента. Берёт новые посты из Telegram-каналов клиентов (channel_post), сохраняет
// картинки в хранилище и кладёт посты в очередь Контент-завода (ручное подтверждение или авто).
// Видео не импортируем. Deploy: supabase functions deploy content-tg-ingest --no-verify-jwt
// deno-lint-ignore-file no-explicit-any

import { adminClient } from '../_shared/akylai-server.ts';
import { readAdvTokenFromVault } from '../_shared/wb-adv-proxy.ts';
import { cleanCaption, parseChannelPost, planRows, scheduleFor, titleFrom, type ParsedPost, type TgSourceRule } from '../_shared/content-tg.ts';

const ok = () => new Response('ok');
const MAX_FILE = 9 * 1024 * 1024;

async function savePhoto(admin: any, token: string, cabinetId: string, post: ParsedPost): Promise<string | null> {
    if (!post.fileId) return null;
    const f = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: post.fileId }),
    }).then((r) => r.json()).catch(() => null) as any;
    const path = f?.result?.file_path;
    if (!f?.ok || !path) return null;
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_FILE) return null;
    const ext = /\.(png|webp)$/i.test(path) ? String(path.split('.').pop()).toLowerCase() : 'jpg';
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const name = `${cabinetId}/tg/${post.chatId}-${post.messageId}.${ext}`;
    const { error } = await admin.storage.from('content-factory').upload(name, buf, { contentType: type, upsert: true });
    if (error) return null;
    return admin.storage.from('content-factory').getPublicUrl(name).data.publicUrl;
}

Deno.serve(async (req) => {
    if (req.method !== 'POST') return ok();
    const admin = adminClient();
    const { data: bot } = await admin.from('content_tg_bot').select('*').eq('id', true).maybeSingle();
    if (!bot?.token_secret_id || !bot.webhook_secret) return ok();
    if ((req.headers.get('x-telegram-bot-api-secret-token') || '') !== bot.webhook_secret) return new Response('forbidden', { status: 403 });

    let update: any = null;
    try { update = await req.json(); } catch { return ok(); }
    const post = parseChannelPost(update);
    if (!post) return ok();

    const { data: src } = await admin.from('content_tg_sources').select('*').eq('chat_id', post.chatId).eq('enabled', true).maybeSingle();
    if (!src) return ok();
    const rule = src as TgSourceRule;
    let plan = planRows(post, rule);
    if (!plan.length) return ok();

    const token = await readAdvTokenFromVault(admin, bot.token_secret_id);
    if (!token) return ok();

    const url = post.kind === 'photo' ? await savePhoto(admin, token, src.cabinet_id, post) : null;
    if (post.kind === 'photo' && !url) plan = plan.slice(0, 1); // картинка не загрузилась: одна запись-черновик
    const caption = cleanCaption(post.text, rule);
    const base = post.groupId ? `g:${post.chatId}:${post.groupId}` : `m:${post.chatId}:${post.messageId}`;
    const when = scheduleFor(post.receivedAt, rule);

    for (const row of plan) {
        const key = plan.length > 1 || row.post_kind === 'story' ? `${base}:${row.post_kind}` : base;
        const noMedia = post.kind === 'photo' && !url;
        const status = noMedia ? 'draft' : row.status;
        const note = noMedia ? 'Не удалось загрузить картинку из Telegram' : row.note;
        const values: Record<string, unknown> = {
            cabinet_id: src.cabinet_id, source: 'telegram', tg_key: key, platform: 'instagram', post_kind: row.post_kind,
            status, title: titleFrom(cleanCaption(post.text, { strip_links: true, add_signature: false, signature: null })) || null, caption: caption || null, tg_note: note,
            file_url: url, slide_urls: url ? [url] : [],
            publish_at: status === 'draft' ? null : when.toISOString(),
            approved_at: status === 'scheduled' ? new Date().toISOString() : null,
        };
        for (let attempt = 0; attempt < 3; attempt++) {
            const { data: ex } = await admin.from('content_posts').select('id, slide_urls, caption, file_url, status')
                .eq('cabinet_id', src.cabinet_id).eq('tg_key', key).maybeSingle();
            if (ex) {
                // следующая картинка альбома: добавляем слайд, если пост ещё не опубликован
                if (post.groupId && url && src.take_albums && ex.status !== 'published') {
                    const slides = Array.isArray(ex.slide_urls) ? ex.slide_urls : [];
                    if (!slides.includes(url)) {
                        await admin.from('content_posts').update({
                            slide_urls: [...slides, url], file_url: ex.file_url || url,
                            caption: ex.caption || caption || null,
                        }).eq('id', ex.id);
                    }
                }
                break;
            }
            const { error } = await admin.from('content_posts').insert(values);
            if (!error) break;
            if (!/duplicate|unique/i.test(error.message)) { console.error('[content-tg-ingest]', error.message); break; }
        }
    }
    await admin.from('content_tg_sources').update({ last_post_at: new Date().toISOString() }).eq('cabinet_id', src.cabinet_id);
    return ok();
});
