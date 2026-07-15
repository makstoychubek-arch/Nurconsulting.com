// Supabase Edge Function: ab-test-rotate
// Server-side cron job that actually performs A/B test photo rotations on WB,
// independent of whether the dashboard tab is open in any browser.
// Auth: service_role key only (triggered by pg_cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== serviceKey) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const results: Array<Record<string, unknown>> = [];

    try {
        const { data: tests, error: testsErr } = await admin
            .from('ab_tests')
            .select('*')
            .eq('status', 'active');

        if (testsErr) throw new Error(`ab_tests: ${testsErr.message}`);

        for (const test of tests || []) {
            try {
                const intervalMin = Number(test.rotation_interval_min) || 60;
                const dueSince = test.last_rotated_at || test.started_at;
                const elapsedMs = dueSince ? Date.now() - new Date(dueSince).getTime() : Infinity;
                if (elapsedMs < intervalMin * 60 * 1000) {
                    results.push({ test_id: test.id, skipped: 'not_due' });
                    continue;
                }

                const { data: variants, error: vErr } = await admin
                    .from('ab_test_variants')
                    .select('*')
                    .eq('test_id', test.id)
                    .order('variant_label');
                if (vErr) throw new Error(vErr.message);
                if (!variants || variants.length < 2) {
                    results.push({ test_id: test.id, skipped: 'not_enough_variants' });
                    continue;
                }

                const { data: cab, error: cabErr } = await admin
                    .from('cabinets')
                    .select('wb_token')
                    .eq('id', test.cabinet_id)
                    .maybeSingle();
                if (cabErr || !cab?.wb_token) {
                    results.push({ test_id: test.id, error: 'cabinet_or_token_missing' });
                    continue;
                }
                const WB_TOKEN = sanitizeWbToken(cab.wb_token);
                if (!isValidWbToken(WB_TOKEN)) {
                    results.push({ test_id: test.id, error: 'invalid_wb_token' });
                    continue;
                }

                const curIdx = Number(test.current_variant_index) || 0;
                const nextIdx = (curIdx + 1) % variants.length;
                const currentVariant = variants[curIdx];
                const nextVariant = variants[nextIdx];

                const rotateOk = await saveMediaOnWb(admin, WB_TOKEN, Number(test.nm_id), nextVariant.photo_url);
                if (!rotateOk.ok) {
                    results.push({ test_id: test.id, error: rotateOk.errorText || 'wb_media_save_failed' });
                    continue;
                }

                if (currentVariant) {
                    await admin.from('ab_test_variants').update({
                        minutes_active: (currentVariant.minutes_active || 0) + intervalMin,
                        is_currently_on_wb: false,
                    }).eq('id', currentVariant.id);
                }
                await admin.from('ab_test_variants').update({ is_currently_on_wb: true }).eq('id', nextVariant.id);

                const newRotCount = (Number(test.rotation_count) || 0) + 1;
                const shouldFinish = Boolean(test.max_rotations) && newRotCount >= Number(test.max_rotations);
                await admin.from('ab_tests').update({
                    current_variant_index: nextIdx,
                    rotation_count: newRotCount,
                    last_rotated_at: new Date().toISOString(),
                    status: shouldFinish ? 'finished' : 'active',
                    finished_at: shouldFinish ? new Date().toISOString() : null,
                }).eq('id', test.id);

                await admin.from('ab_test_rotation_log').insert({
                    test_id: test.id,
                    variant_label: nextVariant.variant_label,
                    action: 'rotate',
                });

                results.push({ test_id: test.id, rotated_to: nextVariant.variant_label, finished: shouldFinish });
            } catch (e) {
                console.error('[ab-test-rotate] test', test.id, e);
                results.push({ test_id: test.id, error: String(e) });
            }
        }

        // ── Пересчёт реальных заказов на вариант ────────────────────────────
        // orders/impressions на ab_test_variants раньше никогда не обновлялись
        // (всегда 0), поэтому "победитель" не мог определиться. Теперь считаем
        // заказы по каждому варианту из wb_orders, используя точные временные
        // окна показа фото из ab_test_rotation_log (лог хранит created_at
        // каждой ротации, а data->>'date' в wb_orders — точное время заказа).
        const statsResults: Array<Record<string, unknown>> = [];
        const { data: liveTests } = await admin
            .from('ab_tests')
            .select('*')
            .in('status', ['active', 'finished']);

        for (const test of liveTests || []) {
            try {
                const { data: log } = await admin
                    .from('ab_test_rotation_log')
                    .select('variant_label, created_at')
                    .eq('test_id', test.id)
                    .order('created_at');
                if (!log || log.length === 0) continue;

                const { data: variants } = await admin
                    .from('ab_test_variants')
                    .select('*')
                    .eq('test_id', test.id);
                if (!variants || variants.length === 0) continue;

                const { data: orders } = await admin
                    .from('wb_orders')
                    .select('order_date, price, is_return, data')
                    .eq('cabinet_id', test.cabinet_id)
                    .eq('nm_id', test.nm_id)
                    .gte('order_date', String(test.started_at || '').split('T')[0] || '2020-01-01');

                const tally = new Map<string, { orders: number; revenue: number }>();
                for (const v of variants) tally.set(v.variant_label, { orders: 0, revenue: 0 });

                const windowEnd = new Date();
                for (const order of orders || []) {
                    if (order.is_return) continue;
                    const rawDate = (order.data as Record<string, unknown> | null)?.date as string | undefined;
                    const ts = rawDate ? new Date(rawDate) : new Date(`${order.order_date}T00:00:00Z`);
                    if (isNaN(ts.getTime())) continue;

                    let label: string | null = null;
                    for (let i = log.length - 1; i >= 0; i--) {
                        const winStart = new Date(log[i].created_at);
                        const winEnd = i + 1 < log.length ? new Date(log[i + 1].created_at) : windowEnd;
                        if (ts >= winStart && ts < winEnd) { label = log[i].variant_label; break; }
                    }
                    if (!label || !tally.has(label)) continue;
                    const bucket = tally.get(label)!;
                    bucket.orders += 1;
                    bucket.revenue += Number(order.price) || 0;
                }

                for (const v of variants) {
                    const t = tally.get(v.variant_label) || { orders: 0, revenue: 0 };
                    await admin.from('ab_test_variants').update({
                        orders: t.orders,
                        revenue: t.revenue,
                    }).eq('id', v.id);
                }
                statsResults.push({ test_id: test.id, tally: Object.fromEntries(tally) });
            } catch (e) {
                console.error('[ab-test-rotate] stats', test.id, e);
                statsResults.push({ test_id: test.id, error: String(e) });
            }
        }

        return json({ ok: true, processed: results.length, results, stats: statsResults, ms: Date.now() - started });
    } catch (err) {
        console.error('[ab-test-rotate] fatal:', err);
        return json({ error: String(err) }, 500);
    }
});

// Mirrors wb-proxy's `media_save` action so the cron job can push a photo to
// WB without going through the user-JWT-gated proxy.
async function saveMediaOnWb(
    admin: ReturnType<typeof createClient>,
    wbToken: string,
    nmId: number,
    photoUrl: string,
): Promise<{ ok: boolean; errorText?: string }> {
    if (!nmId || !photoUrl) return { ok: false, errorText: 'nmId and photoUrl required' };

    let imageBytes: Uint8Array;
    let mimeType = 'image/jpeg';

    const storageMatch = String(photoUrl).match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
    if (storageMatch) {
        const bucket = storageMatch[1];
        const path = decodeURIComponent(storageMatch[2]);
        const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path);
        if (dlErr || !blob) {
            return { ok: false, errorText: `Не удалось скачать фото из хранилища: ${dlErr?.message || 'файл не найден'}` };
        }
        imageBytes = new Uint8Array(await blob.arrayBuffer());
        mimeType = blob.type || mimeType;
    } else {
        const imgRes = await fetch(photoUrl);
        if (!imgRes.ok) {
            return { ok: false, errorText: `WB не сможет скачать фото (HTTP ${imgRes.status}).` };
        }
        imageBytes = new Uint8Array(await imgRes.arrayBuffer());
        mimeType = imgRes.headers.get('content-type') || mimeType;
    }

    if (imageBytes.length < 1000) {
        return { ok: false, errorText: 'Файл слишком маленький или пустой' };
    }

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('uploadfile', new Blob([imageBytes], { type: mimeType }), `abtest.${ext}`);

    const fileRes = await fetch('https://content-api.wildberries.ru/content/v3/media/file', {
        method: 'POST',
        headers: {
            Authorization: wbToken,
            'X-Nm-Id': String(nmId),
            'X-Photo-Number': '1',
        },
        body: form,
    });
    const fileJson = await fileRes.json().catch(() => ({})) as Record<string, unknown>;
    const errText = String(fileJson?.errorText || fileJson?.additionalErrors || '');
    if (!fileRes.ok || fileJson?.error === true || errText) {
        return { ok: false, errorText: errText || `WB API ${fileRes.status}` };
    }
    return { ok: true };
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function isValidWbToken(token: string): boolean {
    return token.length > 50 && /^[\x21-\x7E]+$/.test(token);
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
