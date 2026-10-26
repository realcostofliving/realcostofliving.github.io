import { createContext, useContext } from 'react';
import type { Dataset, Indicator, RegionId, ValueMode } from './types';
import { defaultYear } from './data';

export interface Filters {
  region: RegionId;
  indicator: string;
  year: number;
  focus: string | null;
  countries: string[];
  startYear: number;
  endYear: number;
  benchmark: boolean;
  mode: ValueMode;
  baseYear: number;
}

export const MAX_COUNTRIES = 5;
export const DEFAULT_COUNTRIES = ['AL', 'RS', 'BE', 'DE'];
const DEFAULT_INDICATOR = 'hpi_growth';

export function defaultFilters(data: Dataset): Filters {
  const ind = data.indicators.find((i) => i.id === DEFAULT_INDICATOR)!;
  return {
    region: 'ALL',
    indicator: DEFAULT_INDICATOR,
    year: defaultYear(ind),
    focus: null,
    countries: DEFAULT_COUNTRIES,
    startYear: data.firstYear,
    endYear: Math.min(data.lastYear, ind.coverage.last),
    benchmark: true,
    mode: 'original',
    baseYear: 2015,
  };
}

const MODES: ValueMode[] = ['original', 'yoy', 'change', 'index'];

/** Read filters from the URL hash query (#/?i=…&y=…) so views can be shared. */
export function filtersFromHash(data: Dataset, hash: string): Filters {
  const d = defaultFilters(data);
  const q = new URLSearchParams(hash.split('?')[1] ?? '');
  const ids = new Set(data.countries.map((c) => c.id));
  const num = (k: string, lo: number, hi: number, fb: number) => {
    const v = Number(q.get(k));
    return Number.isInteger(v) && v >= lo && v <= hi ? v : fb;
  };
  const ind = q.get('i');
  const region = q.get('r') as RegionId | null;
  const countries = (q.get('c') ?? '').split(',').filter((c) => ids.has(c)).slice(0, MAX_COUNTRIES);
  const mode = q.get('m') as ValueMode | null;
  const f: Filters = {
    region: region && data.regions.some((r) => r.id === region) ? region : d.region,
    indicator: ind && data.indicators.some((i) => i.id === ind) ? ind : d.indicator,
    year: num('y', data.firstYear, data.lastYear, d.year),
    focus: q.get('f') && ids.has(q.get('f')!) ? q.get('f') : null,
    countries: q.has('c') ? countries : d.countries,
    startYear: num('s', data.firstYear, data.lastYear, d.startYear),
    endYear: num('e', data.firstYear, data.lastYear, d.endYear),
    benchmark: q.get('b') !== '0',
    mode: mode && MODES.includes(mode) ? mode : d.mode,
    baseYear: num('by', data.firstYear, data.lastYear, d.baseYear),
  };
  if (f.startYear > f.endYear) [f.startYear, f.endYear] = [f.endYear, f.startYear];
  if (!q.has('y') && ind) {
    const i = data.indicators.find((x) => x.id === ind);
    if (i) f.year = defaultYear(i);
  }
  return f;
}

export function filtersToQuery(f: Filters, d: Filters): string {
  const q = new URLSearchParams();
  if (f.region !== d.region) q.set('r', f.region);
  if (f.indicator !== d.indicator) q.set('i', f.indicator);
  if (f.year !== d.year) q.set('y', String(f.year));
  if (f.focus) q.set('f', f.focus);
  if (f.countries.join() !== d.countries.join()) q.set('c', f.countries.join(','));
  if (f.startYear !== d.startYear) q.set('s', String(f.startYear));
  if (f.endYear !== d.endYear) q.set('e', String(f.endYear));
  if (!f.benchmark) q.set('b', '0');
  if (f.mode !== d.mode) q.set('m', f.mode);
  if (f.baseYear !== d.baseYear) q.set('by', String(f.baseYear));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export interface AppCtx {
  data: Dataset;
  topo: any;
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  reset: () => void;
  indicator: Indicator;
  ind: (id: string) => Indicator;
  countryName: (id: string) => string;
  selectCountry: (id: string) => void;
  dashHref: string;
  lang: import('./i18n').Lang;
  setLang: (l: import('./i18n').Lang) => void;
}

export const Ctx = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('App context missing');
  return c;
}
