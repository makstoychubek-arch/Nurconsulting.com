import { r as m, j as e } from "./marking-main-C-kiqiJq.js";
async function T(t) {
  const a = t.name.toLowerCase();
  if (a.endsWith(".csv")) return P(t);
  if (a.endsWith(".pdf")) return A(t);
  throw new Error("Неподдерживаемый формат. Загрузите CSV или PDF.");
}
async function P(t) {
  const n = (await t.text()).split(/\r?\n/).filter(Boolean), c = [];
  for (const r of n) {
    const i = r.split(/[,;\t]/);
    for (const o of i) {
      const d = o.trim().replace(/"/g, "");
      d.startsWith("01") && d.length > 25 && c.push(d);
    }
  }
  return c;
}
async function A(t) {
  const a = await t.arrayBuffer(), n = new Uint8Array(a), c = new TextDecoder("latin1").decode(n), r = /01\d{14}21[\w\d!"%&'()*+,\-./:;<=>?]{6,}/g, i = c.match(r) || [];
  if (i.length > 0)
    return console.log(`PDF текстовый слой: найдено ${i.length} КИЗ`), i;
  const o = [], u = Array.from(n).map((w) => w >= 32 && w < 127 ? String.fromCharCode(w) : " ").join("").match(/01\d{14}21[^\s]{6,50}/g) || [];
  if (o.push(...u), o.length === 0)
    throw new Error(
      `КИЗ не найдены в PDF. Возможные причины:
• PDF является сканом (изображением) — текстовый слой отсутствует
• Попробуйте экспортировать данные в CSV формат из системы Честный Знак
• Или используйте файл из личного кабинета "Текшер" в формате .csv`
    );
  return o;
}
function L(t) {
  const a = t.match(/^01(\d{14})/);
  return a ? a[1] : "";
}
const I = "wb_nomenclature";
function E() {
  try {
    const t = localStorage.getItem(I);
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}
function F(t) {
  localStorage.setItem(I, JSON.stringify(t));
}
async function O(t) {
  var r;
  const a = E();
  a.length === 0 && console.warn('Номенклатура пуста — синхронизируйте данные во вкладке "Номенклатура"');
  const n = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
  for (const i of a)
    for (const o of i.sizes) {
      const d = (r = o.barcode) == null ? void 0 : r.trim();
      d && (n.set(d, { product: i, size: o }), d.length >= 12 && c.set(d.slice(0, 12), d));
    }
  return t.map((i) => {
    const o = L(i), d = {
      kiz: i,
      gtin: o
    };
    if (!o)
      return { ...d, barcode: "", article: "", name: "", color: "", size: "", matched: !1 };
    if (n.has(o)) {
      const l = n.get(o);
      return {
        ...d,
        barcode: o,
        article: l.product.article,
        name: `${l.product.brand} ${l.product.name}`,
        color: "",
        size: l.size.techSize,
        matched: !0
      };
    }
    const u = o.replace(/^0/, "");
    if (n.has(u)) {
      const l = n.get(u);
      return {
        ...d,
        barcode: u,
        article: l.product.article,
        name: `${l.product.brand} ${l.product.name}`,
        color: "",
        size: l.size.techSize,
        matched: !0
      };
    }
    const w = o.slice(1, 13), p = c.get(w);
    if (p) {
      const l = n.get(p);
      return {
        ...d,
        barcode: p,
        article: l.product.article,
        name: `${l.product.brand} ${l.product.name}`,
        color: "",
        size: l.size.techSize,
        matched: !0
      };
    }
    const b = u.slice(0, 12), h = c.get(b);
    if (h) {
      const l = n.get(h);
      return {
        ...d,
        barcode: h,
        article: l.product.article,
        name: `${l.product.brand} ${l.product.name}`,
        color: "",
        size: l.size.techSize,
        matched: !0
      };
    }
    return { ...d, barcode: "", article: "", name: "", color: "", size: "", matched: !1 };
  });
}
function $(t) {
  return {
    nmId: t.nmID,
    article: t.vendorCode || "",
    name: t.title || "",
    brand: t.brand || "",
    sizes: (t.sizes || []).map((a) => ({
      barcode: (a.skus || [])[0] || "",
      techSize: a.techSize || "",
      wbSize: a.wbSize || ""
    }))
  };
}
async function M() {
  var c;
  const t = localStorage.getItem("wb_token_content") || "";
  if (!t) throw new Error('Токен не задан. Зайдите во вкладку "Настройки и Логи".');
  const a = [];
  let n = {};
  for (; ; ) {
    const r = {
      settings: {
        cursor: { limit: 100 },
        filter: { withPhoto: -1 }
      }
    };
    n.nmID && (r.settings.cursor.nmID = n.nmID, r.settings.cursor.updatedAt = n.updatedAt);
    const i = await fetch("https://content-api.wildberries.ru/content/v2/get/cards/list", {
      method: "POST",
      headers: {
        Authorization: t,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(r)
    });
    if (!i.ok) {
      const u = await i.text();
      throw new Error(`WB API ${i.status}: ${u}`);
    }
    const o = await i.json(), d = o.cards || [];
    if (d.length === 0) break;
    if (d.forEach((u) => a.push($(u))), (c = o.cursor) != null && c.nmID)
      n = { nmID: o.cursor.nmID, updatedAt: o.cursor.updatedAt };
    else
      break;
    if (a.length > 1e4) break;
  }
  return a;
}
async function W(t) {
  var c;
  const a = [];
  let n = {};
  for (; ; ) {
    const r = await t("content_cards", {
      limit: 100,
      withPhoto: -1,
      cursorNmId: n.nmID,
      cursorUpdatedAt: n.updatedAt
    });
    if (!r) throw new Error("Не удалось загрузить номенклатуру. Проверьте кабинет и токен WB.");
    const i = r.cards || [];
    if (!i.length) break;
    if (i.forEach((o) => a.push($(o))), (c = r.cursor) != null && c.nmID)
      n = { nmID: r.cursor.nmID, updatedAt: r.cursor.updatedAt };
    else
      break;
    if (a.length > 1e4) break;
  }
  return a;
}
async function _() {
  const t = window.callWbProxy, a = t ? await W(t) : await M();
  return F(a), a;
}
function B() {
  return typeof window.callWbProxy == "function";
}
function R() {
  const [t, a] = m.useState([]), [n, c] = m.useState(!1), [r, i] = m.useState(""), [o, d] = m.useState(""), [u, w] = m.useState(/* @__PURE__ */ new Set());
  m.useEffect(() => {
    a(E());
  }, []);
  const p = async () => {
    c(!0);
    try {
      const s = await _();
      a(s), alert(`✅ Синхронизировано ${s.length} товаров`);
    } catch (s) {
      alert(`❌ ${s.message}`);
    } finally {
      c(!1);
    }
  }, b = m.useMemo(() => [...new Set(t.map((s) => s.brand).filter(Boolean))].sort(), [t]), h = m.useMemo(
    () => t.filter((s) => {
      const x = r.toLowerCase(), f = !x || s.article.toLowerCase().includes(x) || s.name.toLowerCase().includes(x) || s.sizes.some((N) => N.barcode.includes(x)), j = !o || s.brand === o;
      return f && j;
    }),
    [t, r, o]
  ), l = (s) => w((x) => {
    const f = new Set(x);
    return f.has(s) ? f.delete(s) : f.add(s), f;
  }), g = (s) => {
    localStorage.setItem("selected_barcode", s), document.dispatchEvent(new CustomEvent("switch-tab", { detail: "print" }));
  };
  return /* @__PURE__ */ e.jsxs("div", { className: "space-y-4 max-w-4xl", children: [
    /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [
      /* @__PURE__ */ e.jsx(
        "input",
        {
          value: r,
          onChange: (s) => i(s.target.value),
          placeholder: "Поиск по артикулу, баркоду, названию...",
          className: "flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50 transition-colors"
        }
      ),
      /* @__PURE__ */ e.jsxs(
        "select",
        {
          value: o,
          onChange: (s) => d(s.target.value),
          className: "bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white outline-none focus:border-purple-500/50 transition-colors",
          children: [
            /* @__PURE__ */ e.jsx("option", { value: "", children: "Все бренды" }),
            b.map((s) => /* @__PURE__ */ e.jsx("option", { value: s, children: s }, s))
          ]
        }
      ),
      /* @__PURE__ */ e.jsx(
        "button",
        {
          type: "button",
          onClick: p,
          disabled: n,
          className: "px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap",
          children: n ? "⏳ Синхронизация..." : "🔄 Синхронизировать с WB"
        }
      )
    ] }),
    /* @__PURE__ */ e.jsxs("p", { className: "text-sm text-white/40", children: [
      "Найдено: ",
      h.length,
      " товаров",
      t.length > 0 && ` из ${t.length}`
    ] }),
    /* @__PURE__ */ e.jsxs("div", { className: "space-y-2", children: [
      h.map((s) => /* @__PURE__ */ e.jsxs("div", { className: "border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02]", children: [
        /* @__PURE__ */ e.jsxs(
          "button",
          {
            type: "button",
            onClick: () => l(s.nmId),
            className: "w-full flex items-center gap-4 px-5 py-4 min-h-[44px] text-left hover:bg-white/[0.03] transition-colors duration-150",
            children: [
              /* @__PURE__ */ e.jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ e.jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
                  /* @__PURE__ */ e.jsx("span", { className: "font-medium text-white text-sm", children: s.name }),
                  /* @__PURE__ */ e.jsx("span", { className: "text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300", children: s.brand })
                ] }),
                /* @__PURE__ */ e.jsxs("div", { className: "text-xs text-white/40 mt-0.5", children: [
                  "Арт: ",
                  s.article,
                  " · ",
                  s.sizes.length,
                  " размеров"
                ] })
              ] }),
              /* @__PURE__ */ e.jsx("span", { className: `text-white/30 transition-transform duration-200 ${u.has(s.nmId) ? "rotate-180" : ""}`, children: "▼" })
            ]
          }
        ),
        u.has(s.nmId) && /* @__PURE__ */ e.jsx("div", { className: "border-t border-white/5 overflow-x-auto", children: /* @__PURE__ */ e.jsxs("table", { className: "w-full text-xs", children: [
          /* @__PURE__ */ e.jsx("thead", { children: /* @__PURE__ */ e.jsxs("tr", { className: "border-b border-white/5", children: [
            /* @__PURE__ */ e.jsx("th", { className: "text-left px-5 py-2.5 text-white/40 font-medium", children: "Размер" }),
            /* @__PURE__ */ e.jsx("th", { className: "text-left px-5 py-2.5 text-white/40 font-medium", children: "WB-размер" }),
            /* @__PURE__ */ e.jsx("th", { className: "text-left px-5 py-2.5 text-white/40 font-medium", children: "Баркод" })
          ] }) }),
          /* @__PURE__ */ e.jsx("tbody", { children: s.sizes.map((x, f) => /* @__PURE__ */ e.jsxs("tr", { className: "border-b border-white/[0.03] hover:bg-white/[0.02]", children: [
            /* @__PURE__ */ e.jsx("td", { className: "px-5 py-2.5 text-white", children: x.techSize }),
            /* @__PURE__ */ e.jsx("td", { className: "px-5 py-2.5 text-white/60", children: x.wbSize }),
            /* @__PURE__ */ e.jsx("td", { className: "px-5 py-2.5", children: /* @__PURE__ */ e.jsx(
              "button",
              {
                type: "button",
                onClick: () => g(x.barcode),
                className: "font-mono text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors",
                children: x.barcode
              }
            ) })
          ] }, f)) })
        ] }) })
      ] }, s.nmId)),
      h.length === 0 && /* @__PURE__ */ e.jsx("div", { className: "text-center py-16 text-white/30", children: t.length === 0 ? "📦 Нажмите «Синхронизировать с WB» чтобы загрузить номенклатуру" : "🔍 Ничего не найдено" })
    ] })
  ] });
}
function J({ record: t }) {
  const a = m.useRef(null), n = m.useRef(null);
  return m.useEffect(() => {
    let c = !1;
    return (async () => {
      const r = await import("./bwip-js-DyQIRboM.js");
      if (!c) {
        if (a.current && t.barcode)
          try {
            await r.default.toCanvas(a.current, {
              bcid: "ean13",
              text: t.barcode,
              scale: 2,
              height: 8,
              includetext: !0
            });
          } catch (i) {
            console.warn("EAN render:", i);
          }
        if (n.current && t.kiz)
          try {
            await r.default.toCanvas(n.current, {
              bcid: "datamatrix",
              text: t.kiz.slice(0, 50),
              scale: 3
            });
          } catch (i) {
            console.warn("DM render:", i);
          }
      }
    })(), () => {
      c = !0;
    };
  }, [t]), /* @__PURE__ */ e.jsxs("div", { className: "marking-label border border-white/10 rounded-xl p-3 bg-white print:bg-white print:border-black print:break-after-page print:rounded-none", children: [
    /* @__PURE__ */ e.jsx("p", { className: "text-[9px] text-black font-medium leading-tight mb-1 truncate", children: t.name }),
    /* @__PURE__ */ e.jsxs("p", { className: "text-[8px] text-gray-600 mb-2", children: [
      "Арт: ",
      t.article,
      " · Р: ",
      t.size
    ] }),
    /* @__PURE__ */ e.jsxs("div", { className: "flex gap-2 items-center", children: [
      /* @__PURE__ */ e.jsx("canvas", { ref: a, className: "max-w-[120px]" }),
      /* @__PURE__ */ e.jsx("canvas", { ref: n, className: "w-12 h-12" })
    ] }),
    /* @__PURE__ */ e.jsxs("p", { className: "text-[6px] text-gray-400 mt-1 break-all", children: [
      t.kiz.slice(0, 32),
      "…"
    ] })
  ] });
}
function U(t, a) {
  return t.length > a ? `${t.slice(0, a - 1)}…` : t;
}
function V() {
  try {
    return JSON.parse(localStorage.getItem("label_template") || "{}");
  } catch {
    return {};
  }
}
async function G(t) {
  const [{ jsPDF: a }, n] = await Promise.all([import("./jspdf.es.min-bo7Ri0Hj.js").then((b) => b.j), import("./bwip-js-DyQIRboM.js")]), c = t.filter((b) => b.matched);
  if (!c.length) return;
  const r = V(), i = r.width || 58, o = r.height || 40, d = r.showText !== !1, u = r.showEAN !== !1 && !r.dmOnly, w = r.showDM !== !1 || r.dmOnly, p = new a({
    orientation: i > o ? "landscape" : "portrait",
    unit: "mm",
    format: [i, o]
  });
  for (let b = 0; b < c.length; b++) {
    const h = c[b];
    if (b > 0 && p.addPage([i, o], i > o ? "landscape" : "portrait"), d && (p.setFontSize(6), p.setTextColor(0, 0, 0), p.text(U(h.name, 40), 2, 5), p.text(`Арт: ${h.article}  Р: ${h.size}`, 2, 9)), u)
      try {
        const l = document.createElement("canvas");
        n.default.toCanvas(l, {
          bcid: "ean13",
          text: h.barcode,
          scale: 2,
          height: 8,
          includetext: !0,
          textxalign: "center"
        }), p.addImage(l.toDataURL("image/png"), "PNG", 2, 11, 35, 14);
      } catch {
        p.text(h.barcode, 2, 18);
      }
    if (w)
      try {
        const l = document.createElement("canvas");
        n.default.toCanvas(l, {
          bcid: "datamatrix",
          text: h.kiz,
          scale: 3
        }), p.addImage(l.toDataURL("image/png"), "PNG", 38, 11, 18, 18);
      } catch {
        p.setFontSize(4), p.text("DataMatrix", 38, 20);
      }
    p.setFontSize(4), p.setTextColor(100, 100, 100), p.text(h.kiz.slice(0, 40), 2, o - 2);
  }
  p.save(`markings_${Date.now()}.pdf`);
}
const y = "marking_logs";
function K(t) {
  try {
    const a = localStorage.getItem(y), n = a ? JSON.parse(a) : [];
    n.unshift({ ts: Date.now(), ...t }), localStorage.setItem(y, JSON.stringify(n.slice(0, 50)));
  } catch {
  }
}
function D() {
  try {
    const t = localStorage.getItem(y);
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}
function Z() {
  localStorage.removeItem(y);
}
function q() {
  const [t, a] = m.useState([]), [n, c] = m.useState(!1), [r, i] = m.useState([]), [o, d] = m.useState(!1), u = m.useRef(null), w = async (s) => {
    c(!0), i([]);
    try {
      const x = await T(s);
      if (!x.length) throw new Error("КИЗ не найдены в файле.");
      const f = [...new Set(x)], j = x.length - f.length, N = [];
      j > 0 && N.push(`⚠️ Удалено дублей: ${j}`);
      const v = await O(f), S = v.filter((k) => !k.matched).length;
      S > 0 && N.push(`⚠️ Не найдено в номенклатуре: ${S} кодов`), i(N), a(v), K({
        total: v.length,
        matched: v.filter((k) => k.matched).length,
        duplicates: j,
        errors: S
      });
    } catch (x) {
      i([`❌ Ошибка обработки: ${x.message}`]);
    } finally {
      c(!1);
    }
  }, p = m.useCallback(async (s) => {
    s.preventDefault(), d(!1);
    const x = s.dataTransfer.files[0];
    x && await w(x);
  }, []), b = async (s) => {
    var f;
    const x = (f = s.target.files) == null ? void 0 : f[0];
    x && await w(x);
  }, h = () => window.print(), l = async () => {
    c(!0);
    try {
      await G(t);
    } finally {
      c(!1);
    }
  }, g = t.filter((s) => s.matched).length;
  return /* @__PURE__ */ e.jsxs("div", { className: "space-y-6 max-w-5xl", children: [
    /* @__PURE__ */ e.jsxs(
      "div",
      {
        onDrop: p,
        onDragOver: (s) => {
          s.preventDefault(), d(!0);
        },
        onDragLeave: () => d(!1),
        onClick: () => {
          var s;
          return (s = u.current) == null ? void 0 : s.click();
        },
        className: `border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${o ? "border-purple-500 bg-purple-500/10" : "border-white/10 hover:border-white/20 bg-white/[0.02]"}`,
        children: [
          /* @__PURE__ */ e.jsx("input", { ref: u, type: "file", accept: ".csv,.pdf", className: "hidden", onChange: b }),
          /* @__PURE__ */ e.jsx("div", { className: "text-4xl mb-3", children: "📂" }),
          /* @__PURE__ */ e.jsx("p", { className: "text-white font-medium", children: "Перетащите CSV или PDF с КИЗ сюда" }),
          /* @__PURE__ */ e.jsx("p", { className: "text-white/40 text-sm mt-1", children: 'Поддерживаются файлы выгрузки Честного Знака "Текшер"' }),
          n && /* @__PURE__ */ e.jsxs("div", { className: "mt-4 flex items-center justify-center gap-2 text-purple-400", children: [
            /* @__PURE__ */ e.jsx("div", { className: "w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" }),
            /* @__PURE__ */ e.jsx("span", { className: "text-sm", children: "Обработка файла..." })
          ] })
        ]
      }
    ),
    r.length > 0 && /* @__PURE__ */ e.jsx("div", { className: "rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1", children: r.map((s, x) => /* @__PURE__ */ e.jsx("p", { className: "text-sm text-amber-400", children: s }, x)) }),
    t.length > 0 && /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [
      /* @__PURE__ */ e.jsxs("div", { className: "flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-4", children: [
        /* @__PURE__ */ e.jsx("div", { className: "text-2xl font-bold text-white", children: t.length }),
        /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 mt-1", children: "Всего КИЗ" })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex-1 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4", children: [
        /* @__PURE__ */ e.jsx("div", { className: "text-2xl font-bold text-purple-300", children: g }),
        /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 mt-1", children: "Сопоставлено" })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-4", children: [
        /* @__PURE__ */ e.jsx("div", { className: "text-2xl font-bold text-white/70", children: t.length - g }),
        /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 mt-1", children: "Не найдено" })
      ] })
    ] }),
    g > 0 && /* @__PURE__ */ e.jsxs("div", { className: "flex flex-wrap gap-3", children: [
      /* @__PURE__ */ e.jsx(
        "button",
        {
          type: "button",
          onClick: h,
          className: "flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-semibold transition-colors duration-200",
          children: "🖨️ Массовая печать"
        }
      ),
      /* @__PURE__ */ e.jsx(
        "button",
        {
          type: "button",
          onClick: l,
          disabled: n,
          className: "flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] text-white text-sm font-medium transition-colors duration-200 disabled:opacity-50",
          children: "📥 Скачать PDF-ленту"
        }
      )
    ] }),
    t.length > 0 && /* @__PURE__ */ e.jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 print:grid-cols-1", children: t.filter((s) => s.matched).map((s, x) => /* @__PURE__ */ e.jsx(J, { record: s }, `${s.kiz}-${x}`)) })
  ] });
}
function Y() {
  const [t, a] = m.useState(""), [n, c] = m.useState(""), [r, i] = m.useState(""), [o, d] = m.useState(D()), u = B();
  m.useEffect(() => {
    a(localStorage.getItem("wb_token_content") || ""), c(localStorage.getItem("wb_token_marketplace") || ""), d(D());
  }, []);
  const w = () => {
    localStorage.setItem("wb_token_content", t.trim()), localStorage.setItem("wb_token_marketplace", n.trim()), i("✅ Токены сохранены"), setTimeout(() => i(""), 3e3);
  }, p = async (h, l) => {
    i("⏳ Проверка соединения...");
    try {
      const s = await fetch(l === "content" ? "https://content-api.wildberries.ru/content/v2/get/cards/list?limit=1" : "https://marketplace-api.wildberries.ru/api/v3/supplies?limit=1", { headers: { Authorization: h.trim() } });
      i(s.ok ? "✅ Подключение успешно!" : `❌ Ошибка ${s.status}: ${s.statusText}`);
    } catch (g) {
      i(`❌ Сетевая ошибка: ${g.message}`);
    }
    setTimeout(() => i(""), 5e3);
  }, b = () => {
    Z(), d([]);
  };
  return /* @__PURE__ */ e.jsxs("div", { className: "space-y-8 max-w-2xl", children: [
    u ? /* @__PURE__ */ e.jsx("div", { className: "rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-sm text-white/70", children: "NR Space использует защищённый WB Proxy с токеном выбранного кабинета. Ручные токены нужны только при автономном запуске модуля." }) : /* @__PURE__ */ e.jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest", children: "Токены WB API" }),
      [
        {
          label: "Токен «Контент» (для номенклатуры)",
          key: "content",
          val: t,
          set: a
        },
        {
          label: "Токен «Маркетплейс» (для поставок)",
          key: "marketplace",
          val: n,
          set: c
        }
      ].map(({ label: h, key: l, val: g, set: s }) => /* @__PURE__ */ e.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ e.jsx("div", { className: "text-sm text-white/60", children: h }),
        /* @__PURE__ */ e.jsxs("div", { className: "flex flex-col sm:flex-row gap-2", children: [
          /* @__PURE__ */ e.jsx(
            "input",
            {
              type: "password",
              value: g,
              onChange: (x) => s(x.target.value),
              placeholder: "eyJhbGciOiJFUzI1NiIs...",
              className: "flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white font-mono placeholder-white/20 outline-none focus:border-purple-500/50 transition-colors"
            }
          ),
          /* @__PURE__ */ e.jsx(
            "button",
            {
              type: "button",
              onClick: () => p(g, l),
              className: "px-4 py-2.5 min-h-[44px] rounded-xl border border-white/10 text-white/60 hover:border-white/20 hover:text-white text-sm transition-colors whitespace-nowrap",
              children: "Проверить"
            }
          )
        ] })
      ] }, l)),
      /* @__PURE__ */ e.jsx(
        "button",
        {
          type: "button",
          onClick: w,
          className: "px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors",
          children: "💾 Сохранить токены"
        }
      )
    ] }),
    r && /* @__PURE__ */ e.jsx(
      "p",
      {
        className: `text-sm ${r.startsWith("✅") ? "text-green-400" : r.startsWith("❌") ? "text-red-400" : "text-white/60"}`,
        children: r
      }
    ),
    /* @__PURE__ */ e.jsxs("div", { children: [
      /* @__PURE__ */ e.jsxs("div", { className: "flex items-center justify-between mb-3", children: [
        /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest", children: "Лог сессий" }),
        o.length > 0 && /* @__PURE__ */ e.jsx(
          "button",
          {
            type: "button",
            onClick: b,
            className: "text-xs text-white/30 hover:text-white/60 transition-colors min-h-[44px] px-2",
            children: "Очистить"
          }
        )
      ] }),
      o.length === 0 ? /* @__PURE__ */ e.jsx("p", { className: "text-sm text-white/30 py-6 text-center", children: "Сессий ещё не было" }) : /* @__PURE__ */ e.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ e.jsxs("table", { className: "w-full text-xs", children: [
        /* @__PURE__ */ e.jsx("thead", { children: /* @__PURE__ */ e.jsx("tr", { className: "border-b border-white/5", children: ["Дата/Время", "Всего КИЗ", "Сопоставлено", "Дублей", "Ошибок"].map((h) => /* @__PURE__ */ e.jsx("th", { className: "text-left px-4 py-2.5 text-white/40 font-medium", children: h }, h)) }) }),
        /* @__PURE__ */ e.jsx("tbody", { children: o.map((h, l) => /* @__PURE__ */ e.jsxs("tr", { className: "border-b border-white/[0.03]", children: [
          /* @__PURE__ */ e.jsx("td", { className: "px-4 py-2.5 text-white/60", children: new Date(h.ts).toLocaleString("ru-RU") }),
          /* @__PURE__ */ e.jsx("td", { className: "px-4 py-2.5 text-white", children: h.total }),
          /* @__PURE__ */ e.jsx("td", { className: "px-4 py-2.5 text-purple-300", children: h.matched }),
          /* @__PURE__ */ e.jsx("td", { className: "px-4 py-2.5 text-amber-400", children: h.duplicates }),
          /* @__PURE__ */ e.jsx("td", { className: "px-4 py-2.5 text-white/50", children: h.errors })
        ] }, l)) })
      ] }) })
    ] })
  ] });
}
const C = {
  name: "Объединённая 58×40",
  width: 58,
  height: 40,
  showText: !0,
  showEAN: !0,
  showDM: !0,
  dmOnly: !1,
  dmExtra: !1
}, H = [
  { label: "58×40 мм (стандарт)", w: 58, h: 40 },
  { label: "70×50 мм (увеличенный)", w: 70, h: 50 },
  { label: "40×25 мм (мини)", w: 40, h: 25 }
];
function Q() {
  const [t, a] = m.useState(C);
  m.useEffect(() => {
    const r = localStorage.getItem("label_template");
    if (r)
      try {
        a({ ...C, ...JSON.parse(r) });
      } catch {
      }
  }, []);
  const n = () => {
    localStorage.setItem("label_template", JSON.stringify(t)), alert("Шаблон сохранён");
  }, c = [
    ["showText", "Текст товара (название, артикул, размер)"],
    ["showEAN", "Штрихкод EAN-13 (баркод WB)"],
    ["showDM", "DataMatrix Честного Знака"],
    ["dmOnly", "Только Честный Знак (без ШК и текста)"],
    ["dmExtra", "ЧЗ на отдельной наклейке следом"]
  ];
  return /* @__PURE__ */ e.jsxs("div", { className: "space-y-6 max-w-2xl", children: [
    /* @__PURE__ */ e.jsxs("div", { children: [
      /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest mb-3", children: "Размер ленты" }),
      /* @__PURE__ */ e.jsx("div", { className: "flex flex-wrap gap-2", children: H.map((r) => /* @__PURE__ */ e.jsx(
        "button",
        {
          type: "button",
          onClick: () => a((i) => ({ ...i, width: r.w, height: r.h })),
          className: `px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${t.width === r.w && t.height === r.h ? "bg-purple-600 border-purple-500 text-white" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"}`,
          children: r.label
        },
        r.label
      )) })
    ] }),
    /* @__PURE__ */ e.jsxs("div", { children: [
      /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest mb-3", children: "Состав этикетки" }),
      /* @__PURE__ */ e.jsx("div", { className: "space-y-3", children: c.map(([r, i]) => /* @__PURE__ */ e.jsxs("label", { className: "flex items-center gap-3 cursor-pointer group min-h-[44px]", children: [
        /* @__PURE__ */ e.jsx(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": !!t[r],
            onClick: () => a((o) => ({ ...o, [r]: !o[r] })),
            className: `w-11 h-6 rounded-full border transition-colors duration-200 flex-shrink-0 ${t[r] ? "bg-purple-600 border-purple-500" : "bg-white/5 border-white/10"}`,
            children: /* @__PURE__ */ e.jsx(
              "span",
              {
                className: `block w-4 h-4 rounded-full bg-white mt-0.5 transition-transform duration-200 ${t[r] ? "translate-x-6" : "translate-x-0.5"}`
              }
            )
          }
        ),
        /* @__PURE__ */ e.jsx("span", { className: "text-sm text-white/70 group-hover:text-white transition-colors", children: i })
      ] }, r)) })
    ] }),
    /* @__PURE__ */ e.jsxs("div", { children: [
      /* @__PURE__ */ e.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest mb-3", children: "Схема этикетки" }),
      /* @__PURE__ */ e.jsxs(
        "div",
        {
          className: "border border-white/10 rounded-xl bg-white/[0.02] p-3 relative max-w-full",
          style: { width: `${Math.min(t.width * 3, 280)}px`, height: `${t.height * 3}px` },
          children: [
            t.showText && /* @__PURE__ */ e.jsx("div", { className: "absolute top-2 left-2 right-2 h-6 rounded bg-white/10 flex items-center px-2", children: /* @__PURE__ */ e.jsx("span", { className: "text-[8px] text-white/40", children: "Название / Артикул / Размер" }) }),
            t.showEAN && !t.dmOnly && /* @__PURE__ */ e.jsx("div", { className: "absolute top-10 left-2 w-3/5 h-10 rounded bg-white/10 flex items-center justify-center", children: /* @__PURE__ */ e.jsx("span", { className: "text-[8px] text-white/40", children: "EAN-13" }) }),
            (t.showDM || t.dmOnly) && !t.dmExtra && /* @__PURE__ */ e.jsx("div", { className: "absolute top-10 right-2 w-10 h-10 rounded bg-white/10 flex items-center justify-center", children: /* @__PURE__ */ e.jsx("span", { className: "text-[8px] text-white/40", children: "DM" }) })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ e.jsx(
      "button",
      {
        type: "button",
        onClick: n,
        className: "px-6 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors",
        children: "💾 Сохранить шаблон"
      }
    )
  ] });
}
const z = [
  { id: "print", label: "🖨️ Печать и Склейка" },
  { id: "nomen", label: "📦 Номенклатура" },
  { id: "tpl", label: "🎨 Конструктор шаблонов" },
  { id: "settings", label: "⚙️ Настройки и Логи" }
];
function ee() {
  const [t, a] = m.useState("print");
  return m.useEffect(() => {
    const n = (c) => {
      const r = c.detail;
      z.some((i) => i.id === r) && a(r);
    };
    return document.addEventListener("switch-tab", n), () => document.removeEventListener("switch-tab", n);
  }, []), /* @__PURE__ */ e.jsxs("div", { className: "marking-module min-h-[60vh] text-white", children: [
    /* @__PURE__ */ e.jsxs("div", { className: "border-b border-white/5 px-4 sm:px-6 py-5", children: [
      /* @__PURE__ */ e.jsx("h1", { className: "text-xl font-bold text-white", children: "Маркировка и Штрихкоды" }),
      /* @__PURE__ */ e.jsx("p", { className: "text-sm text-white/40 mt-1", children: "Zero-Storage — вся обработка в браузере, данные не хранятся на сервере" })
    ] }),
    /* @__PURE__ */ e.jsx("div", { className: "border-b border-white/5 px-4 sm:px-6", children: /* @__PURE__ */ e.jsx("div", { className: "flex gap-1 -mb-px overflow-x-auto", children: z.map((n) => /* @__PURE__ */ e.jsx(
      "button",
      {
        type: "button",
        onClick: () => a(n.id),
        className: `px-4 py-3 min-h-[44px] text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 ${t === n.id ? "border-purple-500 text-white" : "border-transparent text-white/40 hover:text-white/70"}`,
        children: n.label
      },
      n.id
    )) }) }),
    /* @__PURE__ */ e.jsxs("div", { className: "p-4 sm:p-6", children: [
      t === "print" && /* @__PURE__ */ e.jsx(q, {}),
      t === "nomen" && /* @__PURE__ */ e.jsx(R, {}),
      t === "tpl" && /* @__PURE__ */ e.jsx(Q, {}),
      t === "settings" && /* @__PURE__ */ e.jsx(Y, {})
    ] })
  ] });
}
export {
  ee as MarkingModule
};
