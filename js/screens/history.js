// Statistik-Verlauf: Sessions, Checkout-Quote, Fehlwürfe, schwache Zahlen.
import { h, iconBtn, fmtDate, fmtDuration, pct } from '../ui.js';
import { store } from '../store.js';
import { gameById } from '../games/registry.js';
import { lineChart } from '../chart.js';
import { DIFFICULTIES } from '../games/survival.js';
import { VARIANTS_121 } from '../games/l121.js';
import { heatmap, streak, bestStreak } from '../calendar.js';
import { badgeGrid, BADGES } from '../badges.js';

const shortDate = ts => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export function weakNumbers(runs, minAttempts = 3, limit = 10) {
  const agg = {};
  for (const r of runs) for (const [n, [a, c]] of Object.entries(r.perNumber || {})) {
    const x = agg[n] || (agg[n] = [0, 0]); x[0] += a; x[1] += c;
  }
  return Object.entries(agg)
    .filter(([, [a]]) => a >= minAttempts)
    .map(([n, [a, c]]) => ({ n: Number(n), attempts: a, checks: c, quote: c / a }))
    .sort((x, y) => x.quote - y.quote || y.attempts - x.attempts || x.n - y.n)
    .slice(0, limit);
}

export function renderHistory({ onBack }) {
  const sessions = [...store.sessions].sort((a, b) => a.start - b.start);
  const allRuns = [...store.checkoutRuns].sort((a, b) => a.date - b.date);
  const runs = allRuns.filter(r => r.source !== 'drill');
  const settings = store.settings;

  // ---- Checkout-Quote ----
  const totalA = runs.reduce((s, r) => s + r.attempts, 0);
  const totalC = runs.reduce((s, r) => s + r.checks, 0);
  const coCard = h('div', { class: 'card' }, h('h3', {}, 'Checkout-Quote'));
  if (runs.length) {
    coCard.append(
      h('div', { class: 'statline', style: { marginBottom: '10px' } },
        h('div', { class: 'stat green' }, h('b', {}, `${pct(totalC, totalA)}%`), h('span', {}, 'Gesamt')),
        h('div', { class: 'stat' }, h('b', {}, totalA), h('span', {}, 'Versuche')),
        h('div', { class: 'stat' }, h('b', {}, runs.length), h('span', {}, 'Runden'))),
      lineChart([{ label: 'Quote', color: '#7CC242', points: runs.map(r => ({ y: r.quote, tip: `${fmtDate(r.date)}: ${r.quote}% (${r.checks}/${r.attempts})` })) }],
        { yMax: 100, ySuffix: '%', xLabels: runs.map(r => shortDate(r.date)), ref: settings.readyQuote }),
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: '#7CC242' } }), 'Quote pro Runde'),
        h('span', {}, h('i', { style: { background: 'rgba(243,238,220,.3)' } }), `Ziel ${settings.readyQuote}%`)));
  } else coCard.append(h('p', { class: 'empty' }, 'Noch keine Checkout-Runden.'));

  // ---- Around the Clock ----
  const atcRuns = [...store.list('atcRuns')].sort((a, b) => a.date - b.date);
  const series = [['atcSingle', 'Single', '#F3EEDC', 'atcSingleLimit'], ['atcDouble', 'Doppel', '#D7262B', 'atcDoubleLimit'], ['atcTriple', 'Triple', '#7CC242', 'atcTripleLimit']].map(([id, label, color, lim]) => ({
    label, color, lim,
    points: atcRuns.map((r, i) => ({ r, i })).filter(p => p.r.game === id)
      .map(p => ({ i: p.i, y: p.r.misses, tip: `${fmtDate(p.r.date)}: ${label} ${p.r.misses} Fehlwürfe` })),
  })).filter(x => x.points.length);
  const atcCard = h('div', { class: 'card' }, h('h3', {}, 'Around the Clock – Fehlwürfe'));
  if (atcRuns.length) {
    atcCard.append(lineChart(series, { xLabels: atcRuns.map(r => shortDate(r.date)) }),
      h('div', { class: 'legend' }, series.map(x => h('span', {}, h('i', { style: { background: x.color } }), `${x.label} (Grenze ${settings[x.lim]})`))));
  } else atcCard.append(h('p', { class: 'empty' }, 'Noch keine Around-the-Clock-Runden.'));

  // ---- Leek Survival ----
  const sv = store.list('survivalRuns');
  const svCard = h('div', { class: 'card' }, h('h3', {}, 'Leek Survival – Rekorde'));
  if (sv.length) {
    svCard.append(h('div', { class: 'stat-grid' }, Object.entries(DIFFICULTIES).map(([k, d]) => {
      const rs = sv.filter(r => r.difficulty === k);
      const best = rs.length ? Math.max(...rs.map(r => r.highestRound)) : null;
      return h('div', { class: 'sg' }, h('b', {}, best ?? '–'), h('span', {}, `${d.emoji} ${d.label}${rs.length ? ` · ${rs.length}×` : ''}`));
    })));
    const last = sv.slice(-12);
    svCard.append(lineChart([{ label: 'Runde', color: '#7CC242', points: last.map(r => ({ y: r.highestRound, tip: `${fmtDate(r.date)}: ${DIFFICULTIES[r.difficulty]?.label} Runde ${r.highestRound}` })) }], { xLabels: last.map(r => shortDate(r.date)), height: 160 }));
  } else svCard.append(h('p', { class: 'empty' }, 'Noch keine Survival-Runden.'));

  // ---- 121, Doppel, 1vs1 ----
  const l121 = store.list('l121Runs'), dbl = store.list('doublesRuns'), vs = store.list('versusMatches');
  const misc = h('div', { class: 'card' }, h('h3', {}, 'Weitere Rekorde'),
    h('div', { class: 'stat-grid' },
      Object.entries(VARIANTS_121).map(([k, v]) => h('div', { class: 'sg' }, h('b', {}, Math.max(0, ...l121.filter(r => r.variant === k).map(r => r.highest)) || '–'), h('span', {}, `121 ${v.label}`))),
      h('div', { class: 'sg' }, h('b', {}, dbl.length ? Math.max(...dbl.map(r => r.perMin)) : '–'), h('span', {}, 'Doppel-Treffer/Min')),
      h('div', { class: 'sg' }, h('b', {}, vs.length), h('span', {}, '1vs1-Duelle'))));

  // ---- Schwache Zahlen ----
  const weak = weakNumbers(allRuns);
  const weakCard = h('div', { class: 'card' }, h('h3', {}, 'Schwache Zahlen'),
    h('p', { class: 'muted small-text' }, 'Niedrigste Checkout-Quote (mind. 3 Versuche)'),
    weak.length
      ? h('div', { class: 'weak-list' }, weak.map(w => h('div', { class: 'weak' }, h('b', {}, w.n), h('div', { class: 'q' }, `${Math.round(w.quote * 100)}%`), h('span', {}, `${w.checks}/${w.attempts}`))))
      : h('p', { class: 'empty' }, 'Noch nicht genug Daten.'));

  // ---- Sessions ----
  const sessCard = h('div', { class: 'card' }, h('h3', {}, 'Sessions'));
  if (sessions.length) {
    for (const s of [...sessions].reverse()) {
      const names = s.results.map(r => gameById(r.gameId)?.name ?? r.gameId);
      sessCard.append(h('details', { class: 'session-item result-row', style: { display: 'block' } },
        h('summary', {},
          h('span', { class: 'name' }, fmtDate(s.start)),
          h('span', { class: 'muted small-text' }, fmtDuration((s.end || s.start) - s.start))),
        h('div', { class: 'games' }, `${({ leek: 'Leek-Programm', custom: 'Individuell', single: 'Einzel' })[s.mode] || 'Angepasst'} · ${names.length} Spiel${names.length === 1 ? '' : 'e'}`),
        h('div', { style: { marginTop: '8px' } }, s.results.map(r => {
          const g = gameById(r.gameId);
          const sum = g ? g.summary(r.data, settings) : { value: '–' };
          return h('div', { class: 'small-text', style: { display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '3px 0' } },
            h('span', {}, g?.name ?? r.gameId), h('span', { class: sum.bad ? '' : 'muted' }, `${sum.value}${sum.bad ? ' ⚠' : ''} · ${fmtDuration(r.durationMs)}`));
        }))));
    }
  } else sessCard.append(h('p', { class: 'empty' }, 'Noch keine Sessions gespeichert.'));

  const tabs = {
    training: ['Training', () => [calCard(), coCard, weakCard, atcCard, svCard, misc, badgeCard(), sessCard]],
    learn: ['Darts lernen', learnTab],
    quiz: ['Quiz', quizTab],
    vs: ['1vs1', vsTab],
  };
  const body = h('div', {});
  const bar = h('div', { class: 'tabs', role: 'tablist' });
  const select = key => {
    current = key;
    bar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === key));
    body.replaceChildren(...tabs[key][1]().filter(Boolean));
  };
  Object.entries(tabs).forEach(([k, [label]]) => bar.append(h('button', { 'data-tab': k, role: 'tab', onClick: () => select(k) }, label)));
  select(current);
  return h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', onBack), h('h2', {}, 'Statistik')),
    h('div', { class: 'scroll' }, bar, body));
}
let current = 'training';

// ---------- Darts lernen ----------
const LEARN_NAMES = { finish: 'Finish-Wege', caller: 'Ich werde Caller' };
const DIFF_NAMES = { easy: 'Leicht', medium: 'Mittel', hard: 'Hart', leek: 'TheLeek' };
const sec = ms => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
function learnTab() {
  const runs = store.list('learnRuns');
  return Object.entries(LEARN_NAMES).map(([g, name]) => {
    const rs = runs.filter(r => r.game === g).sort((a, b) => a.date - b.date);
    const card = h('div', { class: 'card' }, h('h3', {}, name));
    if (!rs.length) { card.append(h('p', { class: 'empty' }, 'Noch nicht gespielt.')); return card; }
    const pts = rs.reduce((a, r) => a + r.points, 0), tot = rs.reduce((a, r) => a + r.total, 0);
    const avg = Math.round(rs.reduce((a, r) => a + r.avgMs * r.total, 0) / Math.max(1, tot));
    card.append(
      h('div', { class: 'stat-grid' },
        h('div', { class: 'sg' }, h('b', {}, `${pct(pts, tot)}%`), h('span', {}, 'Trefferquote')),
        h('div', { class: 'sg' }, h('b', {}, sec(avg)), h('span', {}, 'Ø Antwortzeit')),
        h('div', { class: 'sg' }, h('b', {}, Math.max(...rs.map(r => r.bestStreak))), h('span', {}, 'Beste Serie')),
        h('div', { class: 'sg' }, h('b', {}, rs.length), h('span', {}, 'Runden'))),
      h('div', { class: 'label', style: { margin: '12px 0 6px' } }, 'Pro Schwierigkeit'),
      h('div', { class: 'stat-grid' }, Object.entries(DIFF_NAMES).map(([d, l]) => {
        const x = rs.filter(r => r.diff === d); const p = x.reduce((a, r) => a + r.points, 0), t = x.reduce((a, r) => a + r.total, 0);
        return h('div', { class: 'sg' }, h('b', {}, t ? `${pct(p, t)}%` : '–'), h('span', {}, `${l}${x.length ? ` · ${x.length}×` : ''}`));
      })),
      rs.length > 1 ? lineChart([{ label: 'Quote', color: '#7CC242', points: rs.slice(-20).map(r => ({ y: r.quote, tip: `${fmtDate(r.date)}: ${r.quote}%` })) }], { yMax: 100, ySuffix: '%', xLabels: rs.slice(-20).map(r => shortDate(r.date)), height: 160 }) : null);
    if (g === 'finish') {
      const err = {};
      rs.forEach(r => Object.entries(r.errors || {}).forEach(([n, c]) => { err[n] = (err[n] || 0) + c; }));
      const top = Object.entries(err).sort((a, b) => b[1] - a[1]).slice(0, 10);
      card.append(h('div', { class: 'label', style: { margin: '12px 0 6px' } }, 'Meiste Fehler'),
        top.length ? h('div', { class: 'weak-list' }, top.map(([n, c]) => h('div', { class: 'weak bad' }, h('b', {}, n), h('span', {}, `${c}× falsch`)))) : h('p', { class: 'muted small-text' }, 'Noch keine Fehler – stark!'));
    }
    return card;
  });
}

// ---------- Quiz ----------
const CAT_NAMES = { spieler: 'Spieler & Spitznamen', turniere: 'Turniere & Geschichte', regeln: 'Regeln & Board', checkouts: 'Checkouts' };
function quizTab() {
  const rs = store.list('learnRuns').filter(r => r.game === 'quiz');
  const card = h('div', { class: 'card' }, h('h3', {}, 'Dart-Quiz'));
  if (!rs.length) { card.append(h('p', { class: 'empty' }, 'Noch kein Quiz gespielt.')); return [card]; }
  const pts = rs.reduce((a, r) => a + r.points, 0), tot = rs.reduce((a, r) => a + r.total, 0);
  const cats = {};
  rs.forEach(r => Object.entries(r.perCat || {}).forEach(([c, [a, k]]) => { const x = cats[c] || (cats[c] = [0, 0]); x[0] += a; x[1] += k; }));
  card.append(
    h('div', { class: 'statline', style: { marginBottom: '12px' } },
      h('div', { class: 'stat green' }, h('b', {}, `${pct(pts, tot)}%`), h('span', {}, 'Quote gesamt')),
      h('div', { class: 'stat' }, h('b', {}, tot), h('span', {}, 'Fragen')),
      h('div', { class: 'stat' }, h('b', {}, Math.max(...rs.map(r => r.bestStreak))), h('span', {}, 'Beste Serie'))),
    h('div', { class: 'stat-grid' }, Object.entries(CAT_NAMES).map(([c, l]) => {
      const x = cats[c];
      return h('div', { class: 'sg' }, h('b', {}, x ? `${pct(x[1], x[0])}%` : '–'), h('span', {}, `${l}${x ? ` · ${x[0]}` : ''}`));
    })));
  return [card];
}

// ---------- 1vs1 ----------
function vsTab() {
  const vs = store.list('versusMatches');
  const tally = {};
  vs.forEach(m => m.players.forEach(p => { const t = tally[p] || (tally[p] = [0, 0]); t[0]++; if (m.winner === p) t[1]++; }));
  const vsCard = h('div', { class: 'card' }, h('h3', {}, 'Duelle auf einem Gerät'),
    vs.length ? h('div', { class: 'stat-grid' }, Object.entries(tally).sort((a, b) => b[1][1] - a[1][1]).map(([n, [g, w]]) => h('div', { class: 'sg' }, h('b', {}, `${w}:${g - w}`), h('span', {}, n))))
      : h('p', { class: 'empty' }, 'Noch keine Duelle.'));
  const duels = Object.values(store.learnDuels).sort((a, b) => (b.date || 0) - (a.date || 0));
  const won = duels.filter(d => d.me && d.opp && (d.me.p > d.opp.p || (d.me.p === d.opp.p && d.me.t < d.opp.t))).length;
  const lost = duels.filter(d => d.me && d.opp && (d.me.p < d.opp.p || (d.me.p === d.opp.p && d.me.t > d.opp.t))).length;
  const learnCard = h('div', { class: 'card' }, h('h3', {}, `Darts lernen – Duelle · ${won}:${lost}`),
    duels.length ? duels.slice(0, 20).map(d => h('div', { class: 'result-row' },
      h('div', {}, h('div', { class: 'name' }, `${({ finish: 'Finish-Wege', caller: 'Caller', quiz: 'Quiz' })[d.game] || d.game} · Code ${d.code}`), h('div', { class: 'muted small-text' }, d.opp ? `vs. ${d.opp.n}` : 'Gegner noch offen')),
      h('div', { class: 'val' }, `${d.me?.p ?? '–'} : ${d.opp?.p ?? '–'}`))) : h('p', { class: 'empty' }, 'Noch keine Lern-Duelle.'));
  const hl = store.list('hiloGames');
  const wins = {};
  hl.forEach(g => { if (g.winner) wins[g.winner] = (wins[g.winner] || 0) + 1; });
  const hlCard = h('div', { class: 'card' }, h('h3', {}, `Höher 41 – Tiefer 26 · ${hl.length} Spiele`),
    hl.length ? h('div', { class: 'stat-grid' }, Object.entries(wins).sort((a, b) => b[1] - a[1]).map(([n, w]) => h('div', { class: 'sg' }, h('b', {}, `${w}×`), h('span', {}, `🏆 ${n}`)))) : h('p', { class: 'empty' }, 'Noch nicht gespielt.'),
    hl.length ? h('p', { class: 'muted small-text', style: { marginTop: '10px' } }, `Zuletzt: ${hl[hl.length - 1].winner} gewinnt nach ${hl[hl.length - 1].rounds} Runden`) : null);
  return [vsCard, learnCard, hlCard];
}

function calCard() {
  const st = streak();
  return h('div', { class: 'card' }, h('h3', {}, 'Trainings-Kalender'),
    h('div', { class: 'statline', style: { marginBottom: '12px' } },
      h('div', { class: 'stat green' }, h('b', {}, `🔥 ${st.days}`), h('span', {}, 'Aktuelle Serie')),
      h('div', { class: 'stat' }, h('b', {}, bestStreak()), h('span', {}, 'Beste Serie'))),
    heatmap());
}

function badgeCard() {
  const n = Object.keys(store.badges).length;
  return h('div', { class: 'card' }, h('h3', {}, `Leek-Abzeichen · ${n}/${BADGES.length}`), badgeGrid());
}
