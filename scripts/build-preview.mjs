// Статический предпросмотр сайта в демо-режиме (без сервера): данные живут в памяти браузера.
// Запуск: npm run build && npm run preview:build → папка preview-dist/ (index.html можно открыть на любом хостинге).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'preview-dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'scripts/preview-entry.tsx')],
  bundle: true,
  outfile: path.join(out, 'app.js'),
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  alias: { '@': root },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_DEMO': '"1"', 'process.env.NEXT_PUBLIC_SITE_URL': '""' },
  minify: true,
  logLevel: 'warning',
});

// стили и шрифты берём из готовой сборки Next.js (там уже Tailwind-сброс и шрифты next/font)
const cssDir = path.join(root, '.next/static/css');
const css = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
fs.mkdirSync(path.join(out, 'media'));
const fixed = css.replace(/url\((['"]?)\/_next\/static\/media\/([^)'"]+)\1\)/g, (_m, _q, file) => {
  fs.copyFileSync(path.join(root, '.next/static/media', file), path.join(out, 'media', file));
  return `url(media/${file})`;
});
fs.writeFileSync(path.join(out, 'site.css'), fixed);
fs.cpSync(path.join(root, 'public'), out, { recursive: true });

const html = fs.readFileSync(path.join(root, '.next/server/app/index.html'), 'utf8');
const htmlClass = html.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? '';
fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html>
<html lang="ru" class="${htmlClass}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>С Днём учителя! Клумба ОК № 10 — демо</title>
<link rel="icon" href="brand/icon-192.png">
<link rel="stylesheet" href="site.css">
</head>
<body><div id="root"></div><script src="app.js"></script></body>
</html>
`,
);
console.log('preview-dist готов');
