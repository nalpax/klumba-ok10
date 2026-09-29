// Статическая сборка сайта без сервера — два варианта:
//   npm run build && npm run preview:build            → preview-dist/: демо, данные в памяти браузера
//   npm run build && npm run archive:build -- файл.json → archive-dist/: архив клумбы только для просмотра
//     (файл — «Скачать архив клумбы» из админки). Папку можно выложить на любой хостинг, например GitHub Pages.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const archiveIdx = process.argv.indexOf('--archive');
const archiveFile = archiveIdx > -1 ? process.argv[archiveIdx + 1] : null;
if (archiveIdx > -1 && (!archiveFile || !fs.existsSync(archiveFile))) {
  console.error('Укажите файл архива: npm run archive:build -- klumba-archive.json');
  process.exit(1);
}
// --php: настоящий сайт для обычного PHP-хостинга (public_html), сервер — файл api.php (папка php/)
const php = process.argv.includes('--php');
const out = path.join(root, php ? 'php-dist' : archiveFile ? 'archive-dist' : 'preview-dist');
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
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_DEMO': archiveFile || php ? '""' : '"1"',
    'process.env.NEXT_PUBLIC_PHP_API': php ? '"1"' : '""',
    'process.env.NEXT_PUBLIC_ARCHIVE': archiveFile ? '"1"' : '""',
    'process.env.NEXT_PUBLIC_SITE_URL': '""',
  },
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
<title>С Днём учителя! Клумба ОК № 10${archiveFile || php ? "" : " — демо"}</title>
<link rel="icon" href="brand/icon-192.png">
<link rel="stylesheet" href="site.css">
</head>
<body><div id="root"></div><script src="app.js"></script></body>
</html>
`,
);
if (php) {
  // сервер на PHP + справочник (цветы, цвета, места на клумбе) — тот же, что у Node-сервера
  fs.cpSync(path.join(root, 'php'), out, { recursive: true });
  const tmp = path.join(out, '.catalog.cjs');
  await esbuild.build({
    entryPoints: [path.join(root, 'scripts/php-catalog.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: tmp,
    alias: { '@': root },
    logLevel: 'warning',
  });
  const { createRequire } = await import('node:module');
  const catalog = createRequire(import.meta.url)(tmp).catalog();
  fs.rmSync(tmp);
  fs.writeFileSync(path.join(out, 'klumba-lib', 'catalog.json'), JSON.stringify(catalog));
  console.log(`php-dist готов: ${catalog.slots.length} мест на клумбе`);
} else if (archiveFile) {
  // проверяем, что это действительно архив клумбы, и кладём рядом со страницей
  const snap = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  if (!Array.isArray(snap.plantings) || !Array.isArray(snap.teachers)) {
    console.error('Это не архив клумбы: нет списка цветов или учителей.');
    process.exit(1);
  }
  fs.writeFileSync(path.join(out, 'archive.json'), JSON.stringify(snap));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  console.log(`archive-dist готов: ${snap.plantings.length} цветов, ${snap.teachers.length} учителей`);
} else {
  console.log('preview-dist готов');
}
