/* Test przepełnienia stron PDF: node test-pdf-overflow.js
 *
 * Składa wszystkie 14 stron planu w prawdziwej przeglądarce (ta sama funkcja buildDoc/fitPages co na stronie)
 * i sprawdza, że żadna strona nie wychodzi poza 1123 px. Kombinacje:
 *  - dla każdej strony: 3 kombinacje z najdłuższym tekstem tej strony (liczone po wszystkich 864 000 kombinacjach),
 *  - 8 przypadków z golden-cases.json,
 *  - 50 losowych kombinacji (stałe ziarno, więc wynik jest powtarzalny).
 * Wymaga playwright lub playwright-core oraz Chrome/Edge (zmienna BROWSER_CHANNEL: msedge | chrome, domyślnie msedge).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const L = require('./quiz-logic.js');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const content = JSON.parse(fs.readFileSync(path.join(__dirname, 'quiz-content.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden-cases.json'), 'utf8'));
const E = L.ENUMS;
const LONG_NAME = 'Aleksandra-Magdalena Wiśniewska-Kowalska'.slice(0, 40);

/* 1. Najdłuższe kombinacje dla każdej strony */
function* combos() {
  for (const situation of E.situation) for (const goal of E.goal) for (const react of E.react) for (const length of E.length)
  for (const mind of E.mind) for (const mind2 of E.mind2) { if (mind2 === mind) continue;
  for (const level of E.level) for (const partner of E.partner) for (const time of E.time) for (const interest of E.interest)
    yield { situation, goal, react, length, mind, mind2, level, partner, time, interest }; }
}
const TOP = 3, top = {};
content.pageOrder.forEach(k => { top[k] = []; });
let count = 0;
for (const a of combos()) {
  count++;
  const plan = L.buildPlan(a, content, { firstName: LONG_NAME, bookingUrl: 'https://example.test/book' });
  plan.pages.forEach(p => {
    const len = JSON.stringify(p.data).length, list = top[p.key];
    if (list.length < TOP || len > list[list.length - 1].len) {
      list.push({ len, a }); list.sort((x, y) => y.len - x.len); if (list.length > TOP) list.pop();
    }
  });
}
const cases = [];
Object.keys(top).forEach(k => top[k].forEach((t, i) => cases.push({ id: 'max-' + k + '-' + (i + 1), a: t.a })));
golden.forEach(g => cases.push({ id: g.id, a: g.answers }));
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = arr => arr[Math.floor(rnd() * arr.length)];
for (let i = 0; i < 50; i++) {
  const a = {}; L.KEYS.forEach(k => { a[k] = pick(E[k]); });
  cases.push({ id: 'rand-' + (i + 1), a: L.normalizeAnswers(a) });
}

/* 2. Serwer plików (katalog nadrzędny, żeby działały ścieżki ../assets) */
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(buf);
  });
});

(async () => {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const url = 'http://127.0.0.1:' + server.address().port + '/quiz/';
  const browser = await pw.chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  const results = await page.evaluate(async ({ cases, name }) => {
    state.name = name;
    const out = [];
    for (const c of cases) {
      const plan = makePlan(c.a);
      const r = document.getElementById('render');
      r.innerHTML = buildDoc(plan).join('');
      await document.fonts.ready;
      const bad = fitPages(r);
      const pages = [...r.querySelectorAll('.pg')].map(pg => ({
        key: pg.dataset.key, h: pg.scrollHeight, fs: parseFloat(pg.style.fontSize || getComputedStyle(pg).fontSize)
      }));
      out.push({ id: c.id, bad, pages, count: pages.length });
    }
    return out;
  }, { cases, name: LONG_NAME });
  await browser.close(); server.close();

  const failures = [], minFs = {};
  results.forEach(r => {
    if (r.count !== 14) failures.push(r.id + ': stron ' + r.count);
    if (r.bad.length) failures.push(r.id + ': przepełnienie ' + r.bad.join(', '));
    r.pages.forEach(p => {
      if (p.h > 1123) failures.push(r.id + ': ' + p.key + ' scrollHeight ' + p.h);
      if (!(p.key in minFs) || p.fs < minFs[p.key].fs) minFs[p.key] = { fs: p.fs, id: r.id };
    });
  });
  console.log('Kombinacji przeszukanych:', count, '| złożonych w przeglądarce:', results.length);
  console.log('Najmniejsza czcionka na stronie (px):');
  Object.keys(minFs).forEach(k => console.log('  ' + k.padEnd(10) + minFs[k].fs + '  (' + minFs[k].id + ')'));
  errors.forEach(e => failures.push('błąd JS: ' + e));
  console.log('Błędów:', failures.length);
  failures.slice(0, 40).forEach(f => console.log(' - ' + f));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
