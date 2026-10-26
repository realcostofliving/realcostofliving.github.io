import { SQ, SQ_COUNTRIES, SQ_INDICATORS, SQ_REGIONS } from './sq';
import type { Dataset } from './types';

export type Lang = 'en' | 'sq';

let current: Lang = 'en';

export function setLang(l: Lang) {
  current = l;
  document.documentElement.lang = l === 'sq' ? 'sq' : 'en';
}
export const getLang = () => current;
// Some browsers ship without Albanian locale data. Numbers then use a locale with the same
// conventions (space between thousands, decimal comma); dates fall back to English.
const hasSq = (() => { try { return Intl.NumberFormat.supportedLocalesOf(['sq']).length > 0; } catch { return false; } })();
export const numLocale = () => (current === 'sq' ? (hasSq ? 'sq-AL' : 'fr-FR') : 'en-GB');
export const dateLocale = () => (current === 'sq' && hasSq ? 'sq-AL' : 'en-GB');

/**
 * Translate an English interface string. English text is the key, so untranslated strings
 * simply fall back to English. `{name}` placeholders are filled from `vars`.
 */
export function t(text: string, vars?: Record<string, string | number>): string {
  let s = current === 'sq' ? SQ[text] ?? text : text;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
  return s;
}

/** A copy of the dataset with country, region and indicator texts in the chosen language. */
export function localize(data: Dataset, lang: Lang): Dataset {
  if (lang === 'en') return { ...data, countries: data.countries.map((c) => ({ ...c, nameEn: c.name })) };
  return {
    ...data,
    countries: data.countries.map((c) => ({ ...c, nameEn: c.name, name: SQ_COUNTRIES[c.id] ?? c.name })),
    regions: data.regions.map((r) => ({ ...r, label: SQ_REGIONS[r.id] ?? r.label })),
    indicators: data.indicators.map((i) => ({ ...i, ...(SQ_INDICATORS[i.id] ?? {}) })),
  };
}

export function initialLang(): Lang {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '').get('lang');
  if (q === 'sq' || q === 'en') return q;
  try {
    const s = localStorage.getItem('lang');
    if (s === 'sq' || s === 'en') return s;
  } catch { /* storage may be blocked */ }
  return navigator.language?.toLowerCase().startsWith('sq') ? 'sq' : 'en';
}

export function rememberLang(l: Lang) {
  try { localStorage.setItem('lang', l); } catch { /* storage may be blocked */ }
}
