/**
 * Нормализация и нечёткое сравнение фраз (опечатки, ё/е, сленг).
 * Паттерн из research: normalize → alias bank → Levenshtein на коротких токенах.
 */

export function normalizeBotText(raw: string): string {
  return String(raw || "")
    .replace(/@\w+/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`]/g, "")
    .replace(/[?.!,;:…]+/g, " ")
    .replace(/[^\p{L}\p{N}\s/_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Расстояние Левенштейна (ограничено по длине для скорости). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  if (Math.abs(al - bl) > 4) return Math.max(al, bl);
  const prev = new Array<number>(bl + 1);
  const cur = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
    }
    for (let j = 0; j <= bl; j++) prev[j] = cur[j]!;
  }
  return prev[bl]!;
}

/** Допуск опечаток: 1 для ≤4 символов, 2 для ≤10, 3 для длиннее. */
export function typoBudget(len: number): number {
  if (len <= 4) return 1;
  if (len <= 10) return 2;
  return 3;
}

export function fuzzyTokenEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) {
    const shorter = a.length < b.length ? a : b;
    if (shorter.length >= 4) return true;
  }
  return levenshtein(a, b) <= typoBudget(Math.min(a.length, b.length));
}

/** Первое слово / slash-команда похожа на один из aliases. */
export function fuzzyMatchCommand(
  token: string,
  aliases: readonly string[],
): string | null {
  const t = normalizeBotText(token).replace(/^\//, "");
  if (!t) return null;
  for (const alias of aliases) {
    const a = normalizeBotText(alias);
    if (fuzzyTokenEq(t, a)) return a;
  }
  return null;
}

/** Текст содержит фразу с допуском опечаток по ключевым словам. */
export function fuzzyIncludesAny(
  text: string,
  phrases: readonly string[],
): boolean {
  const n = normalizeBotText(text);
  if (!n) return false;
  for (const p of phrases) {
    const want = normalizeBotText(p);
    if (!want) continue;
    if (n.includes(want)) return true;
    // пословное: все значимые токены фразы есть рядом (fuzzy)
    const tokens = want.split(" ").filter((w) => w.length >= 3);
    if (tokens.length === 0) continue;
    const hay = n.split(" ");
    const ok = tokens.every((tok) =>
      hay.some((h) => fuzzyTokenEq(h, tok))
    );
    if (ok) return true;
  }
  return false;
}
