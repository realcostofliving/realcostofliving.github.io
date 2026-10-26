import type { Country } from './types';

/** Scroll a section into view, clearing the sticky filter bar. */
export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Other names people type for a country.
const ALIASES: Record<string, string[]> = {
  GB: ['uk', 'britain', 'great britain', 'england', 'scotland', 'wales'],
  TR: ['turkey', 'turkiye'],
  CZ: ['czech republic'],
  MK: ['macedonia'],
  BA: ['bosnia', 'herzegovina', 'bih'],
  NL: ['holland'],
  XK: ['kosova'],
  AL: ['shqiperi', 'shqiperia'],
  DE: ['deutschland'],
  ES: ['espana'],
  GR: ['hellas'],
  CH: ['schweiz', 'suisse'],
  RS: ['srbija'],
  ME: ['crna gora'],
};

export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** How well a country matches a search: 0 = no match, higher is better. */
export function matchScore(c: Country, query: string): number {
  const q = fold(query);
  if (!q) return 1;
  const name = fold(c.name);
  const en = fold(c.nameEn ?? c.name);
  if (name === q || en === q || c.id.toLowerCase() === q || (ALIASES[c.id] ?? []).includes(q)) return 4;
  if (name.startsWith(q) || en.startsWith(q)) return 3;
  if ((ALIASES[c.id] ?? []).some((a) => a.startsWith(q))) return 2.5;
  if (name.includes(q) || en.includes(q)) return 2;
  if ((ALIASES[c.id] ?? []).some((a) => a.includes(q))) return 1.5;
  return 0;
}
