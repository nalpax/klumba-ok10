import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
fs.mkdirSync('/tmp/dbg', {recursive:true});
const b = await chromium.launch();
const errs=[];
const p = await b.newPage({viewport:{width:1280,height:900}});
p.on('console',m=>{ errs.push(`[${m.type()}] ${m.text()}`); });
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);

await p.click('.nav__actions button');
await p.waitForSelector('dialog[open] input.field__input--code');
await p.fill('input.field__input--code', 'ПОДСОЛНУХ');
await p.click('dialog[open] button[type=submit]');
await p.waitForTimeout(800);
console.log('admin panel visible:', await p.isVisible('.admin-tab'));

// look for any logout affordance inside the admin modal
const modalHtml = await p.$eval('.modal__body', el => el.outerHTML.length);
console.log('modal body length:', modalHtml);
const hasLogoutText = await p.locator('dialog[open] >> text=Выйти').count();
console.log('"Выйти" occurrences inside dialog:', hasLogoutText);

// Go to teachers tab, try editing a name
await p.click('.admin-tabs button:has-text("Учителя")'); await p.waitForTimeout(300);
await p.screenshot({path:'/tmp/dbg/01_teachers.png'});

const firstRowName = await p.locator('.admin-teacher-row strong').first().textContent();
console.log('first row before edit:', firstRowName);

await p.locator('.admin-teacher-row').first().locator('.icon-btn[title="Изменить"]').click();
await p.waitForTimeout(300);
await p.screenshot({path:'/tmp/dbg/02_edit_form.png'});

const inputs = await p.$$('.admin-form__grid input.field__input');
console.log('form inputs found:', inputs.length);
const beforeVals = [];
for (const i of inputs) beforeVals.push(await i.inputValue());
console.log('before values:', beforeVals);

await inputs[0].fill('');
await inputs[0].type('Артём');
await inputs[2].fill('');
await inputs[2].type('Тестов');
const afterVals = [];
for (const i of inputs) afterVals.push(await i.inputValue());
console.log('after typing values:', afterVals);
await p.screenshot({path:'/tmp/dbg/03_edited.png'});

await p.click('text=Сохранить');
await p.waitForTimeout(700);
await p.screenshot({path:'/tmp/dbg/04_after_save.png'});

const rowNames = await p.locator('.admin-teacher-row strong').allTextContents();
console.log('rows after save:', JSON.stringify(rowNames));

const errorVisible = await p.isVisible('.admin-tab .form-error');
console.log('form-error visible:', errorVisible);
if (errorVisible) console.log('error text:', await p.textContent('.admin-tab .form-error'));

console.log('---console/page errors---');
console.log(errs.filter(e=>e.startsWith('[error]')||e.startsWith('PAGEERROR')).join('\n'));

await b.close(); srv.close();
