// Fragenpool: Standard aus data/quiz.json, im Admin anpassbar (dann im lokalen Speicher).
import { store } from '../store.js';

let defaults = null;
export async function defaultQuiz() {
  if (!defaults) defaults = await fetch('data/quiz.json').then(r => r.json());
  return defaults;
}
export async function loadQuiz() {
  return store.quiz || defaultQuiz();
}
export const CAT_COLORS = { spieler: '#7CC242', turniere: '#FFC56E', regeln: '#6EC3FF', checkouts: '#FF7A7D' };
