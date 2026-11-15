// Die drei Lernspiele: Finish-Wege, Ich werde Caller, Dart-Quiz.
import { h, icon } from '../ui.js';
import { sound } from '../sound.js';
import { fieldPad, numPad, dartValue, dartLabel } from '../pads.js';
import { rpick, rshuffle } from '../rng.js';
import { interactiveBoard } from './iboard.js';
import { finishPool, pathStatus, solution } from './finishmath.js';
import { DIFFS, timeBar, tracker, fmtSec } from './common.js';
import { loadQuiz, CAT_COLORS } from './quizdata.js';

const chipsOf = keys => keys.length ? keys.map(dartLabel).join(' · ') : ' ';

// ======================= Finish-Wege =======================
export function runFinish({ root, cfg, rng, onDone, setCleanup }) {
  const pool = finishPool(cfg.min, cfg.max);
  const tasks = [];
  for (let i = 0, prev = null; i < cfg.rounds; i++) { let n; do { n = rpick(rng, pool); } while (n === prev && pool.length > 1); tasks.push(n); prev = n; }
  const tr = tracker(cfg.rounds);
  const bar = timeBar();
  const ib = interactiveBoard({ onPick: k => pick(k) });
  const pad = fieldPad({ onDart: k => pick(k) });
  let i = 0, keys = [], done = false, mode = cfg.input, autoT = null;

  const el = {
    head: h('div', { class: 'lg-head' }), rest: h('div', { class: 'big lg-rest' }), sub: h('div', { class: 'label' }),
    chips: h('div', { class: 'lg-chips' }), fb: h('div', { class: 'lg-feedback' }),
    inputBox: h('div', { class: 'lg-input' }),
    undo: h('button', { class: 'btn ghost small', 'data-key': 'Backspace', onClick: () => { if (!done && keys.length) { keys.pop(); ib.clearDarts(); keys.forEach(k => ib.throwDart(k)); paint(); } } }, icon('undo'), 'Undo'),
    toggle: h('button', { class: 'btn ghost small', onClick: () => { mode = mode === 'board' ? 'keys' : 'board'; paintInput(); } }),
    next: h('button', { class: 'btn primary', 'data-key': 'Enter', onClick: () => next() }, 'Weiter'),
  };
  const paintInput = () => {
    el.inputBox.replaceChildren(mode === 'board' ? ib.el : pad);
    el.toggle.textContent = mode === 'board' ? 'Feld-Tastatur' : 'Dartboard';
  };
  root.replaceChildren(h('div', { class: 'game learn-game' },
    h('div', { class: 'stage lg-stage' }, el.head, bar.el, el.sub, el.rest, el.chips, el.fb),
    h('div', { class: 'controls' }, el.inputBox, h('div', { class: 'btn-row' }, el.undo, el.toggle, el.next))));
  paintInput();

  function paint() {
    el.head.replaceChildren(h('span', {}, `Aufgabe ${i + 1}/${cfg.rounds}`), h('span', { class: 'lg-score' }, `✓ ${tr.correct}`), h('span', {}, tr.streak >= 2 ? `🔥 ${tr.streak}` : ''));
    el.rest.textContent = tasks[i];
    el.sub.textContent = 'Checke mit möglichst wenigen Darts';
    el.chips.textContent = chipsOf(keys);
    el.next.style.visibility = done ? 'visible' : 'hidden';
    el.undo.disabled = done || !keys.length;
  }
  function startTask() {
    keys = []; done = false; clearTimeout(autoT);
    ib.clearDarts(); ib.unmarkAll();
    el.fb.className = 'lg-feedback'; el.fb.textContent = ' ';
    paint();
    bar.start(DIFFS[cfg.diff].sec * 1000, () => finishTask(false, true));
  }
  function pick(k) {
    if (done) return;
    keys.push(k);
    if (mode === 'board') ib.throwDart(k);
    const st = pathStatus(tasks[i], keys);
    if (st === 'ok') finishTask(true);
    else if (st === 'wrong') finishTask(false);
    else { sound.play('tap'); paint(); }
  }
  function finishTask(ok, timeout = false) {
    if (done) return;
    done = true;
    const ms = timeout ? DIFFS[cfg.diff].sec * 1000 : bar.stop();
    if (timeout) bar.stop();
    tr.add(ok, ms, { n: tasks[i] });
    const sol = solution(tasks[i]);
    sound.play(ok ? 'hit' : 'miss');
    el.fb.className = `lg-feedback ${ok ? 'ok' : 'bad'}`;
    el.fb.replaceChildren(ok
      ? h('span', {}, `Richtig! ✓ ${fmtSec(ms)}`)
      : h('span', {}, timeout ? 'Zeit abgelaufen – ' : 'Falsch – ', 'richtig z. B.: ', h('b', {}, sol.map(dartLabel).join(' · '))));
    if (!ok) sol.forEach(k => ib.mark(k, 'ib-good'));
    paint();
    if (ok) autoT = setTimeout(next, 900);
  }
  function next() {
    clearTimeout(autoT);
    if (!done) return;
    i++;
    if (i >= tasks.length) {
      const errors = {};
      tr.items.filter(x => !x.ok).forEach(x => { errors[x.n] = (errors[x.n] || 0) + 1; });
      return onDone({ points: tr.correct, total: tr.total, avgMs: tr.avgMs(), totalMs: tr.totalMs(), bestStreak: tr.bestStreak, errors });
    }
    startTask();
  }
  setCleanup(() => { bar.stop(); clearTimeout(autoT); });
  startTask();
}

// ======================= Ich werde Caller =======================
// Werfer-Typen: amateur = wild übers Board, gut = Scoring-Bereich mit Ausreißern (7, 1, 5 …), leek = immer straight T20/T19
export const THROWERS = {
  amateur: { label: 'Amateur', desc: 'Komplett verrückte Würfe – überall auf dem Board, auch mal daneben.' },
  gut: { label: 'Gut', desc: 'Standard-Würfe in 20 und 19 – aber oft auch mal 1, 5, 7 oder 3.' },
  leek: { label: 'The Leek', desc: 'Einfachster Modus: wirft immer straight gute Zahlen (20er und 19er).' },
};
function callerDart(rng, level = 'gut') {
  const r = rng();
  const ring = (t, d) => { const q = rng(); return q < t ? 'T' : q < t + d ? 'D' : 'S'; };
  if (level === 'leek') {
    const num = r < .75 ? 20 : 19;
    return `${rng() < .55 ? 'T' : 'S'}${num}`;
  }
  if (level === 'amateur') {
    if (r < .12) return 'MISS';
    if (r < .18) return rng() < .3 ? '50' : '25';
    const num = r < .4 ? [20, 1, 5][Math.floor(rng() * 3)] : 1 + Math.floor(rng() * 20);
    return `${ring(.1, .12)}${num}`;
  }
  // gut
  const w = (a, b, c) => { const x = rng(); return x < .5 ? a : x < .75 ? b : c; };
  if (r < .07) return rng() < .35 ? '50' : '25';
  if (r < .09) return 'MISS';
  const num = r < .56 ? w(20, 1, 5) : r < .9 ? w(19, 7, 3) : 1 + Math.floor(rng() * 20);
  return `${ring(.2, .07)}${num}`;
}

export function runCaller({ root, cfg, rng, onDone, setCleanup }) {
  const tasks = Array.from({ length: cfg.rounds }, () => [callerDart(rng, cfg.thrower), callerDart(rng, cfg.thrower), callerDart(rng, cfg.thrower)]);
  const tr = tracker(cfg.rounds);
  const bar = timeBar();
  const ib = interactiveBoard();
  let i = 0, input = '', phase = 'throw', timers = [], autoT = null;

  const el = {
    head: h('div', { class: 'lg-head' }), sum: h('div', { class: 'x01-input' }), fb: h('div', { class: 'lg-feedback' }),
    next: h('button', { class: 'btn primary small fb-next', 'data-key': 'Enter', onClick: () => next() }, 'Weiter'),
  };
  const pad = numPad({
    onDigit: d => { if (phase !== 'input' || (input + d).length > 3) return; input = (input + d).replace(/^0+(?=\d)/, ''); paint(); },
    onBack: () => { if (phase === 'input') { input = input.slice(0, -1); paint(); } },
    onOk: () => { if (phase === 'input') answer(false); },
  });
  root.replaceChildren(h('div', { class: 'game learn-game' },
    h('div', { class: 'stage lg-stage' }, el.head, bar.el, h('div', { class: 'lg-board-sm' }, ib.el), el.sum, el.fb),
    h('div', { class: 'controls' }, pad)));

  function paint() {
    el.head.replaceChildren(h('span', {}, `Aufnahme ${i + 1}/${cfg.rounds}`), h('span', { class: 'lg-score' }, `✓ ${tr.correct}`), h('span', {}, tr.streak >= 2 ? `🔥 ${tr.streak}` : ''));
    el.sum.replaceChildren(h('span', { class: 'lbl' }, phase === 'throw' ? 'Darts fliegen …' : 'Summe'), h('span', { class: `val${input ? '' : ' empty'}` }, input || '0'));
    pad.classList.toggle('locked', phase !== 'input');
  }
  function startTask() {
    phase = 'throw'; input = ''; clearTimeout(autoT);
    ib.clearDarts(); ib.unmarkAll(); bar.idle();
    el.fb.className = 'lg-feedback'; el.fb.textContent = ' ';
    paint();
    tasks[i].forEach((k, n) => timers.push(setTimeout(() => { ib.throwDart(k, rng); sound.play('tap'); }, 350 + n * cfg.interval)));
    timers.push(setTimeout(() => {
      phase = 'input'; paint();
      bar.start(DIFFS[cfg.diff].sec * 1000, () => answer(true));
    }, 350 + 2 * cfg.interval + 420));
  }
  function answer(timeout) {
    if (phase !== 'input') return;
    phase = 'result';
    const ms = timeout ? DIFFS[cfg.diff].sec * 1000 : bar.stop();
    if (timeout) bar.stop();
    const total = tasks[i].reduce((a, k) => a + dartValue(k), 0);
    const ok = !timeout && Number(input || -1) === total;
    tr.add(ok, ms, { total });
    sound.play(ok ? 'hit' : 'miss');
    tasks[i].forEach(k => { if (k !== 'MISS') ib.mark(k, 'ib-good'); });
    el.fb.className = `lg-feedback ${ok ? 'ok' : 'bad'}`;
    el.fb.replaceChildren(h('span', {}, ok ? `Richtig! ${fmtSec(ms)} · ` : timeout ? 'Zeit abgelaufen · ' : `Falsch (${input || '–'}) · `),
      h('b', {}, `${total}`), h('span', {}, ` = ${tasks[i].map(dartLabel).join(' + ')}`), el.next);
    paint();
    if (ok) autoT = setTimeout(next, 1100);
  }
  function next() {
    clearTimeout(autoT);
    if (phase !== 'result') return;
    i++;
    if (i >= tasks.length) return onDone({ points: tr.correct, total: tr.total, avgMs: tr.avgMs(), totalMs: tr.totalMs(), bestStreak: tr.bestStreak });
    startTask();
  }
  setCleanup(() => { timers.forEach(clearTimeout); bar.stop(); clearTimeout(autoT); });
  startTask();
}

// ======================= Dart-Quiz =======================
export async function runQuiz({ root, cfg, rng, onDone }) {
  const data = await loadQuiz();
  const cats = cfg.cats?.length ? cfg.cats : Object.keys(data.categories);
  const pool = data.questions.filter(q => cats.includes(q.cat));
  const qs = rshuffle(rng, pool).slice(0, Math.min(cfg.rounds, pool.length)).map(q => ({ ...q, answers: rshuffle(rng, [q.a, ...q.wrong]) }));
  if (!qs.length) { root.replaceChildren(h('p', { class: 'empty' }, 'Keine Fragen in den gewählten Kategorien.')); return; }
  const tr = tracker(qs.length);
  const perCat = {};
  let i = 0, t0 = 0, answered = false;

  function render() {
    const q = qs[i];
    answered = false; t0 = performance.now();
    const fb = h('div', { class: 'lg-feedback' }, ' ');
    const next = h('button', { class: 'btn primary', 'data-key': 'Enter', style: { visibility: 'hidden' }, onClick: () => { i++; i >= qs.length ? done() : render(); } }, i + 1 >= qs.length ? 'Auswertung' : 'Nächste Frage');
    const btns = q.answers.map((a, k) => h('button', { class: 'qz-answer', 'data-key': String(k + 1), 'data-snd': 'none', onClick: () => choose(k) },
      h('span', { class: 'qz-letter' }, 'ABCD'[k]), h('span', {}, a)));
    function choose(k) {
      if (answered) return;
      answered = true;
      const ok = q.answers[k] === q.a;
      const ms = performance.now() - t0;
      tr.add(ok, ms, { cat: q.cat, id: q.id });
      score.textContent = `✓ ${tr.correct}`;
      const c = perCat[q.cat] || (perCat[q.cat] = [0, 0]); c[0]++; if (ok) c[1]++;
      sound.play(ok ? 'hit' : 'miss');
      btns.forEach((b, j) => { b.disabled = true; if (q.answers[j] === q.a) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      fb.className = `lg-feedback ${ok ? 'ok' : 'bad'}`;
      fb.textContent = ok ? 'Richtig! ✓' : `Leider falsch – richtig: ${q.a}`;
      next.style.visibility = 'visible';
      bar.style.width = `${((i + 1) / qs.length) * 100}%`;
    }
    const bar = h('i', { style: { width: `${(i / qs.length) * 100}%` } });
    const score = h('span', { class: 'lg-score' }, `✓ ${tr.correct}`);
    root.replaceChildren(h('div', { class: 'game learn-game' },
      h('div', { class: 'scroll' },
        h('div', { class: 'lg-head' }, h('span', {}, `Frage ${i + 1}/${qs.length}`), score, h('span', {}, tr.streak >= 2 ? `🔥 ${tr.streak}` : '')),
        h('div', { class: 'progress' }, bar),
        h('div', { class: 'qz-card' },
          h('span', { class: 'qz-cat', style: { background: CAT_COLORS[q.cat] || 'var(--leek)' } }, data.categories[q.cat] || q.cat),
          h('div', { class: 'qz-q' }, q.q)),
        h('div', { class: 'qz-answers' }, btns),
        fb),
      h('div', { class: 'controls' }, next)));
  }
  function done() {
    onDone({ points: tr.correct, total: tr.total, avgMs: tr.avgMs(), totalMs: tr.totalMs(), bestStreak: tr.bestStreak, perCat });
  }
  render();
}
