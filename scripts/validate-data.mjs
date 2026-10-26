#!/usr/bin/env node
// Integrity checks for the processed data. Exits with code 1 if anything fails, so the
// deployment workflow never publishes a broken or suspicious dataset.
// Run with: npm run data:validate  (optionally pass a path to another data.json)

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = resolve(process.argv[2] ?? resolve(ROOT, 'public/data/data.json'));
const GEO = resolve(ROOT, 'public/data/europe.topo.json');

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Plausible ranges. Values outside are almost certainly a unit or parsing error.
const RATE_RANGE = [-60, 150]; // Türkiye's annual inflation peaked at ~72% (2022)
const CORE = { hpi_growth: 28, rent_growth: 30, inflation: 38, overburden: 30, housing_cost_share: 30, pti: 25, pli: 33 };

const data = JSON.parse(await readFile(DATA, 'utf8'));
const geo = JSON.parse(await readFile(GEO, 'utf8'));
const countryIds = new Set(data.countries.map((c) => c.id));
const shapeIds = new Set(geo.objects.countries.geometries.map((g) => g.properties.id));

for (const c of data.countries) if (!shapeIds.has(c.id)) fail(`Country ${c.id} has no map geometry`);
if (countryIds.size !== data.countries.length) fail('Duplicate country ids');

const ids = new Set();
for (const ind of data.indicators) {
  const tag = `[${ind.id}]`;
  if (ids.has(ind.id)) fail(`${tag} duplicate indicator id`);
  ids.add(ind.id);
  for (const k of ['label', 'unit', 'definition', 'explainer', 'kind', 'polarity', 'category']) if (!ind[k]) fail(`${tag} missing metadata field "${k}"`);
  for (const s of ind.sourceKeys) if (!data.sources[s]) fail(`${tag} unknown source ${s}`);
  if (!ind.sourceKeys.length) fail(`${tag} has no source`);

  const checkSeries = (name, series) => {
    let prev = -Infinity, zeros = 0;
    for (const obs of series) {
      const [y, v] = obs;
      if (!Number.isInteger(y) || y < data.firstYear || y > data.lastYear) fail(`${tag} ${name}: year out of range ${y}`);
      if (y <= prev) fail(`${tag} ${name}: duplicate or unsorted year ${y}`);
      prev = y;
      if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${tag} ${name}: non-numeric value in ${y}`);
      if (ind.kind === 'rate' && (v < RATE_RANGE[0] || v > RATE_RANGE[1])) fail(`${tag} ${name}: implausible rate ${v} in ${y}`);
      if (ind.kind === 'level' && v <= 0) fail(`${tag} ${name}: non-positive level ${v} in ${y}`);
      if (v === 0) zeros++;
    }
    if (series.length >= 5 && zeros / series.length > 0.2) warn(`${tag} ${name}: ${zeros} zero values — check they are real observations`);
  };

  for (const [cid, series] of Object.entries(ind.series)) {
    if (!countryIds.has(cid)) fail(`${tag} unknown country ${cid}`);
    if (!ind.countrySource[cid]) fail(`${tag} ${cid} has no recorded source`);
    if (!series.length) fail(`${tag} ${cid} empty series`);
    checkSeries(cid, series);
  }
  if (ind.benchmarkId && !ind.benchmarkSeries) fail(`${tag} declares benchmark but has none`);
  if (ind.benchmarkSeries) checkSeries('benchmark', ind.benchmarkSeries);

  const n = Object.keys(ind.series).length;
  if (CORE[ind.id] && n < CORE[ind.id]) fail(`${tag} only ${n} countries (expected ≥ ${CORE[ind.id]}) — source may have changed`);
  if (ind.coverage.last < new Date().getFullYear() - 3) fail(`${tag} latest year ${ind.coverage.last} is stale`);

  if (ind.latest) for (const [cid, o] of Object.entries(ind.latest)) {
    if (!countryIds.has(cid)) fail(`${tag} latest: unknown country ${cid}`);
    if (!/^\d{4}-(Q[1-4]|\d{2})$/.test(o.p)) fail(`${tag} latest: bad period ${o.p}`);
    if (!Number.isFinite(o.v) || o.v < RATE_RANGE[0] || o.v > RATE_RANGE[1]) fail(`${tag} latest: implausible ${cid} ${o.v}`);
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`FAIL  ${e}`);
  console.error(`\n${errors.length} check(s) failed.`);
  process.exit(1);
}
const obs = data.indicators.reduce((a, i) => a + i.coverage.observations, 0);
console.log(`OK  ${data.indicators.length} indicators, ${data.countries.length} countries, ${obs} observations, generated ${data.generatedAt}`);
