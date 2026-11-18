/**
 * «Настройки → Боты и ключи»: ключ OpenAI и сервисный аккаунт Google. Только супер-админ.
 * Значения ключей сохраняются в integration_secrets и наружу не возвращаются: только маска и метаданные.
 * Токены Telegram-ботов ведёт функция telegram-admin. Все зависимости передаются снаружи, логику можно проверять без сети.
 */

export type Row = { key: string; meta: Record<string, unknown> | null; updated_at: string | null };

export type Deps = {
  db: {
    list: () => Promise<Row[]>;
    get: (key: string) => Promise<string>;
    set: (key: string, value: string, meta: Record<string, unknown>, by: string | null) => Promise<boolean>;
    remove: (key: string) => Promise<boolean>;
    activeSheetId: () => Promise<string | null>;
    cabinets: () => Promise<Array<{ id: string; name: string }>>;
    links: () => Promise<Array<{ cabinet_id: string; sheet_id: string; tab: string; enabled: boolean; last_sync_at: string | null; last_error: string | null }>>;
    linkSheet: (cabinetId: string, sheetId: string, tab: string) => Promise<boolean>;
    unlinkSheet: (cabinetId: string) => Promise<boolean>;
    usage: () => Promise<{ costUsd: number; todayUsd: number; calls: number; errors: number; lastError: string | null; lastErrorAt: string | null } | null>;
    budget: () => Promise<number>;
  };
  /** Проверка листа аккаунтом Google: доступ, вкладки, найдена ли шапка «Раздачи». */
  checkSheetTab: (token: string, sheetId: string, tab: string) => Promise<{ ok: boolean; title?: string; tabs?: string[]; hasTab?: boolean; header?: boolean; rows?: number }>;
  envHas: (name: string) => boolean;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  googleToken: (json: string) => Promise<string>;
  userId: string | null;
  now: () => string;
  forget: () => void;
};

export type Result = { status: number; body: Record<string, unknown> };

const OPENAI = 'openai_api_key';
const GOOGLE = 'google_service_account';
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

const fail = (status: number, error: string): Result => ({ status, body: { ok: false, error } });
const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { ok: true, ...body } });

export function maskKey(key: string): string {
  const k = key.trim();
  return k.length <= 8 ? '••••' : `${k.slice(0, 3)}…${k.slice(-4)}`;
}

async function checkOpenAi(deps: Deps, key: string): Promise<{ ok: boolean; error?: string }> {
  const res = await deps.fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res) return { ok: false, error: 'OpenAI не ответил. Проверьте соединение и повторите.' };
  if (res.status === 401) return { ok: false, error: 'OpenAI не принял ключ. Проверьте, что скопировали его целиком.' };
  if (!res.ok) return { ok: false, error: `OpenAI ответил ошибкой ${res.status}. Ключ не сохранён.` };
  return { ok: true };
}

type SheetCheck = { sheet: boolean | null; title?: string };

async function checkSheet(deps: Deps, token: string): Promise<SheetCheck> {
  const id = await deps.db.activeSheetId();
  if (!id) return { sheet: null };
  const res = await deps.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) return { sheet: false };
  const data = await res.json().catch(() => null) as { properties?: { title?: string } } | null;
  return { sheet: true, title: data?.properties?.title };
}

export function extractSheetId(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9-_]{25,}$/.test(s) ? s : null;
}

export function parseServiceAccount(raw: string): { email: string; project: string | null } | null {
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') return null;
    const email = String(j.client_email || '');
    const pk = String(j.private_key || '');
    if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(email) || !/BEGIN (?:RSA )?PRIVATE KEY/.test(pk)) return null;
    return { email, project: j.project_id ? String(j.project_id) : null };
  } catch {
    return null;
  }
}

export async function handleIntegrations(body: Record<string, unknown>, deps: Deps): Promise<Result> {
  const action = String(body.action || 'status');

  if (action === 'status') {
    const rows = await deps.db.list();
    const by = new Map(rows.map((r) => [r.key, r]));
    const item = (key: string, env: string) => {
      const r = by.get(key);
      return r
        ? { configured: true, source: 'db', meta: r.meta || {}, updated_at: r.updated_at }
        : deps.envHas(env) ? { configured: true, source: 'env', meta: {}, updated_at: null } : { configured: false, source: 'none', meta: {}, updated_at: null };
    };
    const [cabinets, links, usage, budget] = await Promise.all([deps.db.cabinets(), deps.db.links(), deps.db.usage(), deps.db.budget()]);
    const linkBy = new Map(links.map((l) => [l.cabinet_id, l]));
    return ok({
      openai: item(OPENAI, 'OPENAI_API_KEY'), google: item(GOOGLE, 'GOOGLE_SERVICE_ACCOUNT_JSON'), models: OPENAI_MODELS,
      llm: usage ? { ...usage, budgetUsd: budget } : null,
      sheets: cabinets.map((c) => ({ id: c.id, name: c.name, link: linkBy.get(c.id) ?? null })),
    });
  }

  if (action === 'set_openai') {
    const key = String(body.api_key || '').trim();
    const model = OPENAI_MODELS.includes(String(body.model)) ? String(body.model) : OPENAI_MODELS[0];
    if (key.length < 20 || /\s/.test(key)) return fail(400, 'Ключ OpenAI выглядит неполным. Вставьте его целиком, без пробелов.');
    const check = await checkOpenAi(deps, key);
    if (!check.ok) return fail(400, check.error!);
    if (!await deps.db.set(OPENAI, key, { mask: maskKey(key), model, validated_at: deps.now() }, deps.userId)) return fail(500, 'Не удалось сохранить ключ. Повторите.');
    deps.forget();
    return ok({ mask: maskKey(key), model });
  }

  if (action === 'set_google') {
    const raw = String(body.json || '').trim();
    const sa = parseServiceAccount(raw);
    if (!sa) return fail(400, 'Это не файл сервисного аккаунта Google. Нужен JSON с полями client_email и private_key.');
    let token: string;
    try {
      token = await deps.googleToken(raw);
    } catch {
      return fail(400, 'Google не принял этот ключ. Создайте новый ключ у сервисного аккаунта и вставьте его целиком.');
    }
    const sheet = await checkSheet(deps, token);
    if (!await deps.db.set(GOOGLE, raw, { email: sa.email, project: sa.project, validated_at: deps.now() }, deps.userId)) return fail(500, 'Не удалось сохранить ключ. Повторите.');
    deps.forget();
    return ok({ email: sa.email, project: sa.project, ...sheet });
  }

  if (action === 'test') {
    const provider = String(body.provider || '');
    if (provider === 'openai') {
      const key = await deps.db.get(OPENAI);
      if (!key) return fail(404, 'Ключ OpenAI задан только в окружении сервера, проверить его отсюда нельзя.');
      const check = await checkOpenAi(deps, key);
      return check.ok ? ok({ valid: true }) : fail(400, check.error!);
    }
    if (provider === 'google') {
      const raw = await deps.db.get(GOOGLE);
      if (!raw) return fail(404, 'Аккаунт Google задан только в окружении сервера, проверить его отсюда нельзя.');
      try {
        return ok({ valid: true, ...(await checkSheet(deps, await deps.googleToken(raw))) });
      } catch {
        return fail(400, 'Google не принял сохранённый ключ. Загрузите новый.');
      }
    }
    return fail(400, 'Неизвестная интеграция.');
  }

  if (action === 'link_sheet') {
    const cabinetId = String(body.cabinet_id || '');
    const sheetId = extractSheetId(String(body.sheet || ''));
    const tab = String(body.tab || 'Раздачи').trim().slice(0, 80) || 'Раздачи';
    if (!cabinetId) return fail(400, 'Выберите кабинет.');
    if (!sheetId) return fail(400, 'Не вижу ссылку на таблицу Google. Вставьте адрес из браузера или её идентификатор.');
    const cabinets = await deps.db.cabinets();
    if (!cabinets.some((c) => c.id === cabinetId)) return fail(404, 'Кабинет не найден.');
    const links = await deps.db.links();
    if (links.some((l) => l.sheet_id === sheetId && l.cabinet_id !== cabinetId)) return fail(409, 'Эта таблица уже привязана к другому кабинету.');
    const raw = await deps.db.get(GOOGLE);
    if (!raw) return fail(400, 'Сначала подключите Google-аккаунт для таблиц.');
    let token: string;
    try { token = await deps.googleToken(raw); } catch { return fail(400, 'Google не принял сохранённый ключ. Загрузите новый.'); }
    const email = parseServiceAccount(raw)?.email || 'сервисного аккаунта';
    const check = await deps.checkSheetTab(token, sheetId, tab);
    if (!check.ok) return fail(400, `Таблица недоступна. Откройте доступ к ней для адреса ${email} и повторите.`);
    if (!check.hasTab) return fail(400, `В таблице нет листа «${tab}». Есть: ${(check.tabs || []).slice(0, 8).join(', ') || 'пусто'}.`);
    if (!check.header) return fail(400, `На листе «${tab}» не найдена шапка (ТОВАР, Ссылка ТГ, Дата заказа).`);
    if (!await deps.db.linkSheet(cabinetId, sheetId, tab)) return fail(500, 'Не удалось сохранить привязку. Повторите.');
    return ok({ title: check.title, rows: check.rows ?? 0 });
  }

  if (action === 'unlink_sheet') {
    const cabinetId = String(body.cabinet_id || '');
    if (!cabinetId) return fail(400, 'Выберите кабинет.');
    if (!await deps.db.unlinkSheet(cabinetId)) return fail(500, 'Не удалось отвязать. Повторите.');
    return ok();
  }

  if (action === 'remove') {
    const key = body.provider === 'openai' ? OPENAI : body.provider === 'google' ? GOOGLE : '';
    if (!key) return fail(400, 'Неизвестная интеграция.');
    if (!await deps.db.remove(key)) return fail(500, 'Не удалось удалить. Повторите.');
    deps.forget();
    return ok();
  }

  return fail(400, 'Неизвестное действие.');
}
