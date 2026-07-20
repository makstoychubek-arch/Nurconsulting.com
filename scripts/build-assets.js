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
    const scripts = ['dashboard-charts.js', 'rnp-module.js', 'wb-formulas.js'];
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

function patchDashboardHtml(cssFile, scriptMap) {
    const file = path.join(ROOT, 'dashboard.html');
    let html = fs.readFileSync(file, 'utf8');
    html = replaceOnce(html, TAILWIND_TAG_RE, `<link rel="stylesheet" href="/dist/${cssFile}">`, 'dashboard.html tailwind cdn');
    for (const [orig, hashed] of Object.entries(scriptMap)) {
        const base = orig.replace(/\.js$/, '');
        html = replaceOnce(html, scriptTagRe(base), `<script src="/dist/${hashed}"></script>`, `dashboard.html ${orig}`);
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

function main() {
    ensureDist();
    const cssFile = buildTailwind();
    const scriptMap = buildScripts();
    cleanOldDist([cssFile, ...Object.values(scriptMap)]);
    patchDashboardHtml(cssFile, scriptMap);
    patchSimpleTailwindHtml('index.html', cssFile);
    patchSimpleTailwindHtml('login.html', cssFile);
    console.log('[build-assets] done.');
}

main();
