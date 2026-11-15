// Checkout-Mathematik für „Finish-Wege“: minimale Dart-Anzahl, Gültigkeit, Lösungsweg.
import { checkoutPath, BOGEYS } from '../checkouts.js';
import { dartValue, isDoubleKey } from '../pads.js';

// Wurfreihenfolge nach Beliebtheit (für Lösungs-Suche)
const PREF = [
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10].map(n => `T${n}`),
  '25', '50',
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => `S${n}`),
  ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => `T${n}`),
  ...Array.from({ length: 20 }, (_, i) => `D${20 - i}`),
];
const DOUBLES = [...[20, 16, 18, 12, 10, 8, 14, 6, 4, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1].map(n => `D${n}`), '50'];
const VALUES = [...new Set(PREF.map(dartValue))];
const DBL_VALUES = new Set(DOUBLES.map(dartValue));

const MIN = new Map();
for (let n = 2; n <= 170; n++) {
  if (DBL_VALUES.has(n)) { MIN.set(n, 1); continue; }
  if ([...DBL_VALUES].some(d => VALUES.includes(n - d))) { MIN.set(n, 2); continue; }
  if ([...DBL_VALUES].some(d => VALUES.some(a => VALUES.includes(n - d - a)))) MIN.set(n, 3);
}
export const minDarts = n => MIN.get(n) ?? Infinity;
export const finishable = n => MIN.has(n);
export const finishPool = (lo, hi) => { const p = []; for (let n = Math.max(2, lo); n <= Math.min(170, hi); n++) if (MIN.has(n) && !BOGEYS.has(n)) p.push(n); return p; };

// Status eines (teilweisen) Wegs: 'ok' | 'wrong' | 'pending'
export function pathStatus(n, keys) {
  const need = minDarts(n);
  const sum = keys.reduce((a, k) => a + dartValue(k), 0);
  const rest = n - sum;
  const used = keys.length;
  if (keys.includes('MISS')) return 'wrong';
  if (used === need) return rest === 0 && isDoubleKey(keys[used - 1]) ? 'ok' : 'wrong';
  if (rest < 2) return 'wrong';
  return minDarts(rest) <= need - used && minDarts(rest) === need - used ? 'pending' : 'wrong';
}

const parseTable = p => p.split(/\s+/).filter(Boolean).map(t => (t === 'Bull' ? '50' : t === '25' ? '25' : /^\d+$/.test(t) ? `S${t}` : t));

// Ein richtiger Weg mit minimaler Dart-Anzahl
export function solution(n) {
  const need = minDarts(n);
  const t = parseTable(checkoutPath(n));
  if (t.length === need && pathStatus(n, t) === 'ok') return t;
  const search = (rest, k) => {
    if (k === 1) return DOUBLES.find(d => dartValue(d) === rest) ? [DOUBLES.find(d => dartValue(d) === rest)] : null;
    for (const a of PREF) {
      const r = rest - dartValue(a);
      if (r >= 2 && minDarts(r) === k - 1) { const tail = search(r, k - 1); if (tail) return [a, ...tail]; }
    }
    return null;
  };
  return search(n, need) || t;
}
