import { h } from '../ui.js';
import { timedGame } from './timed.js';

export default timedGame({
  id: 'warmup',
  name: 'Warm-up',
  short: 'Freies Werfen, Arm aufwärmen – nur ein Timer.',
  settingKey: 'warmupMin',
  options: [1, 2, 3, 4],
  title: 'Warm-up',
  renderHint: () => h('p', { class: 'hint' }, 'Langsam werfen, ', h('strong', {}, 'ohne Ziel'), ' – einfach locker werden.'),
  info: {
    lines: ['Freies Werfen ohne Vorgaben – irgendwo auf die Scheibe.', 'Langsam, locker, Arm aufwärmen.', 'Nur ein Timer (1–4 Min, im TheLeek Programm 3 Min), Pause jederzeit möglich.'],
    steps: [
      { cap: 'Einfach locker werfen …', darts: [['S5', true], ['S20', true], ['S1', true]] },
      { cap: '… ohne Ziel und ohne Druck', darts: [['S12', true], ['S18', true], ['T20', true]] },
    ],
  },
});
