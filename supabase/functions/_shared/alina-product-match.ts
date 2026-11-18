const CABINET_ALIASES: Record<string, string[]> = {
  baza: ["baza", "база", "базы", "базу", "базе"],
  saai: [
    "saai",
    "сааи",
    "саи",
    "дуйшекеева",
    "дуйшокеева",
    "duishekeeva",
    "nely",
    "nelylook",
  ],
  zevina: [
    "zevina",
    "зевина",
    "зевину",
    "зевине",
    "уркунбаев",
    "urkunbaev",
    "ипуркунбаев",
  ],
  elium: [
    "elium",
    "элиум",
    "элиуме",
    "айзада",
    "аизада",
    "aizada",
    "уметалиева",
    "umetalieva",
    "уметалиев",
  ],
};

/** Убрать имена/алиасы кабинетов из текста (чтобы «элиум» не считался товаром). */
const CABINET_STRIP_EXTRAS = [
  "zevina\\s*1",
  "zevina\\s*2",
  "зевина\\s*1",
  "зевина\\s*2",
  "zevina1",
  "zevina2",
];

const CABINET_STRIP_RES: RegExp[] = [
  ...Object.values(CABINET_ALIASES).flat(),
  ...CABINET_STRIP_EXTRAS,
].map((raw) => {
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(^|[\\s,.:;!?«»\"'])(${escaped})(?=$|[\\s,.:;!?«»\"'])`,
    "gi",
  );
});

function stripCabinetAliases(text: string): string {
  let t = String(text || "");
  for (const re of CABINET_STRIP_RES) {
    // lastIndex на /g — сбрасываем на каждый проход
    re.lastIndex = 0;
    t = t.replace(re, "$1");
  }
  return t.replace(/\s+/g, " ").trim();
}

function normProduct(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Единый скоринг: query владельца ↔ vendorCode / название карточки.
 * Понимает «жл»=жилетка, темносиний, укороченный и т.п.
 */
export function scoreProductMatch(haystack: string, query: string): number {
  const vRaw = normProduct(haystack);
  const v = vRaw.replace(/ /g, '');
  const qRaw = normProduct(stripCabinetAliases(query));
  const q = qRaw.replace(/ /g, '');
  if (!v || !q) return 0;
  let score = 0;

  // qRe — что сказал человек; vRe — как может быть в vendorCode / названии
  const types: Array<[RegExp, RegExp, number]> = [
    [/жилетк?|жилет/, /(?:жилет|^жл(?=[а-я\-]|$)|(^|[^а-я])жл([^а-я]|$))/, 7],
    [/(^|[^а-я])жл([^а-я]|$)/, /(?:жилет|^жл|жл)/, 7],
    [/лапш|водолазк|гольф/, /лапш|водолазк|гольф/, 6],
    [/фонар/, /фонар/, 6],
    [/вырез|v\s*вырез|v\-вырез/, /вырез/, 6],
    [/блузк?/, /блуз/, 3],
    [/укороч|crop|кроп/, /укороч|crop|кроп|укороч\.?пидж/, 6],
    [/костюм/, /костюм|кост|двойка|костнов/, 4],
    [/костнов/, /костнов|костюм|жакет/, 5],
    [/двойк/, /двойк|костюм/, 5],
    [/пиджак|жакет|пидж/, /пиджак|жакет|пидж/, 4],
    [/бомбер/, /бомбер/, 6],
    [/кимоно/, /кимоно/, 6],
    [/плать/, /плать/, 5],
    [/(лиза|рыбк|парижанк)/, /(лиза|рыбк|парижанк)/, 5],
    [/рубашк/, /рубашк/, 5],
    [/клетк|полоск|елочк|ёлочк/, /клетк|полоск|елочк|ёлочк/, 4],
    [/куртк|фуфайк|ветровк/, /куртк|фуфайк|ветровк/, 5],
    [/брюч|брюк/, /брюч|брюк/, 3],
    [/юбк/, /юбк/, 5],
    [/кардиган/, /кардиган/, 6],
    [/свитер|свитшот|худи/, /свитер|свитшот|худи/, 5],
    [/топ(?![а-я])|майк/, /топ|майк/, 4],
    [/комбинезон|комбез/, /комбинезон|комбез/, 6],
    [/пальто|полупальто|тренч|плащ/, /пальто|полупальто|тренч|плащ/, 5],
    [/спорт|велюр|originals|sport\s*rich/, /спорт|велюр|originals|sport/, 4],
    [/оверсайз|oversiz/, /оверсайз|oversiz|over/, 4],
    [/поло(?![а-я])/, /поло/, 5],
    [/джинс/, /джинс/, 4],
  ];
  for (const [qRe, vRe, pts] of types) {
    if (qRe.test(qRaw) && vRe.test(vRaw)) score += pts;
  }

  const colors: Array<[RegExp, RegExp, number]> = [
    [/бел/, /бел/, 4],
    [/(черн|чёрн)/, /черн/, 4],
    [/беж|песочн|camel|кэмел/, /беж|песочн|camel|кэмел/, 4],
    [/коричнев|корич|шоколад|мокко|шоко|капучин|темншок|кофе/, /коричнев|корич|шоколад|мокко|шоко|капучин|темншок|кофе/, 4],
    [/графит|сер(ый|ая|ое|ые)?|светлосер/, /графит|сер|граф|светлосер/, 3],
    [/бордо|marsala|марсал/, /бордо|бардо|марсал/, 4],
    [/электрик/, /электрик/, 4],
    [/(темно\s*син|тёмно\s*син|темносин|тсинь?|тёмносин|т\-?син)/, /темносин|темно\s*син|тсин|темнсин|т\-?син/, 5],
    [/(^|[^а-я])син(ий|яя|ее|ю|им)?([^а-я]|$)/, /(син|тсин)/, 3],
    [/голуб/, /голуб/, 4],
    [/розов|пудр|фукци/, /розов|пудр|фукци/, 4],
    [/зелен|изумруд|ментол|хак+и|оливк|мятн|мята/, /зелен|изумруд|ментол|хак+и|оливк|мятн/, 4],
    [/желт|горчиц|лимон/, /желт|горчиц|лимон/, 4],
    [/фиолет|лилов|сирен/, /фиолет|лилов|сирен/, 4],
    [/айвори|кремов|молочн/, /айвори|кремов|молочн/, 4],
    [/красн|алый|scarlet|терракот|оранж|корал/, /красн|алый|терракот|оранж|корал/, 4],
    [/индиго|navy/, /индиго|navy|темносин/, 4],
  ];
  let colorAsked = false;
  let colorHit = false;
  for (const [qRe, vRe, pts] of colors) {
    if (!qRe.test(qRaw)) continue;
    colorAsked = true;
    if (vRe.test(vRaw)) {
      score += pts;
      colorHit = true;
    }
  }
  if (colorAsked && !colorHit) score -= 3;

  const qTokens = qRaw.split(' ').filter((t) => t.length >= 3);
  const vTokens = new Set(vRaw.split(' ').filter((t) => t.length >= 3));
  for (const t of qTokens) {
    if (v.includes(t) || [...vTokens].some((vt) => vt.includes(t) || t.includes(vt))) {
      score += 1;
    }
  }

  const nm = qRaw.match(/\b(\d{6,12})\b/);
  if (nm && (v.includes(nm[1]) || haystack.includes(nm[1]))) score += 20;

  return score;
}
