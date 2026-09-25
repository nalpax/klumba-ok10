import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
fs.mkdirSync('/tmp/shots', {recursive:true});
const b = await chromium.launch();

async function open(viewport) {
  const ctx = await b.newContext({viewport, hasTouch: viewport.width<600, isMobile: viewport.width<600});
  const p = await ctx.newPage();
  await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(900);
  return p;
}
async function login(p, code) {
  await p.click('.nav__actions button');
  await p.waitForSelector('dialog[open] input.field__input--code, dialog[open] .admin-tab');
  const input = await p.$('dialog[open] input.field__input--code');
  if (input) await input.fill(code);
  await p.click('dialog[open] button[type=submit]');
}

// Desktop hero (bright theme + sun)
{
  const p = await open({width:1440, height:900});
  await p.screenshot({path:'/tmp/shots/d_hero.png'});
  await p.close();
}
// Desktop: student wish
{
  const p = await open({width:1440, height:900});
  await login(p, 'EN4NX-W7TKA'); await p.waitForTimeout(700);
  await p.click('.modal__close');
  await p.evaluate(()=>document.querySelector('#greeting').scrollIntoView({behavior:'instant'})); await p.waitForTimeout(400);
  await p.screenshot({path:'/tmp/shots/d_wish.png'});
  await p.close();
}
// Desktop: admin panel tabs
{
  const p = await open({width:1440, height:900});
  await login(p, 'ПОДСОЛНУХ'); await p.waitForTimeout(800);
  await p.screenshot({path:'/tmp/shots/d_admin_event.png'});
  await p.click('.admin-tabs button:has-text("Учителя")'); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/shots/d_admin_teachers.png'});
  await p.click('text=+ Добавить учителя'); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/shots/d_admin_teacher_form.png'});
  await p.click('.admin-form__back'); await p.waitForTimeout(200);
  await p.click('.admin-tabs button:has-text("Коды ученикам")'); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/shots/d_admin_codes.png'});
  await p.close();
}
// Mobile
{
  const p = await open({width:390, height:844});
  await p.screenshot({path:'/tmp/shots/m_hero.png'});
  await login(p, 'ПОДСОЛНУХ'); await p.waitForTimeout(800);
  await p.screenshot({path:'/tmp/shots/m_admin.png'});
  await p.close();
}
await b.close(); srv.close();
console.log('done');
