// Выбор WB-токена по категории API (Аналитика / Продвижение / общий).

export type WbTokenCategory = 'analytics' | 'promotion' | 'default';

export type CabinetTokenRow = {
    wb_token?: string | null;
    wb_token_analytics?: string | null;
    wb_token_promotion?: string | null;
};

const TOKEN_SELECT = 'id, name, wb_token, wb_token_analytics, wb_token_promotion';

export { TOKEN_SELECT as CABINET_TOKEN_SELECT };

export function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

export function isValidWbToken(token: string): boolean {
    return token.length >= 50;
}

export function pickCabinetToken(cab: CabinetTokenRow, category: WbTokenCategory): string {
    const fallback = sanitizeWbToken(cab.wb_token);
    if (category === 'analytics') {
        const t = sanitizeWbToken(cab.wb_token_analytics);
        return isValidWbToken(t) ? t : fallback;
    }
    if (category === 'promotion') {
        const t = sanitizeWbToken(cab.wb_token_promotion);
        return isValidWbToken(t) ? t : fallback;
    }
    return fallback;
}
