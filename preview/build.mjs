// Сборка локального предпросмотра (без Next.js): esbuild + статический сервер.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const esbuild = require('/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild');
const entry = process.argv[2] || 'garden-entry.ts';
const out = path.resolve('dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  outdir: out,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  nodePaths: ['/home/claude/.npm-global/lib/node_modules'],
  alias: { '@': path.resolve('..') },
  loader: { '.png': 'file', '.webp': 'file' },
  define: { 'process.env.NODE_ENV': process.env.PROD ? '"production"' : '"development"' },
  minify: !!process.env.PROD,
  logLevel: 'warning',
});
fs.cpSync('../public', out, { recursive: true });
for (const f of ['garden-test.html','page.html']) if (fs.existsSync(f)) fs.copyFileSync(f, path.join(out, f));
console.log('built', entry);
