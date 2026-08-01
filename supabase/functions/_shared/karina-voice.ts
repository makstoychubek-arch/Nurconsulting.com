// Голос Карины: деловой, строгий, без лишней эмоции.
// Использовать во всех исходящих текстах от её имени.

export const KARINA_NAME = 'Карина';

/** Подпись к сводной картинке FBS. */
export function karinaFbsCaption(opts: {
    prettyDate: string;
    totalQty: number;
    modelsCount: number;
    failedCabinets?: string[];
}): string {
    const lines = [
        `<b>${KARINA_NAME}</b> · FBS-отчёт`,
        `Дата: ${opts.prettyDate}`,
    ];
    if (opts.totalQty > 0) {
        lines.push(`Итого: <b>${opts.totalQty} шт</b> · моделей: ${opts.modelsCount}`);
        lines.push('Детализация — в файле ниже.');
    } else {
        lines.push('Заказов за сутки нет.');
    }
    if (opts.failedCabinets?.length) {
        lines.push(
            `Внимание: нет данных по кабинету: ${opts.failedCabinets.join(', ')}.`,
            'Отчёт сформирован по доступным источникам.',
        );
    }
    return lines.join('\n');
}

export function karinaFbsDocumentCaption(): string {
    return `${KARINA_NAME} · детализация FBS (баркод, размер, количество)`;
}

export function karinaFbsTestMessage(): string {
    return [
        `<b>${KARINA_NAME}</b> · канал FBS подключён.`,
        'Ежедневно в 07:00 (Бишкек): сводка и Excel за предыдущие сутки.',
    ].join('\n');
}

export function karinaFbsImageTitle(prettyDate: string): string {
    return `FBS · ${prettyDate}`;
}

export function karinaFbsImageSubtitle(): string {
    return 'Сводка по моделям. Детали — в Excel.';
}

export function karinaFbsEmptyLine(): string {
    return 'Заказов за сутки нет';
}

/** Текст для озвучки (без HTML, деловой тон). */
export function karinaFbsVoiceScript(opts: {
    prettyDate: string;
    totalQty: number;
    modelsCount: number;
    topModels?: Array<{ name: string; qty: number }>;
}): string {
    const parts = [
        `${KARINA_NAME}. Отчёт FBS за ${opts.prettyDate}.`,
    ];
    if (opts.totalQty <= 0) {
        parts.push('Заказов за сутки нет.');
        return parts.join(' ');
    }
    parts.push(`Итого ${opts.totalQty} штук. Моделей ${opts.modelsCount}.`);
    const top = (opts.topModels || []).slice(0, 5);
    for (const m of top) {
        parts.push(`${m.name} — ${m.qty}.`);
    }
    if (opts.modelsCount > top.length) {
        parts.push('Полная детализация в файле Excel.');
    } else {
        parts.push('Детализация в файле Excel.');
    }
    return parts.join(' ');
}

export function karinaVoiceTestScript(): string {
    return (
        `${KARINA_NAME}. Тест голосового канала FBS. ` +
        'Ежедневно в семь утра по Бишкеку направляю сводку заказов и файл Excel. ' +
        'Связь в норме.'
    );
}

/** OpenAI TTS → Opus (для Telegram sendVoice). */
export async function synthesizeKarinaVoice(text: string): Promise<Uint8Array> {
    const apiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim();
    if (!apiKey) throw new Error('OPENAI_API_KEY не задан');

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini-tts',
            voice: 'coral',
            input: text.slice(0, 2000),
            response_format: 'opus',
            // строгий деловой тон
            instructions:
                'Speak Russian. Female voice. Businesslike, strict, calm, no enthusiasm, no smile in the voice. Clear diction, moderate pace.',
        }),
        signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
        // Фоллбек на tts-1, если mini-tts недоступен на ключе
        if (res.status === 400 || res.status === 404) {
            return await synthesizeKarinaVoiceLegacy(apiKey, text);
        }
        const err = await res.text();
        throw new Error(`OpenAI TTS HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    return new Uint8Array(await res.arrayBuffer());
}

async function synthesizeKarinaVoiceLegacy(apiKey: string, text: string): Promise<Uint8Array> {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'tts-1',
            voice: 'nova',
            input: text.slice(0, 2000),
            response_format: 'opus',
        }),
        signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI TTS legacy HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    return new Uint8Array(await res.arrayBuffer());
}
