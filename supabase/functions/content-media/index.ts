// content-media: генерация кадров карточки («Сравнение контента → Медиа») и отправка готовых кадров в карточку WB.
// Одна задача = одна расцветка (артикул, nm_id) за 1 000 сом. Действия (POST, нужен вход):
//   { action: 'create', cabinet_id, nm_id, focus? }  — задача «ждёт оплаты» (если активная уже есть, вернём её);
//   { action: 'mark_paid', job_id }                  — ТЕСТ, только команда NR: отметить оплаченной, пока не подключён Finik; сразу запускает генерацию;
//   { action: 'run', job_id }                        — продолжить генерацию (кадры по очереди, с запасом по времени), безопасно вызывать повторно;
//   { action: 'send', job_id }                       — загрузить готовые 8 кадров в слоты 1–8 карточки WB (заменяет текущие фото).
// Генератор: Gemini (ключ GEMINI_API_KEY, модель CONTENT_IMAGE_MODEL, по умолчанию gemini-2.5-flash-image). Нет ключа: задача остаётся «оплачено», вернём NO_PROVIDER.
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, isStaffUser, json, userFromRequest } from '../_shared/akylai-server.ts';
import { emptySlides, extFromMime, jobStatusFromSlides, parseGeminiImage, slidePrompt, type Slide } from '../_shared/content-media.ts';

const BUCKET = 'content-media';
const BUDGET_MS = 100_000;   // запас по времени одного вызова
const ACTIVE = ['awaiting_payment', 'paid', 'generating', 'ready'];

async function canWork(admin: any, user: { id: string; email: string }, cabinetId: string): Promise<boolean> {
    const { data } = await admin.from('cabinets').select('user_id').eq('id', cabinetId).maybeSingle();
    if (data && String(data.user_id) === user.id) return true;
    return await isStaffUser(admin, user);
}

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
    try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return { bytes: new Uint8Array(await r.arrayBuffer()), mime: r.headers.get('content-type') || 'image/webp' };
    } catch { return null; }
}
const b64 = (u: Uint8Array): string => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

async function generateSlide(key: string, model: string, prompt: string, photo: { bytes: Uint8Array; mime: string }): Promise<{ ok: true; mime: string; bytes: Uint8Array } | { ok: false; error: string }> {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 90_000);
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST', signal: ctl.signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: photo.mime.split(';')[0], data: b64(photo.bytes) } }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: `Генератор ответил ${res.status}: ${String(j?.error?.message || '').slice(0, 160)}` };
        const img = parseGeminiImage(j);
        if (!img) return { ok: false, error: 'Генератор не вернул картинку' };
        return { ok: true, mime: img.mime, bytes: Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0)) };
    } catch (e) {
        return { ok: false, error: 'Генератор не ответил вовремя' + (e instanceof Error ? '' : '') };
    } finally { clearTimeout(t); }
}

async function runJob(admin: any, job: any): Promise<{ status: string; reason?: string }> {
    const key = Deno.env.get('GEMINI_API_KEY') || '';
    if (!key) return { status: job.status, reason: 'NO_PROVIDER' };
    const model = Deno.env.get('CONTENT_IMAGE_MODEL') || 'gemini-2.5-flash-image';
    const { data: art } = await admin.from('rnp_articles').select('name, photo_url').eq('cabinet_id', job.cabinet_id).eq('nm_id', job.nm_id).maybeSingle();
    const { data: cmp } = await admin.from('content_compare').select('data').eq('cabinet_id', job.cabinet_id).eq('nm_id', job.nm_id).maybeSingle();
    const photo = art?.photo_url ? await fetchBytes(String(art.photo_url)) : null;
    if (!photo) { await admin.from('content_media_jobs').update({ status: 'failed', error: 'Нет оригинального фото товара в карточке WB', updated_at: new Date().toISOString() }).eq('id', job.id); return { status: 'failed', reason: 'NO_PHOTO' }; }
    const slides: Slide[] = Array.isArray(job.slides) && job.slides.length ? job.slides : emptySlides();
    await admin.from('content_media_jobs').update({ status: 'generating', provider: 'gemini', error: null, updated_at: new Date().toISOString() }).eq('id', job.id);
    const started = Date.now();
    for (const s of slides) {
        if (s.status !== 'pending' && s.status !== 'failed') continue;
        if (Date.now() - started > BUDGET_MS) break;
        const prompt = slidePrompt(s.n - 1, { name: art?.name || '', keep: cmp?.data?.seo?.itog?.keep, focus: job.focus });
        const r = await generateSlide(key, model, prompt, photo);
        if (r.ok) {
            const path = `${job.cabinet_id}/${job.nm_id}/${job.id}/${s.n}.${extFromMime(r.mime)}`;
            const up = await admin.storage.from(BUCKET).upload(path, r.bytes, { contentType: r.mime, upsert: true });
            if (up.error) { s.status = 'failed'; s.error = 'Не удалось сохранить кадр'; } else { s.status = 'ready'; s.path = path; delete s.error; }
        } else { s.status = 'failed'; s.error = r.error; }
        await admin.from('content_media_jobs').update({ slides, updated_at: new Date().toISOString() }).eq('id', job.id);
    }
    const left = slides.some((x) => x.status === 'pending');
    const status = left ? 'generating' : (slides.every((x) => x.status === 'ready') ? 'ready' : 'failed');
    await admin.from('content_media_jobs').update({ slides, status, updated_at: new Date().toISOString() }).eq('id', job.id);
    return { status };
}

async function sendJob(admin: any, job: any): Promise<{ ok: boolean; error?: string }> {
    const { data: cab } = await admin.from('cabinets').select('wb_token, wb_content_token').eq('id', job.cabinet_id).maybeSingle();
    const token = String(cab?.wb_content_token || cab?.wb_token || '').replace(/\s+/g, '');
    if (token.length < 50) return { ok: false, error: 'У кабинета нет токена WB с доступом к контенту' };
    const slides: Slide[] = job.slides || [];
    for (const s of slides) {
        if (!s.path) return { ok: false, error: `Кадр ${s.n} не готов` };
        const dl = await admin.storage.from(BUCKET).download(s.path);
        if (dl.error || !dl.data) return { ok: false, error: `Кадр ${s.n} не найден в хранилище` };
        const form = new FormData();
        form.append('uploadfile', new Blob([await dl.data.arrayBuffer()], { type: dl.data.type || 'image/png' }), `slide${s.n}.${extFromMime(dl.data.type || '')}`);
        const r = await fetch('https://content-api.wildberries.ru/content/v3/media/file', { method: 'POST', headers: { Authorization: token, 'X-Nm-Id': String(job.nm_id), 'X-Photo-Number': String(s.n) }, body: form });
        const j: any = await r.json().catch(() => ({}));
        const err = String(j?.errorText || j?.additionalErrors || '');
        if (!r.ok || j?.error === true || err) return { ok: false, error: `WB не принял кадр ${s.n}: ${err || r.status}` };
    }
    return { ok: true };
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
        const user = await userFromRequest(req);
        if (!user) return json({ error: 'UNAUTHORIZED' }, 401);
        const admin = adminClient();
        let body: any = {};
        try { body = await req.json(); } catch { return json({ error: 'BAD_JSON' }, 400); }
        const action = String(body.action || '');

        if (action === 'create') {
            const cabinetId = String(body.cabinet_id || ''), nm = Number(body.nm_id);
            if (!cabinetId || !nm) return json({ error: 'BAD_PARAMS' }, 400);
            if (!await canWork(admin, user, cabinetId)) return json({ error: 'FORBIDDEN' }, 403);
            const { data: ex } = await admin.from('content_media_jobs').select('*').eq('cabinet_id', cabinetId).eq('nm_id', nm).in('status', ACTIVE).order('created_at', { ascending: false }).limit(1);
            if (ex && ex.length) return json({ ok: true, job: ex[0], existing: true });
            const { data, error } = await admin.from('content_media_jobs').insert({ cabinet_id: cabinetId, nm_id: nm, status: 'awaiting_payment', focus: body.focus ? String(body.focus).slice(0, 12) : null, slides: emptySlides(), created_by: user.id }).select('*').single();
            if (error) return json({ error: 'DB_ERROR', detail: error.message }, 500);
            return json({ ok: true, job: data });
        }

        const { data: job } = await admin.from('content_media_jobs').select('*').eq('id', String(body.job_id || '')).maybeSingle();
        if (!job) return json({ error: 'NOT_FOUND' }, 404);
        if (!await canWork(admin, user, job.cabinet_id)) return json({ error: 'FORBIDDEN' }, 403);

        if (action === 'mark_paid') {
            if (!await isStaffUser(admin, user)) return json({ error: 'FORBIDDEN' }, 403);   // пока нет Finik: тест только у команды
            if (job.status !== 'awaiting_payment') return json({ ok: true, job });
            const { data } = await admin.from('content_media_jobs').update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id).select('*').single();
            const run = await runJob(admin, data);
            const { data: fresh } = await admin.from('content_media_jobs').select('*').eq('id', job.id).single();
            return json({ ok: true, job: fresh, run });
        }
        if (action === 'run') {
            if (!['paid', 'generating', 'failed'].includes(job.status)) return json({ ok: true, job });
            const run = await runJob(admin, job);
            const { data: fresh } = await admin.from('content_media_jobs').select('*').eq('id', job.id).single();
            return json({ ok: true, job: fresh, run });
        }
        if (action === 'send') {
            if (job.status !== 'ready') return json({ ok: false, error: 'NOT_READY' });
            const r = await sendJob(admin, job);
            if (!r.ok) { await admin.from('content_media_jobs').update({ error: r.error, updated_at: new Date().toISOString() }).eq('id', job.id); return json({ ok: false, error: r.error }); }
            const { data: fresh } = await admin.from('content_media_jobs').update({ status: 'sent', sent_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() }).eq('id', job.id).select('*').single();
            return json({ ok: true, job: fresh });
        }
        return json({ error: 'UNKNOWN_ACTION' }, 400);
    } catch (e) {
        return json({ error: 'SERVER_ERROR', detail: String((e as Error)?.message || e).slice(0, 200) }, 500);
    }
});
