// Einheitliche Tastenkürzel: Buttons tragen data-key="Enter|Space|Backspace|Escape|0-9|…".
// Ein Kürzel löst nur aus, wenn der passende Button auf dem aktuellen Screen sichtbar und aktiv ist.
// Am PC (Maus/Trackpad) wird das Kürzel klein unter dem Button angezeigt, am Handy nicht.
export const IS_PC = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
document.documentElement.classList.toggle('pc', IS_PC);

const HINT = { Enter: 'Enter', Space: 'Leertaste', Backspace: '⌫', Escape: 'Esc' };

export function keyName(e) {
  if (e.key === ' ' || e.code === 'Space') return 'Space';
  if (e.key === 'Esc') return 'Escape';
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

const visible = b => !b.disabled && b.offsetParent !== null && getComputedStyle(b).visibility !== 'hidden';

export function findKeyButton(k) {
  const modals = document.querySelectorAll('#modal-root .modal-back');
  const scope = modals.length ? modals[modals.length - 1] : document.getElementById('app');
  const list = [...scope.querySelectorAll('[data-key]')].filter(b => b.dataset.key.split(' ').includes(k) && visible(b));
  return list[list.length - 1] || null;
}

function decorate() {
  document.querySelectorAll('[data-key]:not([data-hint])').forEach(b => {
    b.dataset.hint = b.dataset.key.split(' ').map(x => HINT[x] || x.toUpperCase()).join(' / ');
  });
}
if (IS_PC) new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
