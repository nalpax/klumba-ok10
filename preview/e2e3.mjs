import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
fs.mkdirSync('/tmp/e2e3', {recursive:true});
const b = await chromium.launch();
const errs=[];
const log = (...a)=>console.log(...a);
const ok = (c, msg)=>{ log((c?'PASS ':'FAIL ')+msg); if(!c) process.exitCode=1; };

const ctx = await b.newContext({viewport:{width:1280,height:900}});
const p = await ctx.newPage();
p.on('console',m=>{if(['error','warning'].includes(m.type())) errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);

await p.click('.nav__actions button');
await p.waitForSelector('dialog[open] input.field__input--code');
await p.fill('input.field__input--code', 'ПОДСОЛНУХ');
await p.click('dialog[open] button[type=submit]');
await p.waitForTimeout(800);
ok(await p.isVisible('.admin-tab'), 'logged in as admin, panel open');

// --- logout ---
ok(await p.isVisible('.admin-logout'), 'logout link is visible in the admin panel');
await p.click('.admin-logout');
await p.waitForTimeout(500);
ok(!(await p.isVisible('dialog[open]')), 'admin panel closed after logout');
ok((await p.textContent('.nav__actions button')).includes('Вход'), 'header shows «Вход» again after logout');

// log back in
await p.click('.nav__actions button'); await p.waitForTimeout(300);
await p.fill('input.field__input--code', 'ПОДСОЛНУХ');
await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
ok(await p.isVisible('.admin-tab'), 're-logged in as admin');

await p.click('.admin-tabs button:has-text("Учителя")'); await p.waitForTimeout(300);

// --- add a fresh teacher, then edit their NAME specifically, then delete (no plantings) ---
await p.click('text=+ Добавить учителя'); await p.waitForTimeout(300);
let inputs = await p.$$('.admin-form__grid input.field__input');
await inputs[0].fill('Олеся');
await inputs[1].fill('Игоревна');
await inputs[2].fill('Пробная');
await inputs[3].fill('Черчение');
await p.click('.swatch:nth-child(5) .swatch__dot');
await p.click('.admin-flower:nth-child(1)');
// scroll check: buttons should be reachable without extra scrolling of the page (sticky)
const addBtnBox = await p.locator('.admin-form__actions button:has-text("Добавить учителя")').boundingBox();
ok(addBtnBox !== null, 'add-teacher button has a bounding box (visible)');
await p.click('.admin-form__actions >> text=Добавить учителя');
await p.waitForTimeout(600);
ok(await p.isVisible('.admin-notice'), 'success notice shown after adding a teacher');
log('notice text:', await p.textContent('.admin-notice'));
ok(await p.isVisible('.admin-code-reveal'), 'new teacher code revealed');
ok((await p.textContent('.admin-teacher-list')).includes('Пробная Олеся Игоревна'), 'new teacher visible in list');

// edit ONLY the name of that teacher
await p.click('.admin-teacher-row:has-text("Пробная") .icon-btn[title="Изменить"]'); await p.waitForTimeout(300);
inputs = await p.$$('.admin-form__grid input.field__input');
await inputs[0].fill('');
await inputs[0].type('Алина');
await inputs[2].fill('');
await inputs[2].type('Изменённая');
await p.click('.admin-form__actions >> text=Сохранить');
await p.waitForTimeout(600);
const rows1 = await p.locator('.admin-teacher-row strong').allTextContents();
log('rows after name edit:', JSON.stringify(rows1));
ok(rows1.some(r => r.includes('Изменённая Алина Игоревна')), 'edited NAME is reflected in the list');
ok(await p.isVisible('.admin-notice'), 'success notice shown after editing name');

// delete this fresh teacher (no plantings) — should succeed cleanly
const beforeCount = await p.locator('.admin-teacher-row').count();
await p.click('.admin-teacher-row:has-text("Изменённая") .icon-btn[title="Удалить"]'); await p.waitForTimeout(200);
await p.click('.admin-teacher-row:has-text("Изменённая") button:has-text("Да")');
await p.waitForFunction(
  () => ![...document.querySelectorAll('.admin-teacher-row strong')].some(e => e.textContent.includes('Изменённая Алина')),
  null, { timeout: 4000 }
);
const afterCount = await p.locator('.admin-teacher-row').count();
ok(afterCount === beforeCount - 1, `teacher with no plantings deleted cleanly (${beforeCount} -> ${afterCount})`);
ok(await p.isVisible('.admin-notice'), 'success notice shown after deleting');

// --- try deleting an ORIGINAL teacher (has plantings): should show a clear inline row error ---
const firstRow = p.locator('.admin-teacher-row').first();
const firstName = (await firstRow.locator('strong').textContent()).trim();
await firstRow.locator('.icon-btn[title="Удалить"]').click(); await p.waitForTimeout(200);
await firstRow.locator('button:has-text("Да")').click(); await p.waitForTimeout(600);
const rowErrorVisible = await firstRow.locator('.admin-teacher-row__error').isVisible();
ok(rowErrorVisible, 'blocked delete shows an inline error right on the row (not just far below)');
log('inline row error for', firstName, ':', await firstRow.locator('.admin-teacher-row__error').textContent());
await firstRow.locator('button:has-text("Понятно")').click(); await p.waitForTimeout(200);
ok(!(await firstRow.locator('.admin-teacher-row__error').isVisible()), 'row returns to normal after acknowledging the error');
await p.screenshot({path:'/tmp/e2e3/blocked_delete.png'});

console.log('console errors/warnings:', JSON.stringify(errs));
await b.close(); srv.close();
