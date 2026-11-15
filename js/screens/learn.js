// „Darts lernen“: Hub, Einstellungen, Ergebnis, 1vs1 per Code/Link (gleiche Aufgaben durch Seed).
import { h, iconBtn, gameTile, segmented, stepper, rangeSlider, confirmDialog, toast } from '../ui.js';
import { sound } from '../sound.js';
import { store, uid } from '../store.js';
import { makeRng } from '../rng.js';
import { DIFFS, diffOptions, fmtSec } from '../learn/common.js';
import { runFinish, runCaller, runQuiz, THROWERS } from '../learn/games.js';
import { loadQuiz } from '../learn/quizdata.js';
import { checkBadges } from '../badges.js';

export const LEARN_GAMES = {
  finish: { name: 'Finish-Wege', glyph: '✓', desc: 'Restzahl auschecken – mit minimal vielen Darts.', run: runFinish, timed: true },
  caller: { name: 'Ich werde Caller', glyph: '🎙', desc: '3 Darts fliegen ein – Summe ansagen.', run: runCaller, timed: true },
  quiz: { name: 'Dart-Quiz', glyph: '?', desc: 'Spieler, Turniere, Regeln, Checkouts.', run: runQuiz, timed: false },
};

// Einstellungen ↔ URL-Parameter
const toParams = (game, c) => {
  const p = { spiel: game, runden: c.rounds };
  if (game !== 'quiz') p.stufe = c.diff;
  if (game === 'finish') { p.von = c.min; p.bis = c.max; }
  if (game === 'caller') { p.takt = c.interval; p.werfer = c.thrower; }
  if (game === 'quiz' && c.cats?.length) p.kat = c.cats.join(',');
  return p;
};
const fromParams = (p, s) => ({
  game: p.get('spiel'),
  cfg: {
    diff: DIFFS[p.get('stufe')] ? p.get('stufe') : s.learnDiff,
    rounds: Math.min(50, Math.max(1, Number(p.get('runden')) || s.learnRounds)),
    min: Number(p.get('von')) || s.finishMin, max: Number(p.get('bis')) || s.finishMax,
    interval: Number(p.get('takt')) || s.callerMs,
    thrower: THROWERS[p.get('werfer')] ? p.get('werfer') : s.callerThrower,
    cats: p.get('kat') ? p.get('kat').split(',') : [],
    input: s.finishInput,
  },
});
const seedKey = (code, game, cfg) => [code, ...Object.entries(toParams(game, cfg)).map(([k, v]) => `${k}=${v}`)].join('|');
const appUrl = () => `${location.origin}${location.pathname}`;
const duelUrl = (code, game, cfg, res = null) => {
  const q = new URLSearchParams({ vs: code, ...toParams(game, cfg) });
  if (res) q.set('res', btoa(unescape(encodeURIComponent(JSON.stringify(res)))));
  return `${appUrl()}?${q}`;
};
const decodeRes = s => { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; } };

async function share(text, url) {
  if (navigator.share) { try { await navigator.share({ title: 'Darttraining mit The Leek', text, url }); return; } catch { /* abgebrochen */ } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link kopiert ✓'); } catch { prompt('Link kopieren:', url); }
}

export function learnFlow(app) {
  const s = () => store.settings;
  let cleanup = null;
  const stopGame = () => { cleanup?.(); cleanup = null; };

  // ---------- Hub ----------
  function hub() {
    stopGame();
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', app.home), h('h2', {}, 'Darts lernen', h('span', { class: 'sub' }, 'Rechnen, Wissen, Duelle'))),
      h('div', { class: 'scroll' },
        h('div', { class: 'tile-grid' }, Object.entries(LEARN_GAMES).map(([id, g]) => gameTile({ glyph: g.glyph, title: g.name, desc: g.desc, onClick: () => setup(id) }))),
        h('button', { class: 'btn ghost', style: { width: '100%', marginTop: '14px' }, onClick: joinByCode }, '1vs1-Code eingeben'))),
    { back: app.home });
  }

  // ---------- Einstellungen ----------
  async function setup(game, preset = null) {
    const st = s();
    const c = preset || { diff: st.learnDiff, rounds: game === 'quiz' ? st.quizCount : st.learnRounds, min: st.finishMin, max: st.finishMax, interval: st.callerMs, thrower: st.callerThrower, input: st.finishInput, cats: [...st.quizCats] };
    const g = LEARN_GAMES[game];
    const fields = [];
    if (g.timed) fields.push(h('div', { class: 'field col' }, h('div', { class: 'f-label' }, 'Schwierigkeit', h('small', {}, 'Zeit pro Aufgabe')), segmented(diffOptions(), c.diff, v => { c.diff = v; })));
    fields.push(h('div', { class: 'field' }, h('div', { class: 'f-label' }, game === 'quiz' ? 'Fragen' : 'Runden', h('small', {}, 'bis 50')), stepper(c.rounds, { min: 1, max: 50 }, v => { c.rounds = v; })));
    if (game === 'finish') {
      fields.push(h('div', { class: 'field col' }, h('div', { class: 'f-label' }, 'Zahlenbereich'), rangeSlider({ min: 2, max: 170, from: c.min, to: c.max, onChange: (a, b) => { c.min = a; c.max = b; } })));
      fields.push(h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Eingabe'), segmented([['board', 'Dartboard'], ['keys', 'Feld-Tastatur']], c.input, v => { c.input = v; })));
    }
    if (game === 'caller') {
      const tDesc = h('small', {}, THROWERS[c.thrower].desc);
      fields.push(h('div', { class: 'field col' }, h('div', { class: 'f-label' }, 'Werfer', tDesc),
        segmented(Object.entries(THROWERS).map(([k, t]) => [k, t.label]), c.thrower, v => { c.thrower = v; tDesc.textContent = THROWERS[v].desc; })));
    }
    if (game === 'caller') fields.push(h('div', { class: 'field col' }, h('div', { class: 'f-label' }, 'Abstand der Darts'),
      segmented([[300, '0,3s'], [600, '0,6s'], [1000, '1s'], [1500, '1,5s'], [2000, '2s'], [3000, '3s']], c.interval, v => { c.interval = v; })));
    if (game === 'quiz') {
      const data = await loadQuiz();
      const chips = h('div', { class: 'chip-row' });
      const paint = () => chips.replaceChildren(...Object.entries(data.categories).map(([k, l]) =>
        h('button', { class: `chip-btn${!c.cats.length || c.cats.includes(k) ? ' on' : ''}`, onClick: () => {
          const all = Object.keys(data.categories);
          let cur = c.cats.length ? [...c.cats] : [...all];
          cur = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k];
          c.cats = cur.length === all.length || !cur.length ? [] : cur; paint();
        } }, l)));
      paint();
      fields.push(h('div', { class: 'field col' }, h('div', { class: 'f-label' }, 'Kategorien'), chips));
    }
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', hub), h('h2', {}, g.name, h('span', { class: 'sub' }, g.desc))),
      h('div', { class: 'scroll stack', style: { paddingTop: '6px' } }, h('div', { class: 'card' }, fields)),
      h('div', { class: 'controls' },
        h('button', { class: 'btn huge primary', 'data-key': 'Enter', 'data-snd': 'start', onClick: () => play(game, c, null) }, 'Allein spielen'),
        h('button', { class: 'btn ghost', onClick: () => createDuel(game, c) }, '⚔️ 1vs1 erstellen'))),
    { back: hub });
  }

  // ---------- 1vs1 ----------
  function nameField() {
    const inp = h('input', { class: 'text-input', placeholder: 'Dein Name', value: s().learnName || '', maxlength: 16 });
    inp.addEventListener('input', () => store.saveSettings({ ...s(), learnName: inp.value.trim() }));
    return inp;
  }
  function createDuel(game, cfg) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const url = duelUrl(code, game, cfg);
    const g = LEARN_GAMES[game];
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', () => setup(game, cfg)), h('h2', {}, '1vs1 erstellen', h('span', { class: 'sub' }, `${g.name}${g.timed ? ` · ${DIFFS[cfg.diff].label}` : ''} · ${cfg.rounds} Runden`))),
      h('div', { class: 'scroll stack' },
        h('div', { class: 'card', style: { textAlign: 'center' } },
          h('div', { class: 'label' }, 'Duell-Code'),
          h('div', { class: 'duel-code' }, code),
          h('p', { class: 'muted small-text' }, 'Beide bekommen exakt dieselben Aufgaben. Schick den Link an deinen Gegner – oder er gibt Code und Einstellungen manuell ein.'),
          h('button', { class: 'btn primary', onClick: () => share(`Darts-Duell ⚔️ ${g.name} – Code ${code}. Schlag mich!`, url) }, 'Einladung teilen')),
        h('div', { class: 'card' }, h('div', { class: 'label', style: { marginBottom: '8px' } }, 'Dein Name'), nameField())),
      h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-key': 'Enter', 'data-snd': 'start', onClick: () => play(game, cfg, { code }) }, 'Jetzt spielen'))),
    { back: () => setup(game, cfg) });
  }

  function joinByCode() {
    const codeIn = h('input', { class: 'text-input', inputmode: 'numeric', maxlength: 4, placeholder: '4-stelliger Code' });
    let game = 'finish';
    const st = s();
    const c = { diff: st.learnDiff, rounds: st.learnRounds, min: st.finishMin, max: st.finishMax, interval: st.callerMs, thrower: st.callerThrower, input: st.finishInput, cats: [] };
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', hub), h('h2', {}, '1vs1 beitreten', h('span', { class: 'sub' }, 'Code und gleiche Einstellungen wie dein Gegner'))),
      h('div', { class: 'scroll stack' },
        h('div', { class: 'card stack' },
          h('div', { class: 'label' }, 'Code'), codeIn,
          h('div', { class: 'label' }, 'Spiel'), segmented(Object.entries(LEARN_GAMES).map(([k, g]) => [k, g.name]), game, v => { game = v; }),
          h('div', { class: 'label' }, 'Schwierigkeit'), segmented(diffOptions(), c.diff, v => { c.diff = v; }),
          h('div', { class: 'label' }, 'Werfer (nur Caller)'), segmented(Object.entries(THROWERS).map(([k, t]) => [k, t.label]), c.thrower, v => { c.thrower = v; }),
          h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Runden'), stepper(c.rounds, { min: 1, max: 50 }, v => { c.rounds = v; })),
          h('p', { class: 'muted small-text' }, 'Tipp: Mit dem Einladungslink wird alles automatisch übernommen.')),
        h('div', { class: 'card' }, h('div', { class: 'label', style: { marginBottom: '8px' } }, 'Dein Name'), nameField())),
      h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-key': 'Enter', onClick: () => {
        const code = codeIn.value.trim();
        if (!/^\d{4}$/.test(code)) { toast('Bitte 4-stelligen Code eingeben'); return; }
        if (game === 'quiz') c.rounds = Math.min(c.rounds, 50);
        play(game, c, { code });
      } }, 'Duell starten'))),
    { back: hub });
  }

  // ---------- Spielen ----------
  function play(game, cfg, duel) {
    stopGame();
    const g = LEARN_GAMES[game];
    const root = h('div', { class: 'game' });
    const seed = duel ? seedKey(duel.code, game, cfg) : `${Date.now()}-${Math.random()}`;
    const exit = async () => { if (await confirmDialog({ title: 'Spiel abbrechen?', text: 'Diese Runde wird nicht gewertet.', ok: 'Abbrechen', cancel: 'Weiterspielen', danger: true })) { stopGame(); setup(game, cfg); } };
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, h('h2', {}, g.name, h('span', { class: 'sub' }, `${duel ? `⚔️ Duell ${duel.code} · ` : ''}${g.timed ? `${DIFFS[cfg.diff].label} · ` : ''}${game === 'caller' ? `Werfer ${THROWERS[cfg.thrower].label} · ` : ''}${cfg.rounds} Runden`)), iconBtn('close', 'Beenden', exit)),
      root),
    { back: exit });
    g.run({ root, cfg, rng: makeRng(seed), setCleanup: fn => { cleanup = fn; }, onDone: res => { stopGame(); result(game, cfg, duel, res); } });
  }

  // ---------- Ergebnis ----------
  function result(game, cfg, duel, res) {
    const g = LEARN_GAMES[game];
    const quote = res.total ? Math.round((res.points / res.total) * 100) : 0;
    store.log('learnRuns', { id: uid(), date: Date.now(), game, diff: g.timed ? cfg.diff : null, rounds: cfg.rounds, points: res.points, total: res.total, quote, avgMs: res.avgMs, totalMs: res.totalMs, bestStreak: res.bestStreak, errors: res.errors, perCat: res.perCat, duel: duel?.code || null });
    sound.play(quote >= 80 ? 'record' : 'finish');
    setTimeout(checkBadges, 800);
    let duelInfo = null;
    if (duel) {
      const key = seedKey(duel.code, game, cfg);
      const me = { n: s().learnName || 'Ich', p: res.points, t: res.totalMs };
      const d = store.saveDuel(key, { code: duel.code, game, cfg: toParams(game, cfg), me, date: Date.now() });
      duelInfo = { key, d, me };
    }
    const errs = res.errors ? Object.entries(res.errors).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, h('h2', {}, g.name, h('span', { class: 'sub' }, duel ? `Duell ${duel.code}` : 'Auswertung'))),
      h('div', { class: 'scroll' },
        h('div', { class: 'stage', style: { flex: 'none' } },
          h('div', { class: 'big medium leek' }, `${res.points}/${res.total}`),
          h('div', { class: 'label' }, `Trefferquote ${quote}%`),
          h('div', { class: 'statline', style: { marginTop: '10px' } },
            h('div', { class: 'stat' }, h('b', {}, fmtSec(res.avgMs)), h('span', {}, 'Ø Antwortzeit')),
            h('div', { class: 'stat green' }, h('b', {}, res.bestStreak), h('span', {}, 'Beste Serie')),
            h('div', { class: 'stat' }, h('b', {}, fmtSec(res.totalMs)), h('span', {}, 'Gesamtzeit')))),
        errs.length ? h('div', { class: 'card' }, h('h3', {}, 'Fehler bei'), h('div', { class: 'weak-list' }, errs.map(([n, c]) => h('div', { class: 'weak bad' }, h('b', {}, n), h('span', {}, `${c}× falsch`))))) : null,
        duelInfo ? duelCard(duelInfo, game, cfg) : null),
      h('div', { class: 'controls' },
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost', onClick: () => play(game, cfg, null) }, 'Nochmal'),
          h('button', { class: 'btn primary', 'data-key': 'Enter', onClick: hub }, 'Weiter')))),
    { back: hub });
  }

  function duelCard({ d, me }, game, cfg) {
    const url = duelUrl(d.code, game, cfg, me);
    return h('div', { class: 'card', style: { marginTop: '12px' } },
      h('h3', {}, '⚔️ Duell'),
      d.opp ? compareView(d) : h('p', { class: 'muted' }, 'Schick dein Ergebnis an deinen Gegner. Sobald er gespielt hat und dir seinen Link schickt, siehst du hier den Vergleich.'),
      h('button', { class: 'btn primary', style: { width: '100%', marginTop: '10px' }, onClick: () => share(`Mein Ergebnis im Darts-Duell ${d.code}: ${me.p} Punkte in ${fmtSec(me.t)}. Jetzt du!`, url) }, 'Ergebnis teilen'));
  }

  function compareView(d) {
    const a = d.me, b = d.opp;
    const win = a.p !== b.p ? (a.p > b.p ? 'me' : 'opp') : a.t !== b.t ? (a.t < b.t ? 'me' : 'opp') : null;
    return h('div', { class: 'duel-compare' },
      [['me', a], ['opp', b]].map(([k, x]) => h('div', { class: `dc-side${win === k ? ' win' : ''}` },
        h('div', { class: 'dc-name' }, x.n, win === k ? ' 🏆' : ''),
        h('div', { class: 'dc-points' }, x.p),
        h('div', { class: 'muted small-text' }, fmtSec(x.t)))),
      h('div', { class: 'dc-result' }, win === 'me' ? 'Du gewinnst das Duell!' : win === 'opp' ? `${b.n} gewinnt das Duell!` : 'Unentschieden!'));
  }

  // ---------- Start über Einladungs-/Ergebnislink ----------
  function fromLink(params) {
    const code = params.get('vs');
    const { game, cfg } = fromParams(params, s());
    if (!/^\d{4}$/.test(code || '') || !LEARN_GAMES[game]) return false;
    const key = seedKey(code, game, cfg);
    const opp = params.get('res') ? decodeRes(params.get('res')) : null;
    let d = store.learnDuels[key] || null;
    if (opp) d = store.saveDuel(key, { code, game, cfg: toParams(game, cfg), opp, date: Date.now() });
    const g = LEARN_GAMES[game];
    if (d?.me && d?.opp) {
      sound.play('record');
      app.show(h('section', { class: 'screen' },
        h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', hub), h('h2', {}, `Duell ${code}`, h('span', { class: 'sub' }, g.name))),
        h('div', { class: 'stage' }, compareView(d)),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-key': 'Enter', onClick: hub }, 'Weiter'))),
      { back: hub });
      return true;
    }
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', hub), h('h2', {}, '⚔️ Duell-Einladung', h('span', { class: 'sub' }, `Code ${code}`))),
      h('div', { class: 'scroll stack' },
        h('div', { class: 'card', style: { textAlign: 'center' } },
          h('div', { class: 'win-title', style: { fontSize: '2rem' } }, g.name),
          h('p', { class: 'muted' }, `${g.timed ? `${DIFFS[cfg.diff].label} · ` : ''}${cfg.rounds} Runden`),
          opp ? h('p', {}, h('b', {}, opp.n), ` hat ${opp.p} Punkte in ${fmtSec(opp.t)} vorgelegt – jetzt du!`) : h('p', {}, 'Du bekommst exakt dieselben Aufgaben wie dein Gegner.')),
        h('div', { class: 'card' }, h('div', { class: 'label', style: { marginBottom: '8px' } }, 'Dein Name'), nameField())),
      h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-key': 'Enter', 'data-snd': 'start', onClick: () => play(game, cfg, { code }) }, 'Duell starten'))),
    { back: hub });
    return true;
  }

  return { start: hub, fromLink };
}
