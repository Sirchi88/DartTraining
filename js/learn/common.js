// Gemeinsames für „Darts lernen“: Schwierigkeit, Zeit-Balken, Ergebnis-Auswertung.
import { h } from '../ui.js';

export const DIFFS = {
  easy: { label: 'Leicht', sec: 7 },
  medium: { label: 'Mittel', sec: 5 },
  hard: { label: 'Hart', sec: 3 },
  leek: { label: 'TheLeek', sec: 2 },
};
export const diffOptions = () => Object.entries(DIFFS).map(([k, d]) => [k, `${d.label} ${d.sec}s`]);

// Ablaufender Zeit-Balken
export function timeBar() {
  const fill = h('i');
  const el = h('div', { class: 'time-bar' }, fill);
  let raf = null, t0 = 0, total = 0, onEnd = null, stopped = true;
  const tick = () => {
    const left = Math.max(0, total - (performance.now() - t0));
    fill.style.width = `${(left / total) * 100}%`;
    el.classList.toggle('low', left < total * 0.3);
    if (left <= 0) { stopped = true; onEnd?.(); return; }
    if (!stopped) raf = requestAnimationFrame(tick);
  };
  return {
    el,
    start(ms, end) { total = ms; onEnd = end; t0 = performance.now(); stopped = false; el.classList.remove('idle'); cancelAnimationFrame(raf); tick(); },
    stop() { stopped = true; cancelAnimationFrame(raf); return performance.now() - t0; },
    idle() { stopped = true; cancelAnimationFrame(raf); fill.style.width = '100%'; el.classList.add('idle'); el.classList.remove('low'); },
    elapsed: () => performance.now() - t0,
  };
}

// Laufende Auswertung
export function tracker(total) {
  const t = { total, done: 0, correct: 0, times: [], streak: 0, bestStreak: 0, items: [] };
  t.add = (ok, ms, item = {}) => {
    t.done++; if (ok) { t.correct++; t.streak++; t.bestStreak = Math.max(t.bestStreak, t.streak); } else t.streak = 0;
    t.times.push(ms); t.items.push({ ...item, ok, ms });
  };
  t.avgMs = () => (t.times.length ? Math.round(t.times.reduce((a, b) => a + b, 0) / t.times.length) : 0);
  t.totalMs = () => Math.round(t.times.reduce((a, b) => a + b, 0));
  return t;
}

export const fmtSec = ms => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
