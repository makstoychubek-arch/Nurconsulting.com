// Supabase Edge Function: admin-canvas
//
// Админский холст: подмешивает в карту клиентов и кабинеты. Только для супер-админа (проверка здесь, на сервере).
//   { action: 'refresh' } — пересобрать узлы «клиент» и «кабинет» и связи «владеет».
// Токены и секреты кабинетов не читаются: берём только факт «токен есть».
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, json, userFromRequest } from '../_shared/akylai-server.ts';
import { isSuperAdminUser } from '../_shared/cabinet-access.ts';
import { buildClientNodes, placeClients, type CabinetRow } from '../_shared/admin-canvas.ts';

async function isSuper(admin: any, user: { id: string; email: string }) {
    if (isSuperAdminUser(user)) return true;
    const { data } = await admin.from('spaces').select('is_super_admin, status').eq('user_id', user.id).maybeSingle();
    return data?.is_super_admin === true && data?.status === 'active';
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Нужен вход' }, 401);
    const admin = adminClient();
    if (!(await isSuper(admin, user))) return json({ error: 'Только для супер-админа' }, 403);

    let body: any = {};
    try { body = await req.json(); } catch { /* пустое тело = refresh */ }
    if ((body.action ?? 'refresh') !== 'refresh') return json({ error: 'Неизвестное действие' }, 400);

    const { data: cabs, error } = await admin.from('cabinets')
        .select('id, name, user_id, nr_managed, adv_enabled, adv_token_valid, wb_token, created_at');
    if (error) return json({ error: 'Не удалось прочитать кабинеты' }, 500);
    const cabinets: CabinetRow[] = (cabs || []).map((c: any) => ({
        id: c.id, name: c.name, user_id: c.user_id, nr_managed: c.nr_managed, adv_enabled: c.adv_enabled,
        adv_token_valid: c.adv_token_valid, has_token: !!(c.wb_token && String(c.wb_token).length > 0), created_at: c.created_at,
    }));

    const users: { id: string; email: string | null }[] = [];
    for (let page = 1; page <= 10; page++) {
        const { data, error: e } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (e || !data?.users?.length) break;
        for (const u of data.users) users.push({ id: u.id, email: u.email ?? null });
        if (data.users.length < 200) break;
    }

    const { nodes, edges } = buildClientNodes(cabinets, users);

    const { data: existingRows } = await admin.from('admin_map_nodes').select('ref, x').in('kind', ['client', 'cabinet']);
    const existing = new Set<string>((existingRows || []).map((r: any) => r.ref));
    const { data: bounds } = await admin.from('admin_map_nodes').select('x').not('kind', 'in', '(client,cabinet)').order('x', { ascending: false }).limit(1);
    const originX = Math.round(((bounds?.[0]?.x as number) ?? 4000) + 700);
    const pos = placeClients(nodes, edges, originX, 0, existing);

    const rows = nodes.map((n) => ({
        ref: n.ref, kind: n.kind, title: n.title, subtitle: n.subtitle, district: n.district, status: n.status,
        reasons: n.reasons, meta: n.meta, auto: true, seen_at: new Date().toISOString(),
        ...(pos.has(n.ref) ? { x: pos.get(n.ref)!.x, y: pos.get(n.ref)!.y } : {}),
    }));
    for (let i = 0; i < rows.length; i += 100) {
        const { error: e } = await admin.from('admin_map_nodes').upsert(rows.slice(i, i + 100), { onConflict: 'ref' });
        if (e) return json({ error: 'Не удалось записать узлы: ' + e.message }, 500);
    }
    // Клиентов и кабинетов, которых больше нет, с карты убираем (только автоматические узлы).
    const keep = new Set(nodes.map((n) => n.ref));
    const stale = [...existing].filter((r) => !keep.has(r));
    if (stale.length) await admin.from('admin_map_nodes').delete().in('ref', stale).eq('auto', true);

    const { data: idRows } = await admin.from('admin_map_nodes').select('id, ref').in('kind', ['client', 'cabinet']);
    const idOf = new Map((idRows || []).map((r: any) => [r.ref, r.id]));
    await admin.from('admin_map_edges').delete().eq('kind', 'owns').eq('auto', true);
    const edgeRows = edges.filter((e) => idOf.has(e.from) && idOf.has(e.to))
        .map((e) => ({ source: idOf.get(e.from), target: idOf.get(e.to), kind: e.kind, label: e.label, auto: true }));
    for (let i = 0; i < edgeRows.length; i += 200) await admin.from('admin_map_edges').upsert(edgeRows.slice(i, i + 200), { onConflict: 'source,target,kind' });

    return json({ ok: true, clients: nodes.filter((n) => n.kind === 'client').length, cabinets: nodes.filter((n) => n.kind === 'cabinet').length });
});
