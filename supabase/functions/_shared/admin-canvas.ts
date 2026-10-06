// Клиенты и кабинеты как узлы админского холста. Чистая логика без базы, чтобы её можно было проверить тестом.
// Токены и секреты сюда не попадают вообще: только факты «есть / нет».
// deno-lint-ignore-file no-explicit-any

export type CabinetRow = {
    id: string; name: string | null; user_id: string; nr_managed: boolean | null; adv_enabled: boolean | null;
    adv_token_valid: boolean | null; has_token: boolean; created_at?: string | null;
};
export type UserRow = { id: string; email: string | null };

export type CanvasNode = {
    ref: string; kind: 'client' | 'cabinet'; title: string; subtitle: string; district: string;
    status: 'ok' | 'warn' | 'bad' | 'unused'; reasons: string[]; meta: Record<string, unknown>;
};
export type CanvasEdge = { from: string; to: string; kind: string; label: string };

const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Что не так с кабинетом, человеческим языком. */
export function cabinetReasons(c: CabinetRow): { status: CanvasNode['status']; reasons: string[] } {
    const reasons: string[] = [];
    let status: CanvasNode['status'] = 'ok';
    if (!c.has_token) { reasons.push('В кабинете нет токена WB'); status = 'bad'; }
    if (c.adv_enabled && c.adv_token_valid === false) { reasons.push('Реклама включена, а токен рекламы не действует'); if (status === 'ok') status = 'warn'; }
    if (!c.nr_managed) { reasons.push('Кабинет не ведёт команда NR: утренние отчёты и уведомления о заказах для него не запускаются'); }
    return { status, reasons };
}

export function buildClientNodes(cabinets: CabinetRow[], users: UserRow[]): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];
    const emails = new Map(users.map((u) => [u.id, u.email || '']));
    const byUser = new Map<string, CabinetRow[]>();
    for (const c of cabinets) byUser.set(c.user_id, [...(byUser.get(c.user_id) || []), c]);
    for (const [uid, list] of byUser) {
        const email = emails.get(uid) || '';
        const worst = list.map(cabinetReasons).some((r) => r.status === 'bad') ? 'warn' : 'ok';
        nodes.push({
            ref: `client:${uid}`, kind: 'client', title: cap(email || 'клиент без почты', 34),
            subtitle: `${list.length} каб.`, district: 'clients', status: worst as any,
            reasons: worst === 'warn' ? ['У клиента есть кабинет без токена WB'] : [], meta: { cabinets: list.length },
        });
        for (const c of list) {
            const { status, reasons } = cabinetReasons(c);
            nodes.push({
                ref: `cab:${c.id}`, kind: 'cabinet', title: cap(c.name || 'Кабинет', 34),
                subtitle: c.nr_managed ? 'ведёт команда NR' : 'сам клиент',
                district: 'clients', status, reasons,
                meta: { nr_managed: !!c.nr_managed, adv_enabled: !!c.adv_enabled, has_token: c.has_token, created_at: c.created_at || null },
            });
            edges.push({ from: `client:${uid}`, to: `cab:${c.id}`, kind: 'owns', label: 'владеет' });
        }
    }
    return { nodes, edges };
}

/** Раскладка клиентов правее основной карты: клиент слева, его кабинеты столбиком справа от него. */
export function placeClients(nodes: CanvasNode[], edges: CanvasEdge[], originX: number, originY: number, existing: Set<string>) {
    const pos = new Map<string, { x: number; y: number }>();
    const children = new Map<string, string[]>();
    for (const e of edges) children.set(e.from, [...(children.get(e.from) || []), e.to]);
    let y = originY;
    for (const n of nodes.filter((n) => n.kind === 'client')) {
        const kids = children.get(n.ref) || [];
        const h = Math.max(1, kids.length) * 96;
        if (!existing.has(n.ref)) pos.set(n.ref, { x: originX, y: y + h / 2 - 40 });
        kids.forEach((k, i) => { if (!existing.has(k)) pos.set(k, { x: originX + 300, y: y + i * 96 }); });
        y += h + 40;
    }
    return pos;
}
