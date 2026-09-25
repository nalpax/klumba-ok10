import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
const b = await chromium.launch();

{
  const p = await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
  await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);
  await p.click('.nav__actions button'); await p.waitForTimeout(300);
  await p.fill('input.field__input--code', 'ПОДСОЛНУХ');
  await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
  await p.screenshot({path:'/tmp/shot4_event_tab.png'});
  await p.close();
}
{
  const p = await (await b.newContext({viewport:{width:390,height:844}, hasTouch:true, isMobile:true})).newPage();
  await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);
  await p.click('.nav__actions button'); await p.waitForTimeout(300);
  await p.fill('input.field__input--code', 'ПОДСОЛНУХ');
  await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
  await p.click('.admin-status__opt:has-text("Завершено")'); await p.waitForTimeout(600);
  await p.click('.admin-logout'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#garden')?.scrollIntoView({ behavior: 'instant' }));
  await p.waitForTimeout(400);
  await p.screenshot({path:'/tmp/shot4_mobile_closing.png'});
  await p.close();
}
await b.close(); srv.close();
