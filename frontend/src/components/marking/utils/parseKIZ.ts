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
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const kizRegex = /01\d{14}21[\w\d]{6,}[\dA-Z]{4,}/g;
  return text.match(kizRegex) || [];
}

export function extractGTIN(kiz: string): string {
  const match = kiz.match(/^01(\d{14})/);
  return match ? match[1] : '';
}
