#!/usr/bin/env node
// Downloads every indicator from its official source, harmonises country codes and
// periods, and writes public/data/data.json. Run with: npm run data:fetch
//
// Rules applied here (also documented on the methodology page):
//  - Observations are never invented, interpolated or set to zero when missing.
//  - Each country's series comes from exactly one source (see config/indicators.mjs).
//  - Source status flags (provisional, estimated, break in series...) are kept per observation.
//  - If a source is temporarily unavailable, the indicators that depend on it keep the
//    values from the previous snapshot, marked `stale` with their original retrieval date.
//  - Only derived values: BIS quarterly indices -> annual averages (all four quarters
//    required), rebased to 2015 = 100, and year-on-year growth from those averages.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, REGIONS, EXCLUDED, AGGREGATES } from './config/countries.mjs';
import { INDICATORS, SOURCE_INFO, BIS_HPI } from './config/indicators.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/data/data.json');
const FIRST_YEAR = 2004;
const LAST_YEAR = 2026;

const byEurostat = new Map(COUNTRIES.map((c) => [c.eurostat, c.id]));
const byIso3 = new Map(COUNTRIES.map((c) => [c.iso3, c.id]));
const byIso2 = new Map(COUNTRIES.map((c) => [c.id, c.id]));
const datasetUpdated = {};

// ---------------------------------------------------------------- helpers
async function getJson(url, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'europe-cost-of-living data pipeline', Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw new Error(`Failed to fetch ${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
}

async function getText(url, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (europe-cost-of-living data pipeline)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i >= tries) throw new Error(`Failed to fetch ${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  const h = head.map((s) => s.replace(/^﻿/, ''));
  return body.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

// Decode a Eurostat JSON-stat 2.0 response into Map<geoCode, [{t, v, f}]>
function decodeEurostat(d) {
  const ids = d.id, sizes = d.size;
  const strides = ids.map((_, i) => sizes.slice(i + 1).reduce((a, b) => a * b, 1));
  const cat = ids.map((k) => Object.keys(d.dimension[k].category.index).sort((a, b) => d.dimension[k].category.index[a] - d.dimension[k].category.index[b]));
  const geoPos = ids.indexOf('geo'), timePos = ids.indexOf('time');
  const out = new Map();
  for (const [flat, v] of Object.entries(d.value)) {
    let rem = Number(flat);
    const coord = ids.map((_, i) => { const x = Math.floor(rem / strides[i]); rem %= strides[i]; return x; });
    const g = cat[geoPos][coord[geoPos]], t = cat[timePos][coord[timePos]];
    const f = (d.status && d.status[flat]) || '';
    if (v === null || v === undefined) continue;
    if (!out.has(g)) out.set(g, []);
    out.get(g).push({ t, v: Number(v), f });
  }
  for (const arr of out.values()) arr.sort((a, b) => (a.t < b.t ? -1 : 1));
  return out;
}

const eurostatCache = new Map();
async function eurostat(ds, filters, since) {
  const p = new URLSearchParams({ format: 'JSON', lang: 'EN', ...filters });
  if (since) p.set('sinceTimePeriod', since);
  const url = `${SOURCE_INFO[ds].api}?${p}`;
  if (eurostatCache.has(url)) return eurostatCache.get(url);
  const d = await getJson(url);
  datasetUpdated[ds] = d.updated;
  const decoded = decodeEurostat(d);
  eurostatCache.set(url, decoded);
  return decoded;
}

// ---------------------------------------------------------------- sources
// Each loader returns { series: Map<id, [[year, value, flag]]>, benchmark: [[...]]|null, derived: bool }

async function loadEurostatAnnual(src) {
  const raw = await eurostat(src.ds, src.filters, String(FIRST_YEAR));
  const toSeries = (arr) => arr.filter((o) => +o.t >= FIRST_YEAR && +o.t <= LAST_YEAR).map((o) => [+o.t, round(o.v), o.f || undefined]);
  const series = new Map();
  for (const [g, arr] of raw) { const id = byEurostat.get(g); if (id) series.set(id, toSeries(arr)); }
  const bench = raw.get(AGGREGATES.EU27.eurostat);
  return { series, benchmark: bench ? toSeries(bench) : null, benchmarkId: 'EU27', sourceKey: src.ds };
}

async function loadEurostatLatest(src) {
  const raw = await eurostat(src.ds, src.filters, src.since);
  const pick = (arr) => { const o = arr[arr.length - 1]; return o ? { p: o.t, v: round(o.v), f: o.f || undefined } : null; };
  const latest = new Map();
  for (const [g, arr] of raw) { const id = byEurostat.get(g); if (id && arr.length) latest.set(id, pick(arr)); }
  const bench = raw.get(AGGREGATES.EU27.eurostat);
  return { latest, benchmark: bench && bench.length ? pick(bench) : null, sourceKey: src.ds };
}

let bisRaw = null;
async function bisQuarterly() {
  if (bisRaw) return bisRaw;
  const url = `${SOURCE_INFO.bis_spp.api}Q.${BIS_HPI.join('+')}.N.628?startPeriod=${FIRST_YEAR - 1}-Q1&format=csv`;
  const rows = parseCsv(await getText(url));
  bisRaw = new Map();
  for (const r of rows) {
    if (!r.OBS_VALUE || r.OBS_VALUE === 'NaN') continue;
    const id = byIso2.get(r.REF_AREA);
    if (!id) continue;
    if (!bisRaw.has(id)) bisRaw.set(id, []);
    bisRaw.get(id).push({ t: r.TIME_PERIOD, v: Number(r.OBS_VALUE), f: r.OBS_STATUS && r.OBS_STATUS !== 'A' ? r.OBS_STATUS.toLowerCase() : '' });
  }
  for (const arr of bisRaw.values()) arr.sort((a, b) => (a.t < b.t ? -1 : 1));
  datasetUpdated.bis_spp = new Date().toISOString();
  return bisRaw;
}

// Annual averages from quarterly BIS index; only years with all four quarters.
function bisAnnual(arr) {
  const years = new Map();
  for (const o of arr) { const y = +o.t.slice(0, 4); if (!years.has(y)) years.set(y, []); years.get(y).push(o.v); }
  const annual = new Map();
  for (const [y, vals] of years) if (vals.length === 4) annual.set(y, vals.reduce((a, b) => a + b, 0) / 4);
  return annual;
}

async function loadBis(src, mode) {
  const raw = await bisQuarterly();
  const series = new Map();
  for (const id of src.only) {
    const arr = raw.get(id);
    if (!arr) continue;
    const annual = bisAnnual(arr);
    const base = annual.get(2015);
    if (!base) continue;
    const out = [];
    for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
      if (!annual.has(y)) continue;
      if (mode === 'index') out.push([y, round((annual.get(y) / base) * 100, 1)]);
      else if (annual.has(y - 1)) out.push([y, round((annual.get(y) / annual.get(y - 1) - 1) * 100, 1)]);
    }
    series.set(id, out);
  }
  return { series, benchmark: null, sourceKey: 'bis_spp', derived: true };
}

async function loadBisLatest(src) {
  const raw = await bisQuarterly();
  const latest = new Map();
  for (const id of src.only) {
    const arr = raw.get(id);
    if (!arr) continue;
    const last = arr[arr.length - 1];
    const [y, q] = last.t.split('-');
    const prev = arr.find((o) => o.t === `${+y - 1}-${q}`);
    if (prev) latest.set(id, { p: last.t, v: round((last.v / prev.v - 1) * 100, 1), d: true });
  }
  return { latest, benchmark: null, sourceKey: 'bis_spp' };
}

let oecdRows = null;
async function loadOecd(src) {
  if (!oecdRows) {
    const url = `${SOURCE_INFO.oecd_hp.api}.A..?startPeriod=${FIRST_YEAR}&format=csvfilewithlabels`;
    oecdRows = parseCsv(await getText(url));
    datasetUpdated.oecd_hp = new Date().toISOString();
  }
  const series = new Map();
  let benchmark = [];
  for (const r of oecdRows) {
    if (r.MEASURE !== src.measure || r.FREQ !== 'A' || r.OBS_VALUE === '') continue;
    const y = +r.TIME_PERIOD;
    if (y < FIRST_YEAR || y > LAST_YEAR) continue;
    const f = r.OBS_STATUS && r.OBS_STATUS !== 'A' ? r.OBS_STATUS.toLowerCase() : undefined;
    const obs = [y, round(Number(r.OBS_VALUE), 1), f];
    if (r.REF_AREA === AGGREGATES.EA.oecd) { benchmark.push(obs); continue; }
    const id = byIso3.get(r.REF_AREA);
    if (!id) continue;
    if (!series.has(id)) series.set(id, []);
    series.get(id).push(obs);
  }
  for (const s of series.values()) s.sort((a, b) => a[0] - b[0]);
  benchmark.sort((a, b) => a[0] - b[0]);
  return { series, benchmark: benchmark.length ? benchmark : null, benchmarkId: 'EA', sourceKey: 'oecd_hp' };
}

async function loadWorldBank(src) {
  const codes = [...COUNTRIES.map((c) => c.iso3), AGGREGATES.EU27.worldbank].join(';');
  const url = `https://api.worldbank.org/v2/country/${codes}/indicator/${src.indicator}?format=json&date=${FIRST_YEAR}:${LAST_YEAR}&per_page=5000`;
  const d = await getJson(url);
  datasetUpdated[src.src] = d[0].lastupdated;
  const series = new Map();
  const benchmark = [];
  for (const r of d[1] || []) {
    if (r.value === null) continue;
    const obs = [+r.date, round(r.value, 2)];
    if (r.countryiso3code === AGGREGATES.EU27.worldbank) { benchmark.push(obs); continue; }
    const id = byIso3.get(r.countryiso3code);
    if (!id) continue;
    if (!series.has(id)) series.set(id, []);
    series.get(id).push(obs);
  }
  for (const s of series.values()) s.sort((a, b) => a[0] - b[0]);
  benchmark.sort((a, b) => a[0] - b[0]);
  return { series, benchmark: benchmark.length ? benchmark : null, benchmarkId: 'EU27', sourceKey: src.src };
}

function loader(src) {
  switch (src.type) {
    case 'eurostat': return loadEurostatAnnual(src);
    case 'bis-index': return loadBis(src, 'index');
    case 'bis-growth': return loadBis(src, 'growth');
    case 'oecd': return loadOecd(src);
    case 'worldbank': return loadWorldBank(src);
    case 'eurostat-latest': return loadEurostatLatest(src);
    case 'bis-latest': return loadBisLatest(src);
    default: throw new Error(`Unknown source type ${src.type}`);
  }
}

const allowed = (src, id) => (!src.only || src.only.includes(id)) && (!src.except || !src.except.includes(id));

// ---------------------------------------------------------------- build
async function previousSnapshot() {
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return null; }
}

async function build() {
  const prev = await previousSnapshot();
  const now = new Date().toISOString();
  const indicators = [];
  const stale = [];
  for (const ind of INDICATORS) {
    process.stdout.write(`• ${ind.id} … `);
    try {
      indicators.push(await buildIndicator(ind, now));
    } catch (err) {
      const old = prev?.indicators?.find((i) => i.id === ind.id);
      if (!old) throw err;
      console.log(`source unavailable (${err.message.slice(0, 160)}); keeping snapshot from ${old.retrievedAt ?? prev.generatedAt}`);
      indicators.push({ ...old, retrievedAt: old.retrievedAt ?? prev.generatedAt, stale: true });
      stale.push(ind.id);
      for (const k of old.sourceKeys) if (!datasetUpdated[k] && prev.sources?.[k]?.updated) datasetUpdated[k] = prev.sources[k].updated;
    }
  }
  if (stale.length > INDICATORS.length / 2) throw new Error(`Too many sources unavailable (${stale.length} indicators) — not writing a mostly stale snapshot.`);
  if (stale.length) console.warn(`
Kept previous values for: ${stale.join(', ')}`);
  return writeOut(indicators, now);
}

async function buildIndicator(ind, now) {
  {
    const series = {}, countrySource = {};
    let benchmark = null, benchmarkId = ind.benchmark, benchmarkSource = null;
    const usedSources = new Set();
    for (const src of ind.sources) {
      const res = await loader(src);
      if (!benchmark && res.benchmark) { benchmark = res.benchmark; benchmarkId = res.benchmarkId; benchmarkSource = res.sourceKey; usedSources.add(res.sourceKey); }
      for (const [id, s] of res.series) {
        if (series[id] || !allowed(src, id) || !s.length) continue;
        if (src.minLastYear && s[s.length - 1][0] < src.minLastYear) continue;
        series[id] = s.map((o) => (o[2] ? o : o.slice(0, 2)));
        countrySource[id] = res.derived ? { s: res.sourceKey, d: 1 } : { s: res.sourceKey };
        usedSources.add(res.sourceKey);
      }
    }
    let latest = null, latestBenchmark = null;
    if (ind.latest) {
      latest = {};
      for (const src of ind.latest) {
        const res = await loader(src);
        usedSources.add(res.sourceKey);
        if (!latestBenchmark && res.benchmark) latestBenchmark = res.benchmark;
        for (const [id, o] of res.latest) {
          if (latest[id] || !allowed(src, id) || !o) continue;
          // Only keep observations newer than the last complete annual value.
          const lastAnnual = series[id]?.[series[id].length - 1]?.[0] ?? 0;
          if (+o.p.slice(0, 4) <= lastAnnual) continue;
          latest[id] = { ...o, s: res.sourceKey };
        }
      }
    }
    const all = Object.values(series).flat();
    const years = all.map((o) => o[0]);
    const { sources, latest: _l, ...rest } = ind;
    const built = {
      ...rest,
      retrievedAt: now,
      sourceKeys: [...usedSources],
      benchmarkId: benchmark ? benchmarkId : null,
      benchmarkSource,
      coverage: { countries: Object.keys(series).length, first: Math.min(...years), last: Math.max(...years), observations: all.length },
      countrySource,
      series,
      benchmarkSeries: benchmark ? benchmark.map((o) => (o[2] ? o : o.slice(0, 2))) : null,
      latest,
      latestBenchmark,
    };
    console.log(`${Object.keys(series).length} countries, ${years.length ? `${Math.min(...years)}–${Math.max(...years)}` : 'no data'}${latest ? `, latest for ${Object.keys(latest).length}` : ''}`);
    return built;
  }
}

async function writeOut(indicators, now) {
  const sources = Object.fromEntries(Object.entries(SOURCE_INFO).map(([k, v]) => [k, { ...v, updated: datasetUpdated[k] ?? null }]));
  const data = {
    title: 'Europe: The Real Cost of Living',
    generatedAt: now,
    firstYear: FIRST_YEAR,
    lastYear: LAST_YEAR,
    countries: COUNTRIES.map(({ id, name, region, eu, wb, euro, iso3, ne }) => ({ id, name, region, eu, wb, euro, iso3, ne })),
    regions: REGIONS,
    excluded: EXCLUDED,
    aggregates: { EU27: { name: 'EU-27' }, EA: { name: 'Euro area (OECD aggregate)' } },
    sources,
    indicators,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data));
  console.log(`\nWrote ${OUT} (${(JSON.stringify(data).length / 1024).toFixed(0)} KB)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
