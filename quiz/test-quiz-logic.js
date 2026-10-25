/* Testy logiki quizu: node test-quiz-logic.js [--sample] */
const fs = require('fs');
const L = require('./quiz-logic.js');
const content = JSON.parse(fs.readFileSync('./quiz-content.json', 'utf8'));
const sample = process.argv.includes('--sample');
const E = L.ENUMS;
let n = 0, failures = [];
function fail(msg, a) { if (failures.length < 30) failures.push(msg + ' :: ' + JSON.stringify(a)); }

// 0. Walidacja treści (ta sama, którą strona uruchamia przy wczytaniu)
const vc = L.validateContent(content);
if (!vc.ok) vc.errors.forEach(e => failures.push('validateContent: ' + e));

// 1. Przegląd tekstów: formy rodzajowe i znaczniki
const allStrings = [];
(function walk(o, path) {
  if (typeof o === 'string') { allStrings.push([path, o]); }
  else if (Array.isArray(o)) { o.forEach((x, i) => walk(x, path + '[' + i + ']')); }
  else if (o && typeof o === 'object') { Object.keys(o).forEach(k => walk(o[k], path + '.' + k)); }
})(content, '');
const genderRe = /(?<!\p{L})(\p{L}*(?:łeś|łaś|leś|laś)|sam|sama|gotowy|gotowa|zadowolon\p{L}*|zmęczon\p{L}*|pewien|pewna)(?!\p{L})|\(a\)|\(-aś\)|\(-eś\)|\(-ła\)/iu;
allStrings.forEach(([p, s]) => { const t = s.replace(/ten sam|ta sama|sam w sobie|Sam\b/gi, ''); if (genderRe.test(t)) failures.push('Forma rodzajowa? ' + p + ': ' + s); });

// 2. Kod wyniku: round trip na wszystkich kombinacjach (tanie)
function* combos() {
  for (const situation of E.situation) for (const goal of E.goal) for (const react of E.react) for (const length of E.length)
  for (const mind of E.mind) for (const mind2 of E.mind2) { if (mind2 === mind) continue;
  for (const level of E.level) for (const partner of E.partner) for (const time of E.time) for (const interest of E.interest)
    yield { situation, goal, react, length, mind, mind2, level, partner, time, interest }; }
}
const SKIP = sample ? 97 : 1;
let i = 0;
const t0 = Date.now();
for (const a of combos()) {
  i++;
  if (i % SKIP) continue;
  n++;
  // round trip
  const code = L.encodeAnswers(a); const back = L.decodeAnswers(code);
  if (!back || JSON.stringify(back) !== JSON.stringify(L.normalizeAnswers(a))) { fail('roundtrip', a); continue; }
  let plan;
  try { plan = L.buildPlan(a, content, { firstName: 'Ola', bookingUrl: 'https://example.test/book' }); }
  catch (e) { fail('buildPlan rzuca: ' + e.message, a); continue; }
  // etap niezależnie od logiki
  let exp = Math.min(+a.react, +a.length); if (a.level === 'a2') exp = Math.min(exp, 2);
  if (plan.stage !== exp) fail('etap ' + plan.stage + ' != ' + exp, a);
  if (plan.goalStage !== Math.min(5, plan.stage + 1)) fail('cel', a);
  if (plan.stage < 1 || plan.stage > 4) fail('zakres etapu', a);
  if (plan.unresolved.length) fail('nierozwiązane tokeny: ' + plan.unresolved.join(','), a);
  const json = JSON.stringify(plan.pages);
  if (/\{\{/.test(json)) fail('pozostały {{ }}', a);
  if (/undefined|null/.test(json.replace(/"preparedFor":null|"plus":null|"bonus":null|"specialistNote":null|"intro":null|"tooEasyNote":null|"questionsEasyHint":null/g, ''))) fail('undefined/null w tekście', a);
  if (plan.pages.length !== 14) fail('liczba stron', a);
  plan.pages.forEach((p, k) => { if (p.number !== k + 1) fail('numer strony', a); });
  const d1 = plan.pages[6].data.days, d2 = plan.pages[7].data.days;
  const days = d1.concat(d2);
  if (days.length !== 14) fail('liczba dni', a);
  days.forEach(d => {
    if (!d.core || d.core.length < 10) fail('pusty core dnia ' + d.n, a);
    if (a.time === '5' && d.plus !== null) fail('plus przy 5 min, dzień ' + d.n, a);
    if (a.time !== '5' && !d.plus) fail('brak plus, dzień ' + d.n, a);
    if (a.time !== '20' && d.bonus) fail('bonus poza 20 min', a);
    if (a.time === '20' && [1,2,6,7,14].includes(d.n) && d.bonus) fail('bonus w dniu bez bonusu', a);
  });
  const sent = plan.pages[8].data.sentences;
  if (sent.length !== 12 || sent.filter(s => s.priority).length !== 5) fail('zdania', a);
  const dl = plan.pages[9].data.lines;
  const want = plan.stage <= 2 ? 6 : 8;
  if (dl.length !== want || dl[0].who !== 'other' || dl[dl.length - 1].who !== 'you') fail('dialog', a);
  if (plan.pages[9].data.questions.length !== 10) fail('pytania', a);
  const m = plan.pages[5].data.months;
  if (m.length !== 3 || m.some(x => x.items.length !== 3)) fail('miesiące', a);
  if (a.mind2 !== 'none' && !plan.pages[4].data.bonus) fail('brak bonusu drugiej blokady', a);
  if (a.mind2 === 'none' && plan.pages[4].data.bonus) fail('bonus bez drugiej blokady', a);
  if (['freeze','perfectionist'].includes(a.mind) && !plan.pages[4].data.specialistNote) fail('brak noty o specjaliście', a);
  if (a.level === 'a2' && !plan.pages[2].data.notes.length) fail('brak notki a2', a);
  if (a.partner === 'no') {
    // brak rozmówcy: żadna ze stron 3–8 (mapa, tabela, blokada, plan 90 dni, dni 1–14) nie może wymagać rozmowy na żywo
    const re = /na żywo|przy słuchaczach|z nieznajomym|rozmowie z |rozmow[aęy] z (prawdziwym|żywą)|ktoś słucha|wymiana językowa|grupie językowej|zaproszen/;
    [2, 3, 4, 5, 6, 7, 12].forEach(i => { const hit = JSON.stringify(plan.pages[i].data).replace(/"now":"[^"]*"/g, "").match(re); if (hit) fail('wymóg rozmówcy bez partnera na stronie ' + (i + 1) + ': ' + hit[0], a); });
  }
  if (a.partner === 'maybe' && !/nagraj/.test(days[13].core)) fail('dzień 14 (maybe) bez wersji głosowej w core', a);
  const qs = plan.pages[9].data.questions;
  if (plan.stage <= 2 && qs.filter(q => q.easy).length < 6) fail('za mało łatwych pytań dla etapu 1–2', a);
  if (plan.stage > 2 && qs.some(q => q.easy)) fail('łatwe pytania oznaczone dla etapu 3–4', a);
  if (!plan.summary || !plan.summary.stageName) fail('brak plan.summary', a);
  if (plan.pages[13].data.bookingUrl !== 'https://example.test/book') fail('bookingUrl', a);
}
console.log('Sprawdzono kombinacji:', n, sample ? '(próbka)' : '(wszystkie)', 'czas ms:', Date.now() - t0);
console.log('Błędów:', failures.length);
failures.forEach(f => console.log(' - ' + f));
process.exit(failures.length ? 1 : 0);
