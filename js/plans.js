// Einstellbare Parameter pro Spiel für eigene Trainingspläne.
// Schlüssel entsprechen den globalen Einstellungen (settings.js) – ein Plan überschreibt sie nur für seinen Lauf.
export const PLAN_PARAMS = {
  sequence: [
    { key: 'seqHits', label: 'Treffer 20–17', type: 'number', min: 1, max: 50 },
    { key: 'seqBullHits', label: 'Treffer Bull', type: 'number', min: 1, max: 50 },
  ],
  hilo: [
    { key: 'hlUpper', label: 'Obergrenze', type: 'number', min: 1, max: 179 },
    { key: 'hlLower', label: 'Untergrenze', type: 'number', min: 1, max: 179 },
    { key: 'hlPlayers', label: 'Spieler', type: 'number', min: 2, max: 8 },
  ],
  warmup: [{ key: 'warmupMin', label: 'Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min']] }],
  switch: [{ key: 'switchMin', label: 'Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min']] }],
  atcSingle: [{ key: 'atcMode', label: 'Modus', type: 'choice', options: [['simple', 'Einfach'], ['detailed', 'Ausführlich']] }],
  atcDouble: [{ key: 'atcMode', label: 'Modus', type: 'choice', options: [['simple', 'Einfach'], ['detailed', 'Ausführlich']] }],
  atcTriple: [{ key: 'atcMode', label: 'Modus', type: 'choice', options: [['simple', 'Einfach'], ['detailed', 'Ausführlich']] }],
  checkouts: [
    { key: 'coMode', label: 'Spielen nach', type: 'choice', options: [['count', 'Checks'], ['time', 'Zeit']] },
    { key: 'coCount', label: 'Checks benötigt', type: 'number', min: 1, max: 100, when: p => p.coMode === 'count' },
    { key: 'coMinutes', label: 'Minuten', type: 'number', min: 1, max: 120, when: p => p.coMode === 'time' },
    { key: 'coRange', label: 'Zahlenbereich', type: 'range' },
    { key: 'coShowPath', label: 'Checkout-Weg', type: 'toggle' },
  ],
  doubles: [
    { key: 'dblCustom', label: 'Reihenfolge', type: 'dblseq' },
    { key: 'dblMode', label: 'Spielen nach', type: 'choice', options: [['time', 'Zeit'], ['hits', 'Treffer']] },
    { key: 'dblMinutes', label: 'Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min'], [7, '7 Min']], when: p => p.dblMode === 'time' },
    { key: 'dblHits', label: 'Treffer-Ziel', type: 'number', min: 1, max: 200, when: p => p.dblMode === 'hits' },
  ],
  l121: [
    { key: 'l121Variant', label: 'Variante', type: 'choice', options: [['classic', 'Klassisch'], ['leek', 'Leek'], ['grob', 'GROB Boys']] },
    { key: 'l121GrobDarts', label: 'GROB Boys: Darts', type: 'choice', options: [[9, '9 Darts'], [12, '12 Darts']], when: p => p.l121Variant === 'grob' },
  ],
  drill: [{ key: 'drillMin', label: 'Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min'], [7, '7 Min']] }],
  survival: [{ key: 'svDifficulty', label: 'Stufe', type: 'choice', options: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['insane', 'Insane']] }],
};

// Startwerte für einen neuen Plan aus den aktuellen Einstellungen
export function defaultParams(settings, gameIds) {
  const p = {};
  for (const id of gameIds) for (const f of PLAN_PARAMS[id] || []) {
    if (f.key === 'coRange') { p.coMin = settings.coMin; p.coMax = settings.coMax; }
    else p[f.key] = Array.isArray(settings[f.key]) ? [...settings[f.key]] : settings[f.key];
  }
  return p;
}
