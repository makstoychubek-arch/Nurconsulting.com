#!/usr/bin/env node
/**
 * Билд-пайплайн для статических страниц сайта (без фреймворка):
 *
 * 1. Компилирует Tailwind CSS на этапе билда (вместо cdn.tailwindcss.com,
 *    который компилирует стили в браузере пользователя при каждой загрузке).
 * 2. Минифицирует "голые" скрипты дашборда (dashboard-charts.js,
 *    rnp-module.js, wb-formulas.js, wb-clusters.js) через esbuild.
 * 3. Кладёт результат в /dist с именами, содержащими хэш содержимого
 *    (dashboard-charts.<hash>.min.js), и переписывает ссылки на них в
 *    dashboard.html/index.html/login.html — при изменении файла хэш
 *    меняется автоматически, ручной "?v=..." больше не нужен.
 *
 * Запускается через `npm run build` (см. package.json), на Vercel — как
 * buildCommand (см. vercel.json).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function hashOf(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);
}

function ensureDist() {
    fs.mkdirSync(DIST, { recursive: true });
}

function buildTailwind() {
    // Запускаем CLI напрямую через node (а не .bin/tailwindcss.cmd) — так
    // одинаково работает и на Windows, и на Linux-раннере Vercel, без
    // проблем с execFileSync/EINVAL на .cmd-обёртках.
    const cli = require.resolve('tailwindcss/lib/cli.js');
    const input = path.join(ROOT, 'src', 'tailwind-entry.css');
    const tmpOut = path.join(DIST, '_tailwind.tmp.css');
    execFileSync(process.execPath, [
        cli,
        '-c', path.join(ROOT, 'tailwind.config.build.js'),
        '-i', input,
        '-o', tmpOut,
        '--minify',
    ], { stdio: 'inherit', cwd: ROOT });
    const css = fs.readFileSync(tmpOut, 'utf8');
    const hash = hashOf(css);
    const finalName = `tailwind.${hash}.min.css`;
    fs.writeFileSync(path.join(DIST, finalName), css);
    fs.unlinkSync(tmpOut);
    console.log(`[build-assets] tailwind -> dist/${finalName} (${(css.length / 1024).toFixed(1)} KB)`);
    return finalName;
}

function buildScripts() {
    const esbuild = require('esbuild');
    const scripts = ['nr-win.js', 'dashboard-charts.js', 'rnp-module.js', 'rnp-selection.js', 'rnp-plan-fact.js', 'wb-formulas.js', 'evidence-report.js', 'ads-command-center.js', 'adv-shelves-ui.js', 'ads-pulse.js', 'goods-catalog.js', 'giveaways.js', 'goods-fbs.js', 'nr-xlsx.js', 'goods-supply.js', 'rnp-planning.js', 'giveaway-calc.js', 'content-factory.js', 'nr-wow.js', 'dash-cabinet-plans.js', 'nr-admin.js', 'ad-autopilot-ui.js', 'ads-campaign-detail.js', 'nr-skeleton.js', 'cabinets-hub.js', 'space-admin-ext.js', 'viewer-mode.js', 'nr-themes.js', 'ak-slides.js', 'nr-welcome.js', 'nr-next.js', 'nr-costs.js', 'nr-hints.js', 'fbs-rates.js', 'ff-terms.js', 'nr-ff.js', 'nr-goods-ui.js', 'nr-analytics.js', 'nr-ab-rotation.js', 'nr-nav.js', 'nr-tariffs.js', 'nr-dash-blocks.js', 'nr-foot.js', 'nr-ig-window.js', 'nr-ui.js', 'nr-motion.js'];
    const map = {};
    for (const name of scripts) {
        const srcPath = path.join(ROOT, name);
        if (!fs.existsSync(srcPath)) { console.warn(`[build-assets] skip missing ${name}`); continue; }
        const result = esbuild.buildSync({
            entryPoints: [srcPath],
            bundle: false,
            minify: true,
            format: 'iife',
            target: ['es2018'],
            write: false,
            logLevel: 'warning',
        });
        const code = result.outputFiles[0].contents;
        const hash = hashOf(code);
        const base = name.replace(/\.js$/, '');
        const finalName = `${base}.${hash}.min.js`;
        fs.writeFileSync(path.join(DIST, finalName), code);
        map[name] = finalName;
        console.log(`[build-assets] ${name} -> dist/${finalName} (${(code.length / 1024).toFixed(1)} KB)`);
    }
    return map;
}

// Стили отдельных модулей кладём в dist с хэшем и подключаем <link>, чтобы не раздувать dashboard.html.
const MODULE_CSS = ['cabinets-hub.css', 'rnp-extra.css', 'nr-motion.css', 'content-factory.css', 'ads-pulse.css', 'nr-admin.css', 'nr-mono.css'];
function buildModuleCss() {
    const crypto = require('crypto');
    const map = {};
    for (const name of MODULE_CSS) {
        const src = path.join(ROOT, name);
        if (!fs.existsSync(src)) continue;
        const css = fs.readFileSync(src, 'utf8');
        const hash = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10);
        const out = name.replace(/\.css$/, `.${hash}.css`);
        fs.writeFileSync(path.join(DIST, out), css);
        map[name] = out;
        console.log(`[build-assets] ${name} -> dist/${out}`);
    }
    return map;
}

function moduleCssTagRe(base) {
    return new RegExp(`<link rel="stylesheet" href="/(?:dist/)?${base}(?:\\.[0-9a-f]{6,})?\\.css">`);
}

function cleanOldDist(keepFiles) {
    if (!fs.existsSync(DIST)) return;
    for (const f of fs.readdirSync(DIST)) {
        if (!keepFiles.includes(f)) {
            try { fs.unlinkSync(path.join(DIST, f)); } catch (_) {}
        }
    }
}

function replaceOnce(content, pattern, replacement, label) {
    if (!pattern.test(content)) {
        console.warn(`[build-assets] pattern not found for: ${label}`);
        return content;
    }
    return content.replace(pattern, replacement);
}

// Ищем либо исходный <script src="https://cdn.tailwindcss.com">, либо уже
// подставленный на предыдущем билде <link ... /dist/tailwind.<hash>.min.css>
// — так повторные билды (когда контент CSS изменился и хэш другой) находят
// и заменяют предыдущую ссылку, а не оставляют файл нетронутым.
const TAILWIND_TAG_RE = /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>|<link rel="stylesheet" href="\/dist\/tailwind\.[0-9a-f]+\.min\.css">/;

function scriptTagRe(base) {
    // Совпадает и с исходным "/name.js?v=..." (до первого билда), и с уже
    // хэшированным "/dist/name.<hash>.min.js" (после билда) — идемпотентно.
    return new RegExp(`<script src="/(?:dist/)?${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.[0-9a-f]{6,})?(?:\\.min)?\\.js(?:\\?[^"]*)?"></script>`);
}

function patchDashboardHtml(cssFile, scriptMap, moduleCss = {}) {
    const file = path.join(ROOT, 'dashboard.html');
    let html = fs.readFileSync(file, 'utf8');
    html = replaceOnce(html, TAILWIND_TAG_RE, `<link rel="stylesheet" href="/dist/${cssFile}">`, 'dashboard.html tailwind cdn');
    for (const [orig, hashed] of Object.entries(scriptMap)) {
        const base = orig.replace(/\.js$/, '');
        html = replaceOnce(html, scriptTagRe(base), `<script src="/dist/${hashed}"></script>`, `dashboard.html ${orig}`);
    }
    // Стили РК вшиваем в страницу: иначе при обновлении сначала мелькает старый вид, пока скрипт не успел их вставить.
    for (const [id, cssFile] of [['adx-style', 'ads-campaign-detail.css'], ['adp-style', 'ad-autopilot.css']]) {
        const p = path.join(ROOT, cssFile);
        if (!fs.existsSync(p)) continue;
        const css = fs.readFileSync(p, 'utf8').trim();
        html = replaceOnce(html, new RegExp(`<style id="${id}">[\\s\\S]*?</style>`), () => `<style id="${id}">${css}</style>`, `dashboard.html ${id}`);
    }
    for (const [orig, hashed] of Object.entries(moduleCss)) {
        const base = orig.replace(/\.css$/, '');
        html = replaceOnce(html, moduleCssTagRe(base), `<link rel="stylesheet" href="/dist/${hashed}">`, `dashboard.html ${orig}`);
    }
    fs.writeFileSync(file, html);
}

function patchSimpleTailwindHtml(fileName, cssFile) {
    const file = path.join(ROOT, fileName);
    if (!fs.existsSync(file)) return;
    let html = fs.readFileSync(file, 'utf8');
    html = replaceOnce(html, TAILWIND_TAG_RE, `<link rel="stylesheet" href="/dist/${cssFile}">`, `${fileName} tailwind cdn`);
    // Инлайновый tailwind.config = {...} больше не нужен (и упадёт с
    // ReferenceError без глобального объекта window.tailwind от CDN-скрипта),
    // конфигурация теперь зашита в tailwind.config.build.js на этапе билда.
    // Не трогаем файл, если этого блока уже нет (повторный билд).
    html = html.replace(/\n?\s*<script>\s*tailwind\.config\s*=[\s\S]*?<\/script>\n?/, '\n');
    fs.writeFileSync(file, html);
}

// Только на деплое (Vercel) или с NR_EXTRACT_INLINE=1: большой встроенный скрипт и стили страницы выносим в файлы с хэшем.
// Так браузер кеширует их на год, а сама страница (она без кеша) остаётся лёгкой. Исходник dashboard.html не меняется:
// тесты и правки работают с ним как раньше, а на сайт уходит уже разобранная копия.
function extractInlineBig() {
    if (!process.env.VERCEL && !process.env.NR_EXTRACT_INLINE) return;
    const esbuild = require('esbuild');
    const file = path.join(ROOT, 'dashboard.html');
    let html = fs.readFileSync(file, 'utf8');
    const MIN = 100 * 1024;
    for (const f of fs.readdirSync(DIST)) {
        if (/^dash-(app|inline)\./.test(f)) fs.unlinkSync(path.join(DIST, f));
    }
    html = html.replace(/<script>([\s\S]*?)<\/script>/g, (whole, code) => {
        if (code.length < MIN) return whole;
        const out = esbuild.transformSync(code, { minifyWhitespace: true, minifySyntax: false, minifyIdentifiers: false, target: 'es2020', loader: 'js' }).code;
        const name = `dash-app.${hashOf(out)}.min.js`;
        fs.writeFileSync(path.join(DIST, name), out);
        console.log(`[build-assets] inline script ${(code.length / 1024).toFixed(0)} KB -> dist/${name} (${(out.length / 1024).toFixed(0)} KB)`);
        return `<script src="/dist/${name}"></script>`;
    });
    html = html.replace(/<style>([\s\S]*?)<\/style>/g, (whole, css) => {
        if (css.length < MIN) return whole;
        const out = esbuild.transformSync(css, { loader: 'css', minify: true }).code;
        const name = `dash-inline.${hashOf(out)}.css`;
        fs.writeFileSync(path.join(DIST, name), out);
        console.log(`[build-assets] inline style ${(css.length / 1024).toFixed(0)} KB -> dist/${name} (${(out.length / 1024).toFixed(0)} KB)`);
        return `<link rel="stylesheet" href="/dist/${name}">`;
    });
    fs.writeFileSync(file, html);
}

function main() {
    ensureDist();
    const cssFile = buildTailwind();
    const scriptMap = buildScripts();
    const moduleCss = buildModuleCss();
    cleanOldDist([cssFile, ...Object.values(scriptMap), ...Object.values(moduleCss)]);
    patchDashboardHtml(cssFile, scriptMap, moduleCss);
    extractInlineBig();
    patchSimpleTailwindHtml('index.html', cssFile);
    patchSimpleTailwindHtml('login.html', cssFile);
    patchSimpleTailwindHtml('consulting.html', cssFile);
    patchSimpleTailwindHtml('reset-password.html', cssFile);
    console.log('[build-assets] done.');
}

main();
