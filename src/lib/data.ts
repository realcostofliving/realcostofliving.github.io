import type { Country, Dataset, Indicator, Obs, RegionId, ValueMode } from './types';

const base = import.meta.env.BASE_URL;

export async function loadDataset(): Promise<{ data: Dataset; topo: any }> {
  const [data, topo] = await Promise.all([
    fetch(`${base}data/data.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load data (${r.status})`);
      return r.json();
    }),
    fetch(`${base}data/europe.topo.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load map (${r.status})`);
      return r.json();
    }),
  ]);
  return { data, topo };
}

export const FLAG_LABELS: Record<string, string> = {
  p: 'provisional',
  e: 'estimated',
  b: 'break in series',
  u: 'low reliability',
  d: 'definition differs',
  c: 'confidential',
};

export function describeFlag(f?: string): string[] {
  if (!f) return [];
  return [...f].map((ch) => FLAG_LABELS[ch]).filter(Boolean);
}

export function inRegion(c: Country, region: RegionId): boolean {
  switch (region) {
    case 'ALL': return true;
    case 'EU': return c.eu;
    case 'WB': return c.wb;
    default: return c.region === region;
  }
}

export function obsAt(series: Obs[] | undefined | null, year: number): Obs | undefined {
  if (!series) return undefined;
  // Series are short (≤ 23 points) and sorted; a linear scan is fine.
  for (const o of series) if (o[0] === year) return o;
  return undefined;
}

export function valueAt(ind: Indicator, id: string, year: number): number | undefined {
  return obsAt(ind.series[id], year)?.[1];
}

/** Previous available observation strictly before `year`, with the gap in years. */
export function previousObs(series: Obs[] | undefined, year: number): Obs | undefined {
  if (!series) return undefined;
  let prev: Obs | undefined;
  for (const o of series) if (o[0] < year) prev = o;
  return prev;
}

export function seriesFor(ind: Indicator, id: string): Obs[] | undefined {
  if (id === 'EU27' || id === 'EA') return ind.benchmarkId === id ? ind.benchmarkSeries ?? undefined : undefined;
  return ind.series[id];
}

/** Year with the widest coverage among the most recent years (the "latest complete comparable year"). */
export function defaultYear(ind: Indicator): number {
  const counts = new Map<number, number>();
  for (const s of Object.values(ind.series)) for (const o of s) counts.set(o[0], (counts.get(o[0]) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const years = [...counts.keys()].sort((a, b) => b - a);
  return years.find((y) => (counts.get(y) ?? 0) >= max * 0.85) ?? ind.coverage.last;
}

export function coverageAt(ind: Indicator, year: number, ids: string[]): number {
  return ids.filter((id) => valueAt(ind, id, year) !== undefined).length;
}

/**
 * Transform a series for display. Never bridges missing years:
 *  - yoy: % change vs the immediately preceding year only
 *  - change: difference vs base year (percentage points for rates, % for levels)
 *  - index: base year = 100 (levels only)
 */
export function transform(series: Obs[] | undefined, ind: Indicator, mode: ValueMode, baseYear: number): Obs[] {
  if (!series) return [];
  if (mode === 'original') return series;
  const map = new Map(series.map((o) => [o[0], o]));
  if (mode === 'yoy') {
    if (ind.kind === 'rate') return series;
    const out: Obs[] = [];
    for (const o of series) {
      const p = map.get(o[0] - 1);
      if (p && p[1] !== 0) out.push([o[0], (o[1] / p[1] - 1) * 100, o[2]]);
    }
    return out;
  }
  const b = map.get(baseYear);
  if (!b) return [];
  if (mode === 'change') {
    return series.map((o) => [o[0], ind.kind === 'rate' ? o[1] - b[1] : (o[1] / b[1] - 1) * 100, o[2]] as Obs);
  }
  if (ind.kind === 'rate') return [];
  return series.map((o) => [o[0], (o[1] / b[1]) * 100, o[2]] as Obs);
}

export function modeUnit(ind: Indicator, mode: ValueMode, baseYear: number): string {
  switch (mode) {
    case 'original': return ind.unit;
    case 'yoy': return ind.kind === 'rate' ? ind.unit : '% change on previous year';
    case 'change': return ind.kind === 'rate' ? `Percentage points vs ${baseYear}` : `% change since ${baseYear}`;
    case 'index': return `Index, ${baseYear} = 100`;
  }
}

export function modeSupported(ind: Indicator, mode: ValueMode): boolean {
  if (ind.kind === 'rate') return mode === 'original' || mode === 'change';
  return true;
}

export function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function fmt(v: number | undefined, decimals = 1, unitShort = ''): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  const n = Math.abs(v) >= 1000 ? v.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : v.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${n}${unitShort}`;
}

export function fmtSigned(v: number | undefined, decimals = 1, unitShort = ''): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  const s = fmt(Math.abs(v), decimals, unitShort);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function fmtValue(ind: Indicator, v: number | undefined): string {
  return fmt(v, ind.decimals, ind.unitShort);
}

export function periodLabel(p: string): string {
  if (/Q\d$/.test(p)) return `${p.slice(5)} ${p.slice(0, 4)}`;
  const [y, m] = p.split('-');
  if (m) return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return p;
}

export function sourceName(data: Dataset, key: string): string {
  const s = data.sources[key];
  return s ? `${s.org} (${s.dataset})` : key;
}
