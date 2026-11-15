// Höher 41 – Tiefer 26: Mehrspieler an einem Gerät. Über die obere ODER unter die untere Grenze werfen – sonst raus.
import { h, icon, segmented, stepper, toast } from '../ui.js';
import { sound } from '../sound.js';
import { store, uid } from '../store.js';
import { fieldPad, numPad, dartValue, dartLabel } from '../pads.js';

const IMPOSSIBLE = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

export default {
  id: 'hilo',
  name: 'Höher 41 – Tiefer 26',
  short: 'Über die obere oder unter die untere Grenze werfen – sonst raus.',
  tracked: true,
  info: {
    lines: [
      'Zwei Grenzen: oben 41, unten 26. Reihum wirft jeder 3 Darts, die Summe zählt.',
      'Du musst MEHR als die obere ODER WENIGER als die untere Grenze werfen.',
      'Höher geschafft → deine Summe wird die neue obere Grenze. Tiefer geschafft → neue untere Grenze.',
      'Gleichstand oder dazwischen = raus. Der letzte Spieler im Spiel gewinnt.',
      'Beispiel: 26/41 → Spieler 1 wirft 60 → 26/60 → Spieler 2 wirft 4 → 4/60.',
    ],
    steps: [
      { hl: ['T20'], cap: '60 > 41 → neue Obergrenze 60', darts: [['T20', true], ['S1', false], ['S5', false]] },
      { hl: ['S1', 'S3'], cap: '4 < 26 → neue Untergrenze 4', darts: [['S1', true], ['S3', true]] },
    ],
  },
  mount(root, ctx) {
    const s = ctx.settings;
    let count = s.hlPlayers, upper0 = s.hlUpper, lower0 = s.hlLower, mode = s.hlInput;
    let names = Array.from({ length: 8 }, (_, i) => s.hlNames[i] || '');
    let st, hist, darts, digits, fx, phase = 'setup', startedAt;

    // ---------- Setup ----------
    function setup() {
      phase = 'setup';
      const nameBox = h('div', { class: 'stack' });
      const paintNames = () => nameBox.replaceChildren(...Array.from({ length: count }, (_, i) => {
        const inp = h('input', { class: 'text-input', placeholder: `Spieler ${i + 1}`, value: names[i], maxlength: 16, autocomplete: 'off' });
        inp.addEventListener('input', () => { names[i] = inp.value; });
        return inp;
      }));
      paintNames();
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll stack', style: { paddingTop: '6px' } },
          h('div', { class: 'card' },
            h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Spieler', h('small', {}, '2 bis 8')), stepper(count, { min: 2, max: 8 }, v => { count = v; paintNames(); })),
            h('div', { class: 'field col' }, nameBox)),
          h('div', { class: 'card' },
            h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Obergrenze', h('small', {}, 'Start')), stepper(upper0, { min: 1, max: 179 }, v => { upper0 = v; })),
            h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Untergrenze', h('small', {}, 'Start')), stepper(lower0, { min: 1, max: 179 }, v => { lower0 = v; })),
            h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Eingabe'), segmented([['darts', '3 Darts'], ['sum', 'Summe']], mode, v => { mode = v; })))),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-key': 'Enter', 'data-snd': 'start', onClick: () => start() }, 'Spiel starten'))));
    }

    function start(samePlayers = null) {
      const list = samePlayers || Array.from({ length: count }, (_, i) => names[i].trim() || `Spieler ${i + 1}`);
      if (!samePlayers) store.saveSettings({ ...store.settings, hlNames: names.map(n => n.trim()) });
      let up = upper0, lo = lower0;
      if (lo > up) [up, lo] = [lo, up];
      st = { upper: up, lower: lo, players: list.map(n => ({ name: n, out: false })), cur: 0, round: 1, log: [] };
      hist = []; darts = []; digits = ''; fx = null; phase = 'play'; startedAt = Date.now();
      render();
    }

    const alive = () => st.players.filter(p => !p.out);
    const canUp = () => st.upper < 180;
    const canDown = () => st.lower > 0;

    function nextPlayer() {
      const n = st.players.length;
      let i = st.cur;
      do { i = (i + 1) % n; if (i === 0) st.round++; } while (st.players[i].out);
      st.cur = i;
    }

    function submit(sum, dartList = null) {
      if (sum < 0 || sum > 180 || IMPOSSIBLE.has(sum)) { toast(`${sum} ist mit 3 Darts nicht möglich`); return; }
      hist.push(JSON.stringify(st));
      const p = st.players[st.cur];
      let res;
      if (canUp() && sum > st.upper) { res = 'up'; st.upper = sum; }
      else if (canDown() && sum < st.lower) { res = 'down'; st.lower = sum; }
      else { res = 'out'; p.out = true; }
      st.log.push({ player: p.name, sum, darts: dartList, res, upper: st.upper, lower: st.lower, round: st.round });
      fx = { res, sum, name: p.name };
      darts = []; digits = '';
      sound.play(res === 'out' ? 'lifeLost' : 'hit');
      if (alive().length <= 1) return winner();
      nextPlayer();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function back() {
      if (mode === 'darts' && darts.length) { darts.pop(); return render(); }
      if (mode === 'sum' && digits) { digits = digits.slice(0, -1); return render(); }
      const prev = hist.pop();
      if (!prev) return;
      st = JSON.parse(prev); fx = null; render();
    }

    function render() {
      const p = st.players[st.cur];
      const zone = (dir) => {
        const up = dir === 'up';
        const dead = up ? !canUp() : !canDown();
        return h('div', { class: `hl-zone ${dir}${dead ? ' dead' : ''}${fx && fx.res === dir ? ' crack' : ''}` },
          h('span', { class: 'hl-arrow' }, up ? '↑' : '↓'),
          h('span', { class: 'hl-val' }, `${up ? '>' : '<'} ${up ? st.upper : st.lower}`),
          h('span', { class: 'hl-tag' }, dead ? 'nicht mehr möglich' : up ? 'höher werfen' : 'tiefer werfen'));
      };
      const sum = darts.reduce((a, k) => a + dartValue(k), 0);
      const input = mode === 'darts'
        ? h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'dart-slots' }, [0, 1, 2].map(i => h('span', { class: darts[i] ? 'on' : '' }, darts[i] ? dartLabel(darts[i]) : `Dart ${i + 1}`)),
              h('b', { class: 'slot-sum' }, `= ${sum}`)),
            fieldPad({ miss: true, onDart: k => { if (darts.length < 3) { darts.push(k); render(); } } }),
            h('div', { class: 'btn-row' },
              h('button', { class: 'btn ghost small', 'data-key': 'Backspace', onClick: back }, icon('undo'), 'Undo'),
              h('button', { class: 'btn primary', 'data-key': 'Enter', 'data-snd': 'none', disabled: darts.length < 3, onClick: () => submit(sum, [...darts]) }, `Bestätigen (${sum})`)))
        : h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'x01-input' }, h('span', { class: 'lbl' }, 'Summe'), h('span', { class: `val${digits ? '' : ' empty'}` }, digits || '0')),
            numPad({ onDigit: d => { if ((digits + d).length <= 3 && Number(digits + d) <= 180) { digits = (digits + d).replace(/^0+(?=\d)/, ''); render(); } }, onBack: back, onOk: () => submit(Number(digits || 0)) }));

      root.replaceChildren(h('div', { class: 'game hilo' },
        h('div', { class: 'scroll' },
          zone('up'),
          h('div', { class: `hl-mid${fx && fx.res === 'out' ? ' shake' : ''}` },
            h('div', { class: 'label' }, `Runde ${st.round} · ${alive().length} von ${st.players.length} im Spiel`),
            h('div', { class: 'hl-name' }, p.name),
            h('div', { class: `flash ${fx ? (fx.res === 'out' ? 'bad' : 'ok') : 'empty'}` },
              fx ? (fx.res === 'up' ? `${fx.name}: ${fx.sum} – höher geknackt ↑` : fx.res === 'down' ? `${fx.name}: ${fx.sum} – tiefer geknackt ↓` : `${fx.name}: ${fx.sum} – raus ✗`) : ' '),
            h('div', { class: 'hl-players' }, st.players.map((x, i) => h('span', { class: `${x.out ? 'out' : ''}${i === st.cur ? ' cur' : ''}` }, x.name)))),
          zone('down'),
          h('div', { class: 'hl-mode' }, segmented([['darts', '3 Darts'], ['sum', 'Summe']], mode, v => { mode = v; darts = []; digits = ''; render(); })),
          input,
          historyCard())));
    }

    function historyCard() {
      return h('details', { class: 'card hl-hist' }, h('summary', {}, `Spielverlauf (${st.log.length})`),
        h('div', {}, [...st.log].reverse().map(l => h('div', { class: `hh-row ${l.res}` },
          h('b', {}, l.player),
          h('span', {}, l.darts ? `${l.darts.map(dartLabel).join(' · ')} = ${l.sum}` : l.sum),
          h('span', { class: 'hh-res' }, l.res === 'up' ? '↑' : l.res === 'down' ? '↓' : '✗'),
          h('span', { class: 'muted' }, `${l.lower} / ${l.upper}`)))));
    }

    function winner() {
      phase = 'result';
      const w = alive()[0];
      const run = { id: uid(), date: Date.now(), players: st.players.map(x => x.name), winner: w?.name, rounds: st.round, turns: st.log.length, durationMs: Date.now() - startedAt };
      store.log('hiloGames', run);
      sound.play('record');
      const players = st.players.map(x => x.name);
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll' },
          h('div', { class: 'stage', style: { flex: 'none' } },
            h('div', { class: 'char-emoji big-emoji win' }, '🏆'),
            h('div', { class: 'label' }, 'Höher 41 – Tiefer 26'),
            h('div', { class: 'win-title' }, `${w?.name} gewinnt!`),
            h('p', { class: 'hint' }, `${st.round} Runden · ${st.log.length} Aufnahmen · Endgrenzen ${st.lower} / ${st.upper}`)),
          historyCard()),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost', onClick: () => start(players) }, 'Nochmal'),
            h('button', { class: 'btn ghost', onClick: setup }, 'Neues Spiel')),
          h('button', { class: 'btn huge primary', 'data-key': 'Enter', onClick: () => ctx.finish({ winner: w?.name, rounds: st.round, players: players.length }) }, 'Weiter'))));
    }

    ctx.onKey(e => {
      if (phase !== 'play' || mode !== 'sum') return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); if ((digits + e.key).length <= 3 && Number(digits + e.key) <= 180) { digits = (digits + e.key).replace(/^0+(?=\d)/, ''); render(); } }
    });
    setup();
  },
  summary(data) {
    return { value: `Sieger: ${data.winner ?? '–'}`, note: `${data.rounds} Runden · ${data.players} Spieler`, bad: null };
  },
};
