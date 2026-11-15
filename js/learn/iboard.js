// Interaktives Dartboard für „Darts lernen“: antippbare Segmente, Lupe (Touch), Hover-Label (PC), fliegende Darts.
import { h } from '../ui.js';
import { createBoard, ORDER, WIDE } from '../board.js';
import { dartLabel } from '../pads.js';

const R = WIDE;
// Toleranz: knapp neben Triple/Double zählt noch (in Board-Einheiten)
const TOL = 2.2;
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const polar = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };

// Segment an Board-Koordinate (Mittelpunkt 0/0, Doppel außen = 100)
export function segmentAt(x, y) {
  const r = Math.hypot(x, y);
  if (r <= R.be) return '50';
  if (r <= R.bull) return '25';
  if (r > R.dOut + 6) return null;
  let deg = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
  const n = ORDER[Math.floor(((deg + 9) % 360) / 18)];
  if (r >= R.dIn - TOL) return `D${n}`;
  if (r >= R.tIn - TOL && r <= R.tOut + TOL) return `T${n}`;
  return `S${n}`;
}

// Zufälliger Punkt im Segment (rng = Funktion 0..1)
export function pointIn(key, rng = Math.random) {
  if (key === '50') return polar(rng() * R.be * .8, rng() * 360);
  if (key === '25') return polar(R.be + 1 + rng() * (R.bull - R.be - 2), rng() * 360);
  if (key === 'MISS') return polar(R.dOut + 4 + rng() * 12, rng() * 360);
  const m = /^([SDT])(\d+)$/.exec(key);
  const idx = ORDER.indexOf(Number(m[2]));
  const ang = idx * 18 + (rng() * 13 - 6.5);
  let r;
  if (m[1] === 'T') r = R.tIn + 1 + rng() * (R.tOut - R.tIn - 2);
  else if (m[1] === 'D') r = R.dIn + 1 + rng() * (R.dOut - R.dIn - 2);
  else r = rng() < .5 ? R.bull + 4 + rng() * (R.tIn - R.bull - 8) : R.tOut + 3 + rng() * (R.dIn - R.tOut - 6);
  return polar(r, ang);
}

export function interactiveBoard({ onPick = null } = {}) {
  const board = createBoard({ className: 'iboard', wide: true });
  const svg = board.el;
  const label = h('div', { class: 'ib-label' });
  const loupeSvg = svg.cloneNode(true);
  loupeSvg.setAttribute('class', 'board ib-loupe-svg');
  const loupe = h('div', { class: 'ib-loupe' }, loupeSvg, h('i', { class: 'ib-cross' }));
  const wrap = h('div', { class: `ib-wrap${onPick ? ' pick' : ''}` }, svg, label, loupe);
  let hoverKey = null;

  const toBoard = (cx, cy) => {
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  };
  const setHover = key => {
    if (key === hoverKey) return;
    if (hoverKey) board.nodes(hoverKey).forEach(n => n.classList.remove('ib-hover'));
    hoverKey = key;
    if (key) board.nodes(key).forEach(n => n.classList.add('ib-hover'));
  };
  const showLabel = (key, cx, cy) => {
    const r = wrap.getBoundingClientRect();
    label.textContent = key ? dartLabel(key) : '';
    label.style.display = key ? 'block' : 'none';
    label.style.left = `${cx - r.left}px`;
    label.style.top = `${cy - r.top}px`;
  };

  if (onPick) {
    let touching = false;
    const move = (e, isTouch) => {
      const [x, y] = toBoard(e.clientX, e.clientY);
      const key = segmentAt(x, y);
      setHover(key);
      if (isTouch) {
        const r = wrap.getBoundingClientRect();
        loupe.style.display = 'block';
        loupe.style.left = `${e.clientX - r.left}px`;
        loupe.style.top = `${e.clientY - r.top}px`;
        loupeSvg.setAttribute('viewBox', `${x - 22} ${y - 22} 44 44`);
        label.classList.add('above');
      }
      showLabel(key, e.clientX, e.clientY);
      return key;
    };
    svg.addEventListener('pointerdown', e => {
      e.preventDefault();
      touching = e.pointerType !== 'mouse';
      svg.setPointerCapture(e.pointerId);
      move(e, touching);
    });
    svg.addEventListener('pointermove', e => move(e, touching));
    svg.addEventListener('pointerup', e => {
      const key = move(e, false);
      loupe.style.display = 'none';
      label.classList.remove('above');
      if (touching) { setHover(null); showLabel(null); }
      touching = false;
      if (key) { flash(key); onPick(key); }
    });
    svg.addEventListener('pointercancel', () => { loupe.style.display = 'none'; touching = false; setHover(null); showLabel(null); });
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { setHover(null); showLabel(null); } });
  }

  function flash(key) {
    const nodes = board.nodes(key);
    nodes.forEach(n => { n.classList.remove('ib-picked'); void n.getBBox(); n.classList.add('ib-picked'); });
    setTimeout(() => nodes.forEach(n => n.classList.remove('ib-picked')), 450);
  }

  // Fliegender Dart, steckt danach im Segment
  function throwDart(key, rng = Math.random) {
    const [x, y] = pointIn(key, rng);
    const g = el('g', { transform: `translate(${x.toFixed(2)},${y.toFixed(2)})`, class: 'fly-dart' });
    const inner = el('g', { class: 'fd-inner' });
    inner.append(
      el('line', { x1: 0, y1: 0, x2: 4, y2: -4, class: 'fd-tip' }),
      el('line', { x1: 4, y1: -4, x2: 11, y2: -11, class: 'fd-barrel' }),
      el('line', { x1: 11, y1: -11, x2: 17, y2: -17, class: 'fd-shaft' }),
      el('path', { d: 'M15 -15 L23 -13 L19 -19 L17 -23 Z', class: 'fd-flight' }));
    g.append(inner);
    board.layer.append(g);
  }

  return {
    el: wrap, board,
    throwDart,
    clearDarts() { board.layer.replaceChildren(); },
    mark(key, cls = 'ib-good') { board.nodes(key).forEach(n => n.classList.add(cls)); },
    unmarkAll() { svg.querySelectorAll('.ib-good,.ib-bad').forEach(n => n.classList.remove('ib-good', 'ib-bad')); },
  };
}
