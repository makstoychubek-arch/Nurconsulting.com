export async function parseKIZFromFile(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCSV(file);
  if (name.endsWith('.pdf')) return parsePDF(file);
  throw new Error('Неподдерживаемый формат. Загрузите CSV или PDF.');
}

async function parseCSV(file: File): Promise<string[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const kizList: string[] = [];

  for (const line of lines) {
    const cols = line.split(/[,;\t]/);
    for (const col of cols) {
      const val = col.trim().replace(/"/g, '');
      if (val.startsWith('01') && val.length > 25) {
        kizList.push(val);
      }
    }
  }
  return kizList;
}

async function parsePDF(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const textDecoded = new TextDecoder('latin1').decode(bytes);
  const kizRegex = /01\d{14}21[\w\d!"%&'()*+,\-./:;<=>?]{6,}/g;
  const fromText = textDecoded.match(kizRegex) || [];

  if (fromText.length > 0) {
    console.log(`PDF текстовый слой: найдено ${fromText.length} КИЗ`);
    return fromText;
  }

  const kizList: string[] = [];
  const asciiStr = Array.from(bytes)
    .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ' '))
    .join('');

  const matches = asciiStr.match(/01\d{14}21[^\s]{6,50}/g) || [];
  kizList.push(...matches);

  if (kizList.length === 0) {
    throw new Error(
      'КИЗ не найдены в PDF. Возможные причины:\n' +
        '• PDF является сканом (изображением) — текстовый слой отсутствует\n' +
        '• Попробуйте экспортировать данные в CSV формат из системы Честный Знак\n' +
        '• Или используйте файл из личного кабинета "Текшер" в формате .csv',
    );
  }

  return kizList;
}

export function extractGTIN(kiz: string): string {
  const match = kiz.match(/^01(\d{14})/);
  return match ? match[1] : '';
}
