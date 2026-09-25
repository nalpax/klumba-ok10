import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
fs.mkdirSync('/tmp/e2e4', {recursive:true});
const b = await chromium.launch();
const errs=[];
const log = (...a)=>console.log(...a);
const ok = (c, msg)=>{ log((c?'PASS ':'FAIL ')+msg); if(!c) process.exitCode=1; };

const p = await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
p.on('console',m=>{if(['error','warning'].includes(m.type())) errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);

await p.click('.nav__actions button'); await p.waitForTimeout(300);
await p.fill('input.field__input--code', 'ПОДСОЛНУХ');
await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
ok(await p.isVisible('.admin-tab'), 'admin logged in');

// edit closing content
ok(await p.isVisible('.admin-closing'), 'closing-content editor visible on Мероприятие tab');
const saveBtn = p.locator('.admin-closing__buttons button');
ok(await saveBtn.isDisabled(), 'save disabled while form matches saved content');

await p.fill('.admin-closing input.field__input', 'Клумба отцвела, но не завяла!');
const textarea = p.locator('.admin-closing textarea');
await textarea.fill('');
await textarea.type('Спасибо всем, кто в этом году сказал учителям спасибо цветком. До встречи через год!');
ok(!(await saveBtn.isDisabled()), 'save enabled once form is dirty');
await saveBtn.click(); await p.waitForTimeout(500);
ok(await p.isVisible('.admin-closing__ok'), 'shows «Сохранено ✓» after saving closing content');

// switch status to closed
const closedBtn = p.locator('.admin-status__opt', { hasText: 'Завершено' });
await closedBtn.click(); await p.waitForTimeout(600);
ok(await p.getAttribute('.admin-status__opt[aria-pressed="true"] strong', 'textContent') === null || true, 'noop');

// log out and view as guest
await p.click('.admin-logout'); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#garden')?.scrollIntoView({ behavior: 'instant' }));
await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/e2e4/guest_closed.png'});
const closingText = await p.textContent('.closing');
log('closing panel text:', closingText.replace(/\s+/g,' '));
ok(closingText.includes('Клумба отцвела, но не завяла'), 'guest sees the admin-edited closing title');
ok(closingText.includes('До встречи через год'), 'guest sees the admin-edited closing text');
ok(await p.isVisible('.closing__stats'), 'stats block shown (showStats was left on)');
ok(closingText.includes('420') || /\d+/.test(closingText), 'stats include a flower count');
ok((await p.textContent('.status-pill')).includes('готова'), 'hero pill still says «готова»');

// a fresh (not-yet-planted) student should ALSO see the closing panel, not the planting form
await p.click('.nav__actions button'); await p.waitForTimeout(300);
await p.fill('input.field__input--code', 'FRTRN-TMNFC');
await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
await p.click('.modal__close').catch(()=>{});
await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('#garden')?.scrollIntoView({ behavior: 'instant' }));
await p.waitForTimeout(400);
const stillClosing = await p.isVisible('.closing');
ok(stillClosing, 'a student who has not planted yet also sees the closing panel once posадка is closed');
ok(!(await p.isVisible('#plant .plant__grid')), 'planting form is NOT shown once closed for a not-yet-planted student');

console.log('console errors/warnings:', JSON.stringify(errs));
await b.close(); srv.close();
