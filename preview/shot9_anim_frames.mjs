import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1600,height:900}});
await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#garden')?.scrollIntoView({ behavior: 'instant' }));
await p.waitForTimeout(300);
const box = await p.locator('.garden-backdrop').boundingBox();
// sample several points during the real 46s animation via animation-delay negative offsets
for (const [label, negDelay] of [['start','-2s'],['mid','-14s'],['late','-21s']]) {
  await p.evaluate((d) => {
    const g = document.querySelector('.gb-plane');
    g.style.animation = 'none';
    g.offsetHeight;
    g.style.animation = `gb-fly 46s linear infinite`;
    g.style.animationDelay = d;
  }, negDelay);
  await p.waitForTimeout(120);
  await p.screenshot({path:`/tmp/shot9_${label}.png`, clip: box});
}
await b.close(); srv.close();
