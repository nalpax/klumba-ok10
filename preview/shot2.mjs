import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1280,height:800}});
await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);
await p.click('.nav__actions button'); await p.waitForTimeout(300);
await p.fill('input.field__input--code', 'ПОДСОЛНУХ');
await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
await p.click('.admin-tabs button:has-text("Учителя")'); await p.waitForTimeout(300);
const firstRow = p.locator('.admin-teacher-row').first();
await firstRow.locator('.icon-btn[title="Удалить"]').click(); await p.waitForTimeout(200);
await firstRow.locator('button:has-text("Да")').click(); await p.waitForTimeout(700);
await p.screenshot({path:'/tmp/shot2_inline_error.png'});

// scroll a small viewport to show sticky footer in the edit form
await firstRow.locator('button:has-text("Понятно")').click(); await p.waitForTimeout(200);
await p.setViewportSize({width:1280, height:560});
await firstRow.locator('.icon-btn[title="Изменить"]').click(); await p.waitForTimeout(300);
await p.mouse.wheel(0, 250);
await p.waitForTimeout(200);
await p.screenshot({path:'/tmp/shot2_sticky_footer.png'});
await b.close(); srv.close();
