import type { Indicator } from './types';

// Editorial palette. Categorical slots validated for colour-vision deficiency
// (dataviz validator: worst adjacent CVD ΔE 11.0, normal-vision ΔE 21.1 on #fffdf8).
export const SERIES = ['#2f6db5', '#c8553d', '#2a9d8f', '#d39b2a', '#8e5ea2', '#4f8a3c'];
export const BENCHMARK_COLOR = '#2b2f3a';
export const NO_DATA = '#efebe3';

const TERRACOTTA = ['#f6e1d3', '#edbf9f', '#df9a75', '#cc7552', '#ac5536', '#7e3b24'];
const BLUE = ['#dfe8f1', '#b9cee3', '#8fb2d4', '#6592c0', '#3f71a4', '#24507f'];
// Diverging: falling (blue) ← stable (neutral) → rising (terracotta)
const DIVERGING = ['#3f71a4', '#9dbbd8', '#e3d7c3', '#f0c6a8', '#e0976f', '#c76641', '#8f3e27'];
const RATE_BREAKS = [-2, 0, 2, 4, 7, 10];

export interface ColorScale {
  color: (v: number | undefined) => string;
  bins: { from?: number; to?: number; color: string }[];
}

function nice(v: number): number {
  if (v === 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(Math.abs(v)));
  const step = mag >= 10 ? mag / 2 : mag;
  return Math.round(v / step) * step;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const cache = new Map<string, ColorScale>();

/**
 * A fixed scale per indicator, computed over every country and year, so colours stay
 * comparable while the year slider moves.
 */
export function colorScale(ind: Indicator): ColorScale {
  const hit = cache.get(ind.id);
  if (hit) return hit;
  let breaks: number[];
  let palette: string[];
  if (ind.kind === 'rate') {
    breaks = RATE_BREAKS;
    palette = DIVERGING;
  } else {
    const all = Object.values(ind.series).flat().map((o) => o[1]).sort((a, b) => a - b);
    const raw = [1, 2, 3, 4, 5].map((i) => quantile(all, i / 6));
    breaks = [...new Set(raw.map(nice))].sort((a, b) => a - b);
    palette = ind.polarity === 'benefit' ? BLUE : TERRACOTTA;
    if (breaks.length < 5) palette = palette.slice(palette.length - breaks.length - 1);
  }
  const color = (v: number | undefined) => {
    if (v === undefined || !Number.isFinite(v)) return NO_DATA;
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i++;
    return palette[i];
  };
  const bins = palette.map((c, i) => ({ from: i === 0 ? undefined : breaks[i - 1], to: i === breaks.length ? undefined : breaks[i], color: c }));
  const s = { color, bins };
  cache.set(ind.id, s);
  return s;
}

/** Colour for a "change" figure: rising costs terracotta, improvements green, else neutral ink. */
export function deltaTone(ind: Indicator, delta: number | undefined): 'up-bad' | 'down-good' | 'up-good' | 'down-bad' | 'flat' {
  if (delta === undefined || Math.abs(delta) < 1e-9) return 'flat';
  const up = delta > 0;
  if (ind.polarity === 'benefit') return up ? 'up-good' : 'down-bad';
  return up ? 'up-bad' : 'down-good';
}
