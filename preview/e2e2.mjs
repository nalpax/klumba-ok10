import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
fs.mkdirSync('/tmp/e2e2', {recursive:true});
const b = await chromium.launch();
const errs=[];
const log = (...a)=>console.log(...a);
const ok = (c, msg)=>{ log((c?'PASS ':'FAIL ')+msg); if(!c) process.exitCode=1; };

async function openPage(viewport) {
  const ctx = await b.newContext({viewport, hasTouch: viewport.width<600, isMobile: viewport.width<600, deviceScaleFactor: 1});
  const p = await ctx.newPage();
  p.on('console',m=>{if(['error','warning'].includes(m.type())) errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);
  return p;
}
async function login(p, code) {
  await p.click('.nav__actions button');
  await p.waitForSelector('dialog[open] input.field__input--code, dialog[open] .admin-tab, dialog[open] .cabinet');
  const input = await p.$('dialog[open] input.field__input--code');
  if (input) await input.fill(code);
  await p.click('dialog[open] button[type=submit]');
}

const p = await openPage({width:1440,height:900});

// --- theme / sun ---
await p.screenshot({path:'/tmp/e2e2/01_hero_theme.png'});
const bg0 = await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg-0').trim());
ok(bg0.toLowerCase()!=='#040805', 'background token changed from old dark green ('+bg0+')');
ok(await p.isVisible('.hero__sun-core'), 'animated sun core is present');
ok(await p.isVisible('.hero__sun-rays'), 'animated sun rays are present');

// --- guest greeting still shows the letter to teachers ---
await p.evaluate(()=>document.querySelector('#greeting').scrollIntoView({behavior:'instant'})); await p.waitForTimeout(300);
await p.screenshot({path:'/tmp/e2e2/02_greeting_guest.png'});
ok((await p.textContent('#greeting')).includes('Дорогие учителя'), 'guest still sees the letter to teachers');

// --- student sees a school-year wish instead ---
await login(p, 'M4NTF-E43AD'); await p.waitForTimeout(800);
await p.click('.modal__close').catch(()=>{});
await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#greeting').scrollIntoView({behavior:'instant'})); await p.waitForTimeout(300);
const studentGreeting = await p.textContent('#greeting');
ok(!studentGreeting.includes('Дорогие учителя'), 'logged-in student no longer sees the letter to teachers');
await p.screenshot({path:'/tmp/e2e2/03_greeting_student.png'});
log('student wish snippet:', studentGreeting.slice(0,120).replace(/\s+/g,' '));

// logout student
await p.click('.nav__actions button'); await p.waitForTimeout(300);
await p.click('dialog[open] >> text=Выйти'); await p.waitForTimeout(300);

// --- admin login with the word code ---
await login(p, 'ПОДСОЛНУХ'); await p.waitForTimeout(900);
ok(await p.isVisible('.admin-tab'), 'admin word logs straight into the admin panel');
await p.screenshot({path:'/tmp/e2e2/04_admin_event.png'});
ok((await p.textContent('.admin-stats')).includes('цветов на клумбе'), 'admin stats visible');

// event status control
ok(await p.getAttribute('.admin-status__opt[aria-pressed="true"]', 'aria-pressed').then(v=>v==='true').catch(()=>false), 'one status option is marked active');
const activeLabelBefore = await p.textContent('.admin-status__opt[aria-pressed="true"] strong');
log('active status before:', activeLabelBefore);
// click "Завершено"
const closedBtn = await p.locator('.admin-status__opt', { hasText: 'Завершено' });
await closedBtn.click(); await p.waitForTimeout(700);
ok((await p.getAttribute('.admin-status__opt[aria-pressed="true"] strong', 'textContent'))===undefined || true, 'clicked closed'); // no-op guard
const activeLabelAfter = await p.textContent('.admin-status__opt[aria-pressed="true"] strong');
ok(activeLabelAfter === 'Завершено', 'status switched to Завершено, shows: '+activeLabelAfter);
await p.screenshot({path:'/tmp/e2e2/05_admin_closed.png'});

// verify it propagated: check garden panel text or hero status pill without reload
await p.keyboard.press('Escape').catch(()=>{});
await p.waitForTimeout(300);
const pill = await p.textContent('.status-pill');
log('hero status pill:', pill.trim());
ok(pill.includes('готова') || pill.includes('готов'), 'hero status pill reflects closed status live: '+pill.trim());

// reopen planting for the rest of the test
await p.click('.nav__actions button'); await p.waitForTimeout(400);
const openBtn = await p.locator('.admin-status__opt', { hasText: 'Идёт посадка' });
await openBtn.click(); await p.waitForTimeout(500);

// --- teachers tab: add a teacher ---
await p.click('.admin-tabs button:has-text("Учителя")'); await p.waitForTimeout(300);
const teacherCountBefore = await p.locator('.admin-teacher-row').count();
await p.click('text=+ Добавить учителя'); await p.waitForTimeout(300);
await p.fill('.admin-form input.field__input >> nth=0', 'Пётр'); // firstName
const inputs = await p.$$('.admin-form__grid input.field__input');
await inputs[0].fill('Пётр');
await inputs[1].fill('Ильич');
await inputs[2].fill('Тестовый');
await inputs[3].fill('Труд');
await p.click('.swatch:nth-child(3) .swatch__dot');
await p.click('.admin-flower:nth-child(2)');
await p.click('.admin-flower:nth-child(4)');
await p.fill('.admin-textarea', 'Спасибо за уроки труда и терпение с нашими руками!');
await p.screenshot({path:'/tmp/e2e2/06_admin_teacher_form.png'});
await p.click('text=Добавить учителя'); await p.waitForTimeout(500);
ok(await p.isVisible('.admin-code-reveal'), 'new teacher login code revealed once');
await p.screenshot({path:'/tmp/e2e2/07_admin_teacher_added.png'});
const teacherCountAfter = await p.locator('.admin-teacher-row').count();
ok(teacherCountAfter === teacherCountBefore + 1, `teacher count ${teacherCountBefore} -> ${teacherCountAfter}`);
ok((await p.textContent('.admin-teacher-list')).includes('Тестовый Пётр Ильич'), 'new teacher appears in the list');

// edit it
await p.click('.admin-teacher-row:has-text("Тестовый") .icon-btn[title="Изменить"]'); await p.waitForTimeout(300);
const editInputs = await p.$$('.admin-form__grid input.field__input');
await editInputs[3].fill('Труд и технология');
await p.click('text=Сохранить'); await p.waitForTimeout(500);
ok((await p.textContent('.admin-teacher-list')).includes('Труд и технология'), 'edited subject is reflected in the list');

// delete it (with confirm flow)
await p.click('.admin-teacher-row:has-text("Тестовый") .icon-btn[title="Удалить"]'); await p.waitForTimeout(200);
ok(await p.isVisible('.admin-teacher-row:has-text("Тестовый") >> text=Удалить?'), 'delete asks for confirmation');
await p.click('.admin-teacher-row:has-text("Тестовый") button:has-text("Да")');
await p.waitForFunction(() => !document.body.textContent.includes('Тестовый Пётр'), null, { timeout: 4000 }).catch((e)=>log('wait-for-removal failed:', e.message));
const teacherCountFinal = await p.locator('.admin-teacher-row').count();
log('rows after delete click:', await p.locator('.admin-teacher-row strong').allTextContents());
ok(teacherCountFinal === teacherCountBefore, `teacher removed, count back to ${teacherCountFinal}`);

// try deleting a teacher WITH plantings -> should be blocked
const firstRow = p.locator('.admin-teacher-row').first();
const firstName = (await firstRow.locator('strong').textContent()).trim();
await firstRow.locator('.icon-btn[title="Удалить"]').click(); await p.waitForTimeout(200);
await firstRow.locator('button:has-text("Да")').click(); await p.waitForTimeout(500);
const err = await p.textContent('.admin-tab .form-error').catch(()=>'');
log('delete-blocked message for', firstName, ':', err);
ok(!!err && err.trim().length > 0, 'deleting a teacher with existing plantings is blocked with a message');

// --- codes tab ---
await p.click('.admin-tabs button:has-text("Коды ученикам")'); await p.waitForTimeout(300);
await p.fill('.admin-codes-form input[type=number]', '5');
await p.fill('.admin-codes-form input:not([type=number])', '9А');
await p.click('text=Сгенерировать'); await p.waitForTimeout(600);
const codesText = await p.inputValue('.admin-codes-result textarea');
log('generated codes:', codesText.replace(/\n/g,' | '));
ok(codesText.split('\n').filter(Boolean).length === 5, 'exactly 5 codes generated');
await p.screenshot({path:'/tmp/e2e2/08_admin_codes.png'});

const [download] = await Promise.all([
  p.waitForEvent('download'),
  p.click('text=Скачать все коды (CSV)'),
]);
log('csv download filename:', download.suggestedFilename());
ok(download.suggestedFilename() === 'klumba-codes.csv', 'CSV download triggered with expected filename');

await p.close();
console.log('console errors/warnings:', JSON.stringify(errs));
await b.close(); srv.close();
