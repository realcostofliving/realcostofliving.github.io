// Shape of public/data/data.json, produced by scripts/fetch-data.mjs.

export type Obs = [year: number, value: number, flag?: string];

export interface Country {
  id: string;
  name: string;
  region: 'N' | 'W' | 'S' | 'E';
  eu: boolean;
  wb: boolean;
  euro: boolean;
  iso3: string;
  ne: string;
}

export interface Region {
  id: RegionId;
  label: string;
}
export type RegionId = 'ALL' | 'EU' | 'WB' | 'N' | 'W' | 'S' | 'E';

export interface SourceInfo {
  org: string;
  name: string;
  dataset: string;
  url: string;
  api: string;
  updated: string | null;
}

export interface LatestObs {
  p: string; // period, e.g. 2026-Q2 or 2026-09
  v: number;
  f?: string;
  d?: boolean; // derived by us
  s?: string;
}

export interface Indicator {
  id: string;
  category: 'housing' | 'prices' | 'income';
  label: string;
  short: string;
  unit: string;
  unitShort: string;
  decimals: number;
  kind: 'rate' | 'level';
  polarity: 'cost' | 'benefit' | 'neutral';
  benchmark: 'EU27' | 'EA' | null;
  indexBase?: number;
  crossCountry?: boolean;
  definition: string;
  explainer: string;
  caveat?: string;
  latestLabel?: string;
  sourceKeys: string[];
  benchmarkId: 'EU27' | 'EA' | null;
  benchmarkSource: string | null;
  coverage: { countries: number; first: number; last: number; observations: number };
  countrySource: Record<string, { s: string; d?: number }>;
  series: Record<string, Obs[]>;
  benchmarkSeries: Obs[] | null;
  latest: Record<string, LatestObs> | null;
  latestBenchmark: LatestObs | null;
  retrievedAt?: string;
  /** True when the source was unreachable at the last refresh and older values are kept. */
  stale?: boolean;
}

export interface Dataset {
  title: string;
  generatedAt: string;
  firstYear: number;
  lastYear: number;
  countries: Country[];
  regions: Region[];
  excluded: { name: string; reason: string }[];
  aggregates: Record<'EU27' | 'EA', { name: string }>;
  sources: Record<string, SourceInfo>;
  indicators: Indicator[];
}

export type ValueMode = 'original' | 'yoy' | 'change' | 'index';
