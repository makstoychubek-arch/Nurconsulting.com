// Голос Карины: деловой, строгий, без лишней эмоции.
// Только текст. Озвучка отключена.

export const KARINA_NAME = 'Карина';

/** Подпись к сводной картинке FBS. */
export function karinaFbsCaption(opts: {
    prettyDate: string;
    totalQty: number;
    modelsCount: number;
    failedCabinets?: string[];
    /** строки вида «Baza: 12» или уже с ярлыком */
    cabinetLines?: string[];
}): string {
    const lines = [
        `<b>${KARINA_NAME}</b> · FBS-отчёт`,
        `Дата: ${opts.prettyDate}`,
    ];
    if (opts.cabinetLines?.length) {
        lines.push('Кабинеты:');
        for (const row of opts.cabinetLines) lines.push(`· ${row}`);
    }
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
    return `${KARINA_NAME} · детализация FBS (кабинет, баркод, размер, количество)`;
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
