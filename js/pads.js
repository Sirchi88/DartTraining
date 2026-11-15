// Gemeinsame Eingabe-Bausteine: Feld-Tastatur (S/D/T + 1–20, Bull, Bullseye, Miss) und Zahlenfeld.
import { h } from './ui.js';

// Wert eines Feld-Schlüssels: S20, D20, T20, 25, 50, MISS
export function dartValue(key) {
  if (key === '25') return 25;
  if (key === '50') return 50;
  if (key === 'MISS') return 0;
  const m = /^([SDT])(\d+)$/.exec(key);
  if (!m) return 0;
  return Number(m[2]) * ({ S: 1, D: 2, T: 3 })[m[1]];
}
export const isDoubleKey = key => key === '50' || /^D\d+$/.test(key);
export const dartLabel = key => (key === '25' ? 'Bull' : key === '50' ? 'Bullseye' : key === 'MISS' ? 'Miss' : key.startsWith('S') ? key.slice(1) : key);

export function fieldPad({ onDart, miss = false }) {
  let mult = 'S';
  const wrap = h('div', { class: 'field-pad' });
  const render = () => {
    wrap.replaceChildren(
      h('div', { class: 'fp-mult' }, [['S', 'Single'], ['D', 'Double'], ['T', 'Triple']].map(([k, l]) =>
        h('button', { class: `${k === mult ? 'on' : ''} m-${k}`, 'data-snd': 'none', onClick: () => { mult = k; render(); } }, l))),
      h('div', { class: 'fp-grid' }, Array.from({ length: 20 }, (_, i) => i + 1).map(n =>
        h('button', { 'data-snd': 'tap', onClick: () => { onDart(`${mult}${n}`); if (mult !== 'S') { mult = 'S'; render(); } } }, n))),
      h('div', { class: 'fp-extra' },
        h('button', { 'data-snd': 'tap', onClick: () => onDart('25') }, 'Bull 25'),
        h('button', { 'data-snd': 'tap', onClick: () => onDart('50') }, 'Bullseye 50'),
        miss ? h('button', { 'data-snd': 'tap', class: 'miss', onClick: () => onDart('MISS') }, 'Miss') : null));
  };
  render();
  return wrap;
}

// Taschenrechner-Zahlenfeld. onDigit(d), onBack(), onOk()
export function numPad({ onDigit, onBack, onOk, okLabel = 'OK' }) {
  const b = (label, fn, cls = '', key = null) => h('button', { class: cls, 'data-snd': 'tap', 'data-key': key, onClick: fn }, label);
  return h('div', { class: 'num-pad' },
    [7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => b(n, () => onDigit(String(n)), 'digit', String(n))),
    b('⌫', onBack, 'del', 'Backspace'), b('0', () => onDigit('0'), 'digit', '0'), b(okLabel, onOk, 'ok', 'Enter'));
}
