import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type())) errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await p.goto(`http://localhost:${srv.address().port}/page.html`);
await p.waitForFunction('window.ready===true'); await p.waitForTimeout(600);
await p.evaluate(()=>{document.querySelector('#garden').scrollIntoView({behavior:'instant'}); window.scrollBy(0,90)}); await p.waitForTimeout(400);
const count0 = await p.textContent('.garden__count strong');
await p.click('text=Посадить пробный цветок'); await p.waitForTimeout(250);
const count1 = await p.textContent('.garden__count strong');
console.log('count', count0, '->', count1);
await p.screenshot({path:'/tmp/i_plant.png'});
// hover a flower head near the emblem: find via renderer? use mouse over canvas center-left
const box = await p.locator('.garden__canvas').boundingBox();
let tip=null;
for (let dx=-260; dx<=260 && !tip; dx+=13) for (let dy=-120; dy<=200 && !tip; dy+=13) {
  await p.mouse.move(box.x+box.width/2+dx, box.y+box.height/2+dy);
  const t = await p.$('.garden__tip'); if (t) tip = await t.innerText();
}
console.log('tooltip:', JSON.stringify(tip));
await p.screenshot({path:'/tmp/i_tip.png', clip:{x:box.x, y:box.y, width:box.width, height:box.height}});
// zoom in button ×3, then fit-all
for (let i=0;i<3;i++) await p.click('button[aria-label="Приблизить"]');
await p.waitForTimeout(300);
const dis = await p.getAttribute('button[aria-label="Показать всю клумбу"]','disabled');
console.log('fit button disabled after zoom?', dis);
await p.click('button[aria-label="Показать всю клумбу"]'); await p.waitForTimeout(900);
const dis2 = await p.getAttribute('button[aria-label="Показать всю клумбу"]','disabled');
console.log('fit button disabled after fit?', dis2);
console.log('touch-action', await p.$eval('.garden__canvas', e=>e.style.touchAction));
console.log('errors', JSON.stringify(errs));
await b.close(); srv.close();
