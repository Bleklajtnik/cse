/*
 * quiz-logic.js — implementacja referencyjna logiki quizu "Plan odblokowania mówienia po angielsku".
 *
 * Czysta funkcja: odpowiedzi + quiz-content.json  ->  model widoku planu (bez DOM, bez sieci, bez losowości).
 * Działa w przeglądarce (window.QuizLogic) i w Node (require). Nie zawiera układu PDF ani HTML.
 * Te same odpowiedzi ZAWSZE dają ten sam plan. Dzięki temu link z kodem wyniku odtwarza PDF bez serwera.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.QuizLogic = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 1. Dozwolone wartości odpowiedzi (kolejność = kolejność w kodzie wyniku; NIE zmieniać) ---------- */
  var ENUMS = {
    situation: ['meetings', 'foreigners', 'calls', 'travel', 'smalltalk'],
    goal:      ['work', 'travel', 'people', 'confidence'],
    react:     ['1', '2', '3', '4'],
    length:    ['1', '2', '3', '4'],
    mind:      ['translator', 'perfectionist', 'searcher', 'freeze', 'practice'],
    mind2:     ['none', 'translator', 'perfectionist', 'searcher', 'freeze', 'practice'],
    level:     ['a2', 'b1', 'b2', 'unknown'],
    partner:   ['yes', 'maybe', 'no'],
    time:      ['5', '12', '20'],
    interest:  ['soon', 'later', 'alone']
  };
  var KEYS = ['situation', 'goal', 'react', 'length', 'mind', 'mind2', 'level', 'partner', 'time', 'interest'];
  Object.keys(ENUMS).forEach(function (k) { Object.freeze(ENUMS[k]); });
  Object.freeze(ENUMS); Object.freeze(KEYS);
  var CODE_VERSION = 'v1';

  /* ---------- 2. Walidacja i normalizacja ---------- */
  function normalizeAnswers(a) {
    var out = {};
    KEYS.forEach(function (k) { var raw = a ? a[k] : undefined;
      out[k] = (typeof raw === 'string' || typeof raw === 'number') ? String(raw) : ''; });
    if (out.mind2 === '') { out.mind2 = 'none'; }               // mind2 jest opcjonalne
    if (out.mind2 === out.mind) { out.mind2 = 'none'; }          // druga blokada nie może być taka sama jak główna
    return out;
  }

  function validateAnswers(a) {
    var errors = [];
    KEYS.forEach(function (k) {
      if (ENUMS[k].indexOf(a[k]) === -1) { errors.push('Niepoprawna wartość pola "' + k + '": ' + JSON.stringify(a[k])); }
    });
    return { ok: errors.length === 0, errors: errors };
  }

  /* ---------- 3. Etap ---------- */
  // stage = min(react, length); poziom a2 ogranicza etap do 2; zakres 1–4; cel = stage + 1 (max 5).
  function computeStage(a) {
    var react = parseInt(a.react, 10), len = parseInt(a.length, 10);
    var raw = Math.min(react, len);
    var stage = raw, a2Capped = false;
    if (a.level === 'a2' && stage > 2) { stage = 2; a2Capped = true; }
    stage = Math.max(1, Math.min(4, stage));
    return {
      stage: stage,
      goalStage: Math.min(5, stage + 1),
      a2Capped: a2Capped,
      mixedSignals: Math.abs(react - len) >= 2,
      raw: { react: react, length: len, min: raw }
    };
  }

  /* ---------- 4. Szablony tekstu: {{sciezka.do.wartosci}} ---------- */
  function lookup(ctx, path) {
    var parts = path.split('.'), cur = ctx;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined || !Object.prototype.hasOwnProperty.call(cur, parts[i])) { return undefined; }
      cur = cur[parts[i]];
    }
    return cur;
  }
  function fill(str, ctx, unresolved) {
    if (typeof str !== 'string') { return str; }
    return str.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, function (m, path) {
      var v = lookup(ctx, path);
      if (v === undefined || v === null) { if (unresolved) { unresolved.push(path); } return m; }
      return String(v);
    });
  }

  /* ---------- 5. Budowa modelu planu ---------- */
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) { return arr[i]; } } return null; }
  function optionOf(content, qid, value) {
    var q = byId(content.questions, qid);
    if (!q || !q.options) { return null; }
    for (var i = 0; i < q.options.length; i++) { if (q.options[i].value === value) { return q.options[i]; } }
    return null;
  }

  // Imię: tylko tekst, bez znaków sterujących, max 40 znaków. Escapowanie HTML to zadanie renderera (textContent).
  function sanitizeName(v) {
    if (typeof v !== 'string') { return ''; }
    return v.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  function deepFill(o, ctx, unresolved) {
    if (typeof o === 'string') { return fill(o, ctx, unresolved); }
    if (Array.isArray(o)) { return o.map(function (x) { return deepFill(x, ctx, unresolved); }); }
    if (o && typeof o === 'object') { var r = {}; Object.keys(o).forEach(function (k) { r[k] = deepFill(o[k], ctx, unresolved); }); return r; }
    return o;
  }

  function buildPlan(rawAnswers, content, opts) {
    opts = opts || {};
    var a = normalizeAnswers(rawAnswers);
    var v = validateAnswers(a);
    if (!v.ok) { var err = new Error('Niepoprawne odpowiedzi: ' + v.errors.join('; ')); err.details = v.errors; throw err; }

    var flags = Object.assign({}, content.meta.flags, opts.flags || {});
    var bookingUrl = opts.bookingUrl || flags.bookingUrl;
    if (opts.bookingUrl && opts.bookingUrl !== '{{BOOKING_URL}}' && !/^https:\/\//i.test(opts.bookingUrl)) { throw new Error('bookingUrl musi zaczynać się od https://'); }
    var unresolved = [];

    var st = computeStage(a);
    var stage = st.stage;
    var stageObj = byId(content.stages, stage);
    var goalObj = byId(content.stages, st.goalStage);
    var noPartner = a.partner === 'no';
    var useAlt = !!(stageObj.altWhenMind && stageObj.altWhenMind.indexOf(a.mind) !== -1);
    var graduateList = useAlt && stageObj.graduateAlt ? stageObj.graduateAlt : ((noPartner && stageObj.graduateNoPartner) ? stageObj.graduateNoPartner : stageObj.graduate);
    var tableSrc = useAlt && stageObj.tableAlt ? stageObj.tableAlt : stageObj.table;
    var tableRows = tableSrc.map(function (r) { return { dimension: r.dimension, now: r.now, toGraduate: (noPartner && !useAlt && r.toGraduateNoPartner) ? r.toGraduateNoPartner : r.toGraduate }; });
    function pickTech(t) { return noPartner && t.noPartner ? { title: t.noPartnerTitle || t.title, body: t.noPartner } : { title: t.title, body: t.body }; }
    var blockage = content.blockages[a.mind];
    var secondary = a.mind2 !== 'none' ? content.blockages[a.mind2] : null;
    var sit = content.situations[a.situation];
    var goal = content.goals[a.goal];
    var timeObj = content.time[a.time];
    var tok = content.stageTokens;

    // numery stron
    var pg = {};
    content.pageOrder.forEach(function (k, i) { pg[k] = i + 1; });
    Object.keys(content.pageTokenAliases).forEach(function (alias) { pg[alias] = pg[content.pageTokenAliases[alias]]; });

    var timeShortMap = { '5': '5 min', '12': '10–15 min', '20': '20 min' };
    var endGoalBand = stage <= 2 ? 'low' : 'high';

    var ctx = {
      pg: pg,
      stage: stage,
      stageName: stageObj.name,
      goalStage: st.goalStage,
      goalStageName: goalObj.name,
      goalStageSummary: goalObj.summary,
      blockageName: blockage.name,
      secondaryName: secondary ? secondary.name : '',
      situationLabel: sit.label,
      timeShort: timeShortMap[a.time],
      dayHeader: timeObj.dayHeader,
      dayEnd: content.pages.days.dayEndByPartner[a.partner],
      n: tok.sentenceCountWeeks.w1_2,
      recSeconds: tok.recSeconds[String(stage)],
      d3Sec: tok.d3Sec[String(stage)],
      d3Items: tok.d3Items[String(stage)],
      d3QuestionsText: tok.d3QuestionsText[String(stage)],
      d3ItemsThings: tok.d3ItemsThings[String(stage)],
      d3SentencesText: tok.d3SentencesText[String(stage)],
      d3Answer: tok.d3Answer[String(stage)],
      goalCriteria: graduateList.map(function (g) { return g.charAt(0).toLowerCase() + g.slice(1); }).join('; ') + '.',
      startPhrase: sit.startPhrase,
      hardSituations: sit.hardSituations,
      realSituation: sit.realSituation,
      times: (a.time === '5' && tok.timesShort[String(stage)]) ? tok.timesShort[String(stage)] : tok.times[String(stage)],
      liveMinutes: tok.liveMinutes[String(stage)],
      voiceMinutes: tok.voiceMinutes[String(stage)],
      day1Topic: content.day1Topics[a.situation],
      easyQuestions: content.genericQuestions.easy.slice(0, tok.d3Items[String(stage)]).map(function (q) { return q.en; }).join(' · '),
      endGoal: goal.endGoal[endGoalBand],
      firstName: sanitizeName(opts.firstName)
    };
    function F(s) { return fill(s, ctx, unresolved); }

    /* --- 14 dni --- */
    var noBonusDays = [1, 2, 6, 7, 14];
    var days = content.days14.map(function (d) {
      var core, plus, extra = {};
      if (d.day === 3) {
        core = blockage.day3.core; plus = blockage.day3.plus;
      } else if (d.variantsBy === 'partner') {
        var vr = d.variants[a.partner];
        core = vr.core; plus = vr.plus;
        if (vr.aiAddon && flags.allowAiPartner) { core = core + ' ' + vr.aiAddon; }
      } else {
        core = d.core; plus = (flags.audioAvailable && d.plusAudio) ? d.plusAudio : d.plus;
      }
      var item = {
        n: d.day, label: fill(content.pages.days.dayLabel, { n: d.day }), title: d.title, purpose: d.purpose,
        core: F(core),
        plus: timeObj.includesPlus ? F(plus) : null,
        bonus: (timeObj.includesBonus && noBonusDays.indexOf(d.day) === -1) ? timeObj.bonus : null
      };
      if (d.checkpoint) { item.checkpoint = d.checkpoint; }
      return item;
    });
    var checkpoint = days[13].checkpoint;

    /* --- plan miesięczny --- */
    var monthDefs = content.monthlyPlans[String(stage)];
    var months = monthDefs.map(function (m) {
      var title = m.title, items = m.items;
      if (m.alt && m.alt.whenMind.indexOf(a.mind) !== -1) { title = m.alt.title; items = m.alt.items; }
      return {
        label: fill(content.pages.plan90.monthLabel, { n: m.month }),
        title: title,
        items: items.map(function (it) {
          var t = it.text;
          if (flags.audioAvailable && it.textAudio) { t = it.textAudio; }
          if (a.partner === 'no' && it.noPartner) { t = it.noPartner; }
          return F(t);
        })
      };
    });

    /* --- zdania, rozmowa, pytania --- */
    var sentences = sit.sentences.map(function (s, i) { return { n: i + 1, id: s.id, en: s.en, pl: s.pl, priority: i < 5 }; });
    var dialogueLen = stage <= 2 ? 6 : 8;
    var dialogue = sit.dialogue.slice(0, dialogueLen).map(function (l) {
      return { who: l.who, label: l.who === 'you' ? content.pages.dialogue.youLabel : content.pages.dialogue.otherLabel, en: l.en, pl: l.pl };
    });
    var markEasy = stage <= 2;
    var generic = (stage <= 2 ? content.genericQuestions.easy : content.genericQuestions.medium).slice(0, 4);
    var questions = sit.questions.map(function (q) { return { en: q.en, pl: q.pl, easy: markEasy && q.easy === true }; })
      .concat(generic.map(function (q) { return { en: q.en, pl: q.pl, easy: markEasy }; }));

    /* --- notki --- */
    var notes = [];
    if (st.a2Capped) { notes.push(F(content.notes.a2CappedNote)); }
    if (a.level === 'a2') { notes.push(F(noPartner && content.notes.a2NoteNoPartner ? content.notes.a2NoteNoPartner : content.notes.a2Note)); }
    if (st.mixedSignals && !st.a2Capped) { notes.push(content.notes.mixedNote); }
    if (stage === 4 && a.mind === 'translator') { notes.push(content.notes.stage4TranslatorNote); }
    var showSpecialist = content.notes.specialistNoteForMind.indexOf(a.mind) !== -1 ||
                         (a.mind2 !== 'none' && content.notes.specialistNoteForMind.indexOf(a.mind2) !== -1);

    var P0 = content.pages;
    /* --- dziennik: 12 tygodni --- */
    var weekList = [];
    for (var w = 1; w <= P0.journal.weeks; w++) {
      weekList.push({ n: w, label: fill(P0.journal.weekLabel, { n: w }), checkpoint: P0.journal.checkpointWeeks.indexOf(w) !== -1 });
    }

    /* --- CTA --- */
    var ctaDef = content.pages.cta.byInterest[a.interest];

    /* --- strony --- */
    var P = content.pages;
    var stagesMap = content.stages.map(function (s) {
      var state = s.id === stage ? 'here' : (s.id === st.goalStage ? 'goal' : (s.id < stage ? 'past' : 'future'));
      return { id: s.id, name: s.name, state: state };
    });
    var pages = {
      cover: {
        title: P.cover.title,
        subtitle: F(P.cover.subtitleTemplate),
        line: F(P.cover.lineTemplate),
        preparedFor: ctx.firstName ? F(P.cover.preparedFor) : null,
        tiles: P.cover.tiles.map(function (t) { return { value: t.value || F(t.valueTemplate), label: t.label }; }),
        footer: P.cover.footer
      },
      start: {
        title: P.start.title, lead: P.start.lead,
        today: { label: P.start.todayLabel, title: days[0].title, core: days[0].core, plus: days[0].plus },
        afterToday: P.start.afterToday,
        rulesTitle: P.start.rulesTitle, rules: P.start.rules,
        ifThenTitle: P.start.ifThenTitle, ifThenIntro: P.start.ifThenIntro, ifThenLine: P.start.ifThenLine,
        mapTitle: P.start.mapTitle, mapIntro: P.start.mapIntro,
        mapRows: P.start.mapRows.map(function (r) { return { page: pg[r.key], label: r.label }; })
      },
      map: {
        headline: useAlt && stageObj.headlineAlt ? stageObj.headlineAlt : stageObj.headline,
        youAreHere: P.map.youAreHere, goalMarker: P.map.goalMarker,
        stages: stagesMap,
        whatItMeansTitle: F(P.map.whatItMeans),
        summary: useAlt && stageObj.summaryAlt ? stageObj.summaryAlt : (st.a2Capped && stageObj.summaryCapped ? stageObj.summaryCapped : stageObj.summary),
        normalizeLine: content.notes.normalizeLine,
        graduateTitle: stageObj.graduateTitle, graduate: graduateList,
        goalLine: F(P.map.goalLine),
        exampleTitle: P.map.exampleTitle, exampleIntro: P.map.exampleIntro,
        exampleNow: { label: F(P.map.exampleNowLabel), en: stageObj.example.en, note: stageObj.example.note },
        exampleGoal: { label: F(P.map.exampleGoalLabel), en: goalObj.example.en, note: goalObj.example.note },
        notes: notes,
        tooEasyNote: (st.mixedSignals || st.a2Capped) ? null : content.notes.tooEasyNote
      },
      table: {
        title: P.table.title, intro: P.table.intro, colNow: P.table.colNow, colGraduate: P.table.colGraduate,
        rows: tableRows, bottomLineLabel: P.table.bottomLineLabel, bottomLine: stageObj.bottomLine, analogy: stageObj.analogy
      },
      blockage: {
        title: F(P.blockage.titleTemplate), name: blockage.name, description: (stage <= 2 && blockage.descriptionLowStage) ? blockage.descriptionLowStage : blockage.description,
        notDiagnosis: P.blockage.notDiagnosis, techniquesTitle: P.blockage.techniquesTitle,
        techniques: blockage.techniques.map(pickTech),
        bonus: secondary ? { title: F(P.blockage.bonusTitleTemplate), technique: pickTech(secondary.techniques[0]) } : null,
        avoidLabel: P.blockage.avoidLabel, avoid: blockage.avoid,
        specialistNote: showSpecialist ? content.notes.specialistNote : null
      },
      plan90: {
        title: P.plan90.title, goal: F(P.plan90.goalTemplate), disclaimer: content.notes.goalDisclaimer,
        structureTitle: P.plan90.structureTitle, structure: P.plan90.structure.map(F),
        months: months, endGoal: F(P.plan90.endGoalTemplate),
        rhythmTitle: P.plan90.rhythmTitle, rhythm: [timeObj.daily, timeObj.weekly, content.time.monthly]
      },
      days1: { title: P.days.titleTemplate, intro: F(P.days.introTemplate), days: days.slice(0, 7),
               labels: { core: P.days.coreLabel, plus: P.days.plusLabel, bonus: P.days.bonusLabel } },
      days2: { title: P.days.titleTemplate, intro: null, days: days.slice(7, 14), checkpoint: checkpoint,
               labels: { core: P.days.coreLabel, plus: P.days.plusLabel, bonus: P.days.bonusLabel } },
      sentences: { title: P.sentences.title, intro: F(P.sentences.introTemplate), priorityMark: P.sentences.priorityMark,
                   situationLabel: sit.label, sentences: sentences },
      dialogue: { title: P.dialogue.title, intro: F(P.dialogue.introTemplate), lines: dialogue,
                  roundsTitle: P.dialogue.roundsTitle, rounds: P.dialogue.rounds,
                  questionsTitle: P.dialogue.questionsTitle, questionsIntro: P.dialogue.questionsIntro,
                  questionsEasyHint: markEasy ? P.dialogue.questionsEasyHint : null, easyMark: P.dialogue.easyMark, questions: questions },
      rescue: P.rescue,
      journal: { title: P.journal.title, intro: P.journal.intro,
                 weekList: weekList, checkpointLabel: P.journal.checkpointLabel,
                 afterTitle: P.journal.afterTitle, columns: P.journal.columns, note: P.journal.note,
                 criteriaTitle: P.journal.criteriaTitle, criteria: graduateList },
      after14: { title: P.after14.title, intro: F(P.after14.intro),
                 rhythmTitle: P.after14.rhythmTitle, rhythmIntro: F(P.after14.rhythmIntro),
                 rhythm: P.after14.rhythm.map(function (r) { return { name: (noPartner && r.nameNoPartner) ? r.nameNoPartner : r.name, text: F(noPartner && r.noPartner ? r.noPartner : r.text) }; }),
                 monthsTitle: P.after14.monthsTitle, monthsIntro: P.after14.monthsIntro,
                 months: months.map(function (m) { return { label: m.label, title: m.title }; }),
                 materialsTitle: P.after14.materialsTitle, materials: F(P.after14.materials),
                 checkTitle: P.after14.checkTitle, check: F(P.after14.check),
                 retake: P.after14.retake, retakeLabel: P.after14.retakeLabel },
      cta: { title: ctaDef.title || P.cta.title, p1: ctaDef.p1 || P.cta.p1, p2: ctaDef.p2 || P.cta.p2, p3: ctaDef.p3, boxTitle: ctaDef.boxTitle, boxBody: ctaDef.boxBody,
             button: ctaDef.button, emphasis: ctaDef.emphasis, bookingUrl: bookingUrl, closing: P.cta.closing }
    };

    return {
      contentVersion: content.meta.contentVersion,
      code: encodeAnswers(a),
      answers: a,
      stage: stage, goalStage: st.goalStage,
      summary: { stage: stage, stageName: stageObj.name, goalStage: st.goalStage, goalStageName: goalObj.name, blockageName: blockage.name, secondaryName: secondary ? secondary.name : null },
      flags: { a2Capped: st.a2Capped, mixedSignals: st.mixedSignals, altStage4: !!useAlt, showSpecialistNote: showSpecialist },
      pageOrder: content.pageOrder.slice(),
      pages: deepFill(content.pageOrder.map(function (k) { return { key: k, number: pg[k], data: pages[k] }; }), ctx, unresolved),
      unresolved: unresolved
    };
  }

  /* ---------- 6. Kod wyniku (do linku: #r=v1XXXXXXXXXX) ---------- */
  function encodeAnswers(rawAnswers) {
    var a = normalizeAnswers(rawAnswers), s = CODE_VERSION;
    KEYS.forEach(function (k) {
      var i = ENUMS[k].indexOf(a[k]);
      if (i === -1) { throw new Error('encodeAnswers: niepoprawna wartość pola ' + k); }
      s += i.toString(36);
    });
    return s;
  }
  function decodeAnswers(code) {
    if (typeof code === 'string') { code = code.toLowerCase(); }
    if (typeof code !== 'string' || code.indexOf(CODE_VERSION) !== 0 || code.length !== CODE_VERSION.length + KEYS.length) { return null; }
    var body = code.slice(CODE_VERSION.length), a = {};
    for (var j = 0; j < KEYS.length; j++) {
      var i = parseInt(body.charAt(j), 36);
      if (isNaN(i) || i >= ENUMS[KEYS[j]].length) { return null; }
      a[KEYS[j]] = ENUMS[KEYS[j]][i];
    }
    var n = normalizeAnswers(a);
    if (!validateAnswers(n).ok) { return null; }
    return encodeAnswers(n) === code ? n : null;   // tylko kody kanoniczne
  }

  /* ---------- 6b. Walidacja treści (uruchamiaj w testach/CI) ---------- */
  /* Stary format linku (?p=situation-mind-level-react-length-goal-time, 7 części, ze znakami "-") z maili już wysłanych.
     Brakujące odpowiedzi dostają wartości domyślne: mind2 = none, partner = maybe, interest = later. */
  function decodeLegacyCode(code) {
    if (typeof code !== 'string') { return null; }
    var parts = code.split('-');
    var keys = ['situation', 'mind', 'level', 'react', 'length', 'goal', 'time'];
    if (parts.length !== keys.length) { return null; }
    var a = { mind2: 'none', partner: 'maybe', interest: 'later' };
    keys.forEach(function (k, i) { a[k] = parts[i]; });
    var n = normalizeAnswers(a);
    return validateAnswers(n).ok ? n : null;
  }
  /* Jeden punkt wejścia dla parametru ?p=: nowy kod (v1…) albo stary format. Zwraca odpowiedzi lub null. */
  function decodeAnyCode(code) {
    if (typeof code !== 'string') { return null; }
    return code.indexOf('-') !== -1 ? decodeLegacyCode(code) : decodeAnswers(code);
  }

  function validateContent(c) {
    var errs = [];
    function need(cond, msg) { if (!cond) { errs.push(msg); } }
    KEYS.forEach(function (k) {
      var q = byId(c.questions, k); need(!!q, 'brak pytania ' + k); if (!q || !q.options) { return; }
      var vals = q.options.map(function (o) { return o.value; });
      ENUMS[k].forEach(function (v) { if (v !== 'none') { need(vals.indexOf(v) !== -1, 'pytanie ' + k + ': brak opcji ' + v); } });
      vals.forEach(function (v) { need(ENUMS[k].indexOf(v) !== -1, 'pytanie ' + k + ': nieznana opcja ' + v); });
    });
    ENUMS.situation.forEach(function (s) { var x = c.situations[s]; need(!!x, 'brak sytuacji ' + s); if (!x) { return;} need(x.sentences.length === 12, s + ': zdań ≠ 12'); need(x.dialogue.length === 8, s + ': dialog ≠ 8'); need(x.questions.length === 6, s + ': pytań ≠ 6'); need(!!c.day1Topics[s], 'brak day1Topics.' + s); });
    ENUMS.mind.forEach(function (m) { var b = c.blockages[m]; need(!!b, 'brak blokady ' + m); if (b) { need(b.techniques.length === 3, m + ': technik ≠ 3'); need(!!(b.day3 && b.day3.core && b.day3.plus), m + ': brak day3'); } });
    ENUMS.goal.forEach(function (g) { need(!!(c.goals[g] && c.goals[g].endGoal && c.goals[g].endGoal.low && c.goals[g].endGoal.high), 'brak celu ' + g); });
    ENUMS.time.forEach(function (t) { need(!!c.time[t], 'brak time.' + t); });
    ['1', '2', '3', '4'].forEach(function (s) { var m = c.monthlyPlans[s]; need(!!m && m.length === 3, 'plan miesięczny ' + s + ': ≠ 3 miesiące'); if (m) { m.forEach(function (x) { need(x.items.length === 3, 'plan ' + s + ' miesiąc ' + x.month + ': pozycji ≠ 3'); }); } });
    need(c.days14.length === 14, 'days14 ≠ 14');
    need(c.stages.length === 5, 'stages ≠ 5');
    var po = c.pageOrder; need(po.length === 14 && po.filter(function (k, i) { return po.indexOf(k) === i; }).length === 14, 'pageOrder: 14 unikalnych kluczy');
    ['cover','start','map','table','blockage','plan90','days1','days2','sentences','dialogue','rescue','journal','after14','cta'].forEach(function (k) { need(po.indexOf(k) !== -1 && !!(c.pages[k] || (/^days[12]$/.test(k) && c.pages.days)), 'brak strony ' + k); });   // days1 i days2 korzystają ze wspólnego pages.days
    return { ok: errs.length === 0, errors: errs };
  }

  /* ---------- 7. Pomocnik dla interfejsu: opcje pytania przy bieżących odpowiedziach ---------- */
  function questionOptions(content, qid, answersSoFar) {
    var q = byId(content.questions, qid);
    if (!q) { return []; }
    if (qid === 'mind2') {
      var mq = byId(content.questions, 'mind');
      return mq.options.filter(function (o) { return o.value !== (answersSoFar || {}).mind; })
        .map(function (o) { return { value: o.value, label: o.label }; })
        .concat([{ value: q.noneOption.value, label: q.noneOption.label }]);
    }
    return q.options.map(function (o) { return { value: o.value, label: o.label }; });
  }

  return {
    ENUMS: ENUMS, KEYS: KEYS,
    normalizeAnswers: normalizeAnswers, validateAnswers: validateAnswers,
    computeStage: computeStage, buildPlan: buildPlan,
    encodeAnswers: encodeAnswers, decodeAnswers: decodeAnswers, decodeLegacyCode: decodeLegacyCode, decodeAnyCode: decodeAnyCode,
    questionOptions: questionOptions, validateContent: validateContent, fill: fill
  };
}));
