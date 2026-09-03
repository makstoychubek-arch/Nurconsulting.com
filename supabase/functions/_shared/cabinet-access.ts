// Единое правило доступа к кабинету для edge-функций:
// владелец ИЛИ супер-админ ИЛИ сотрудник из allowed_users.
// Зеркалит SQL-функцию public.can_access_cabinet().
// deno-lint-ignore-file no-explicit-any

export const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
export const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';

export function isSuperAdminUser(user: { email?: string | null; id?: string } | null | undefined): boolean {
    if (!user) return false;
    return String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL || user.id === SUPER_ADMIN_ID;
}

export async function isTeamMember(admin: any, email: string | null | undefined): Promise<boolean> {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return false;
    const { data, error } = await admin.from('allowed_users').select('email');
    if (error || !Array.isArray(data)) return false;
    return data.some((r: any) => String(r.email || '').trim().toLowerCase() === e);
}

/** true, если пользователю можно работать с любым кабинетом без фильтра по user_id. */
export async function hasAllCabinetsAccess(admin: any, user: { email?: string | null; id?: string } | null | undefined): Promise<boolean> {
    if (isSuperAdminUser(user)) return true;
    return await isTeamMember(admin, user?.email);
}
